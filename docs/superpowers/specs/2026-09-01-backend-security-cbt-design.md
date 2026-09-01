# Thiết kế hardening backend/security/CBT IntelliSchool

**Ngày:** 2026-09-01  
**Phạm vi:** Phase 2 backend, security, CBT và các finding F-001–F-015 liên quan backend  
**Trạng thái:** Đã chốt để triển khai

## Mục tiêu

Khóa các lỗi backend đã tái hiện, giữ tenant isolation bằng PostgreSQL RLS, bảo đảm mọi mutation nghiệp vụ có idempotency và audit, mã hóa snapshot đề thi bất biến, và thay cơ chế ba strike bằng integrity incident server-authoritative. Release verdict vẫn là `DO NOT SHIP` cho đến khi có đủ evidence runtime và browser.

## Assumption vận hành

- Kiến trúc giữ modular monolith: Fastify/TypeScript, PostgreSQL, RLS, React/Vite.
- Tenancy là shared database/shared schema; mọi dữ liệu trường có `school_id` và API role không có `BYPASSRLS`.
- Dữ liệu exam snapshot chứa answer key/rubric nên được xem là confidential; PII học sinh là sensitive.
- Không thay đổi stack hay tách service trong phase này. Read/write ratio, QPS và ngân sách cloud chưa được dùng để quyết định scale.
- SLO kiểm chứng tạm thời cho API không gồm AI/export: p50 ≤ 100ms, p95 ≤ 300ms, p99 ≤ 600ms; availability 99.9%; RPO 15 phút, RTO 1 giờ.

## Lựa chọn kiến trúc

1. **Patch trực tiếp `question_versions`:** ít file nhưng không tạo snapshot bất biến, khó pin nội dung khi đề thay đổi và tiếp tục có nguy cơ lộ rubric.
2. **Snapshot service thuần + repository orchestration — chọn:** thêm crypto/keyring boundary, append-only snapshot rows, session pinning và pure state machine; giữ SQL ở repository, dễ test fake clock/keyring và không phá compatibility cũ.
3. **Tách exam service:** cô lập tốt hơn nhưng vượt scope, tăng deployment/RLS/observability surface và không cần thiết cho phase hiện tại.

## Exam snapshot

Khi publish một assignment `EXAM`, repository lấy các item/version hiện hành, tạo canonical metadata và plaintext snapshot nội bộ gồm prompt, type, points, answer key và rubric. Plaintext chỉ tồn tại trong memory server để encrypt hoặc grade.

`exam_snapshots` là bảng append-only, gồm:

- `id`, `school_id`, `assignment_id`, `snapshot_version`;
- `ciphertext`, `nonce` 12-byte, `auth_tag` 16-byte;
- `key_version`, `metadata_hash`, canonical `metadata`, `created_by`, `created_at`;
- `supersedes_snapshot_id` và `is_active` để rotation/backfill không xóa lịch sử.

`assignments.active_exam_snapshot_id` trỏ snapshot đang dùng. `exam_sessions.exam_snapshot_id` pin snapshot tại thời điểm bắt đầu. Rotation tạo row mới, giữ row cũ để session đang chạy vẫn giải mã đúng nội dung; không sửa plaintext logic của snapshot.

Crypto boundary dùng AES-256-GCM, AAD là canonical metadata, SHA-256 hash của metadata được kiểm trước decrypt. Keyring đọc từ file/mount ngoài repo với key 32 bytes theo `key_version`; production thiếu file/key/version hoặc tag sai đều fail-closed bằng lỗi tổng quát, không log key/ciphertext/plaintext.

Keyring format được hỗ trợ: JSON object `{ "v1": "base64url-32-byte-key" }`, active version qua `EXAM_SNAPSHOT_ACTIVE_KEY_VERSION`, file qua `EXAM_SNAPSHOT_KEYRING_FILE`. Test dùng keyring inject trong memory; local test/dev có thể tạo file tạm ngoài repo, không có fallback trong production.

Migration là expand-only: tạo bảng, quyền/RLS, cột pointer nullable. Backfill application-side là idempotent theo assignment/version; thiếu key làm batch dừng fail-closed, không đánh dấu snapshot hoàn tất. Rotation decrypt old key → encrypt active key → insert row mới → cập nhật pointer trong transaction và audit.

## Student API boundary

- Student không đọc `question_versions.answer_key` hoặc `rubric` qua bất kỳ route nào.
- Exam session lấy snapshot đã pin, decrypt server-side, chỉ map `prompt`, `type`, `points`, `answer` đã lưu và metadata an toàn.
- Teacher/owner grading dùng snapshot pin của session; answer key/rubric chỉ ở backend.
- Assignment detail của student không trả rubric; assignment exam phải dùng snapshot active, thiếu snapshot trả lỗi fail-closed.

## Integrity state machine

```text
ACTIVE
  └─ counted signal → GRACE (incident server-generated)
       ├─ restore/close → ACTIVE
       ├─ t < 5s → GRACE
       ├─ t >= 5s và < 30s → WARNING
       └─ t >= 30s liên tục → LOCKED
LOCKED
  └─ authorized unlock + reason + idempotency → ACTIVE
```

Server quyết định `incidentId`, `startedAt`, `graceEndsAt`, `lockAt`, `state`, `remainingMs` và `serverNow`. Blur/visibility/fullscreen cùng incident được dedupe; signal lặp lại không tạo incident mới. Network loss chỉ được miễn khi server chứng minh bằng heartbeat gap/recovery; file picker dùng token server-issued, single-use, short-lived. Client payload không được tự miễn.

`LOCKED` chỉ chặn save answer; không set `submitted_at`, không gọi finalizer với `INTEGRITY_LOCK`. Finalizer chỉ auto-finalize khi `ends_at <= server now`, với reason `TIME_LIMIT`.

Routes mới/đổi:

- `POST /api/v1/exams/integrity` yêu cầu idempotency, trả state snapshot.
- `POST /api/v1/exams/sessions/:id/heartbeat` trả server time và integrity snapshot.
- `POST /api/v1/exams/sessions/:id/integrity/restore` cho student đóng incident đã phục hồi.
- `POST /api/v1/exams/sessions/:id/integrity/close` cho proctor/teacher/owner đóng incident có reason.
- `POST /api/v1/exams/sessions/:id/unlock` body `{ reason }`, header `X-Idempotency-Key`, authorization theo assignment/class/proctor.

Mọi close/restore/unlock đều giữ event cũ và tạo audit event mới.

## Mutation safety

Tại route boundary, mutation dùng schema validation, origin check khi cần, idempotency key và structured error. Repository ghi `request_hash`, replay cùng request trả response cũ, khác request trả `IDEMPOTENCY_KEY_REUSED`; audit nằm trong cùng transaction với write và chỉ ghi một lần. Các route auth token một lần vẫn phải audit và fail closed khi replay.

Các path ưu tiên gồm profile, school onboarding/activation, class/question mutation, resource upload/contribution, crawler, AI/RAG/job, export/retry/download, session revoke, exam answer/integrity/proctor và billing/grade mutation.

## STRIDE threat → control → test

| Boundary | Threat | Control | Test |
|---|---|---|---|
| Browser → auth API | Spoofing, replay, elevation | Cookie session httpOnly/Secure/SameSite; server role; token one-use; rate limit; audit | Forged role header, replay activation/reset, revoke replay |
| API → PostgreSQL | Tampering, disclosure, elevation | Parameterized SQL; transaction-local `school_id/user_id`; FORCE RLS; owner/teacher/proctor checks | Hai tenant đọc/ghi chéo; wrong idempotency payload |
| Browser → upload | DoS, disclosure, tampering | Size/magic-byte validation; quarantine/ClamAV; deterministic object key; single-use exemption | MIME giả, path traversal, same-key retry, cross-tenant download |
| Admin → crawler | SSRF, DoS | HTTPS/allowlist/no credentials/no non-443 IP/redirect; timeout/size cap | HTTP, localhost/private IP, redirect, rejected host |
| User/RAG/model → AI | Prompt injection, disclosure, excessive agency | Tenant-filtered retrieval; schema output; tool allowlist; bounded tokens; no exam secrets | Cross-tenant citation, malformed provider output, answer-key prompt |
| CBT → grading/proctor | Tampering, repudiation, false lock, disclosure | AES-GCM snapshot; server clock; append-only incidents; audit; student prompt-only API | Ciphertext/tag/key failures; student leak scan; unlock authorization |

## Error and release behavior

Internal crypto/key errors never expose stack traces, key version details or plaintext. Migration/backfill/rotation commands are explicit and disposable-database tested. Browser/manual evidence is required for fullscreen, password-manager popup, file picker, network loss and proctor journey. Verdict remains `DO NOT SHIP` even if `npm run verify` passes.

