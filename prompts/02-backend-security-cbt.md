/max

Bạn là senior backend/security architect của IntelliSchool. Chạy tuần tự trong
agent chính, không tạo subagent hay workflow song song.

## Đọc bắt buộc

1. `AGENTS.md`, `HANDOFF.md`, `docs/INDEX.md`.
2. `docs/architecture/OVERVIEW.md`, `docs/security/EXAM_SECURITY.md`.
3. ADR-002 và các finding F-001–F-015 trong quality report 31/08.

## Branch và skill gate

- Xác nhận Phase 1 đã có commit/evidence; ở nhánh revamp, không force-push.
- Nạp: `senior-architect`, `senior-fullstack`, `security-and-hardening`,
  `api-and-interface-design`, `database-designer`, `test-driven-development`,
  `systematic-debugging`, `verification-before-completion`.
- Lập STRIDE ngắn cho auth, RLS, upload, crawler, AI, CBT/answer key/proctor
  trước khi đổi API/schema; ghi threat → control → test.

## Phạm vi

1. Đóng lỗi backend đã tái hiện: profile SQL parameter mismatch, activation email,
   download/export, SSRF validation, tenant isolation và mọi mutating route thiếu
   idempotency/audit.
2. Thiết kế migration forward-only cho immutable exam snapshot AES-256-GCM:
   ciphertext, nonce, authTag, keyVersion, metadata hash; keyring secret ngoài repo,
   fail-closed; backfill idempotent và rotation path.
3. API học sinh chỉ nhận prompt snapshot đã giải mã server-side; tuyệt đối không
   trả answer key/rubric/plaintext snapshot.
4. Thay 3 strike bằng integrity incident state machine: dedupe signal, grace <5s,
   warning 5–30s, lock tại 30s liên tục, không auto-submit, network/file-picker
   exemption server-issued, server time trong response/heartbeat/finalizer.
5. Thêm close/restore incident và `POST /api/v1/exams/sessions/:id/unlock` với
   reason, idempotency, proctor/teacher/owner authorization và audit.

## Test bắt buộc

- Unit fake clock: 4,9s, 5s, 29,9s, 30s, duplicate signal, restore, network,
  attachment exemption, lock và unlock.
- Integration: RLS hai tenant, ciphertext không có plaintext, key missing/auth tag
  fail-closed, rotation/backfill và student API không lộ đáp án.
- Browser/manual Chrome: fullscreen/password-manager popup/proctor journey.
- Chạy `npm run verify`, integration isolated liên quan, migration trên database
  disposable, `npm audit --audit-level=high`, secret scan và staged diff review.

## Bàn giao

Cập nhật OpenAPI/contract docs nếu route thay đổi, ADR nếu decision đổi. Update
`HANDOFF.md` bằng evidence mới; commit tách migration, backend và test nếu review
 không còn rõ. Push nhánh revamp, không tuyên bố READY.

## Output Format (bắt buộc)

Kết thúc bằng Markdown với đúng các mục: `Status`, `Threats và controls`, `API/migration`,
`Tests và exit code`, `Evidence`, `Finding mở`, `Commit hash`, `Prompt kế tiếp`.
