# Backend Security CBT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Thực hiện tuần tự trong agent chính; không dùng subagent/workflow song song. Các bước dùng checkbox để theo dõi.

**Goal:** Hardening backend/security/CBT của IntelliSchool theo spec ngày 2026-09-01, có evidence migration, API, unit, integration và browser.

**Architecture:** Giữ modular monolith Fastify/PostgreSQL. Tách crypto snapshot và integrity state machine thành module thuần; repository điều phối transaction, RLS, idempotency và audit. Snapshot append-only được pin vào session; student API chỉ map prompt an toàn.

**Tech Stack:** TypeScript, Fastify 5, PostgreSQL 16/RLS, `node:crypto` AES-256-GCM, Zod, Vitest, Docker Compose, Chromium/Playwright.

## Global Constraints

- Chạy tuần tự trong agent chính, không tạo subagent/parallel workflow.
- Không force-push; giữ nhánh `revamp/intellischool-2026-09`.
- Migration forward-only; không sửa migration đã áp dụng.
- Không ghi secret, token, plaintext exam snapshot, answer key hoặc PII vào log/repo.
- Student API tuyệt đối không trả answer key/rubric/plaintext snapshot.
- Lock integrity không auto-submit; chỉ finalizer hết giờ mới ghi `TIME_LIMIT`.
- Mọi thay đổi behavior phải có test RED trước production code và test GREEN sau đó.
- Verdict cuối vẫn `DO NOT SHIP`.

### Task 1: Snapshot crypto boundary

**Files:**
- Create: `apps/api/src/security/exam-snapshot.ts`
- Create: `apps/api/test/security/exam-snapshot.test.ts`
- Modify: `apps/api/src/errors.ts`

**Interfaces:**
- `ExamSnapshotKeyring`, `ExamSnapshotMetadata`, `ExamSnapshotPlaintext`, `EncryptedExamSnapshot`.
- `encryptExamSnapshot(input, keyring)` và `decryptExamSnapshot(input, keyring)`.
- `loadExamSnapshotKeyring(options)` chỉ đọc file ngoài repo và validate key 32 bytes.

- [ ] Viết test keyring thiếu/version thiếu, round-trip AES-GCM, metadata tamper, ciphertext tamper, auth tag tamper và plaintext không xuất hiện trong ciphertext.
- [ ] Chạy `npm run test -w @smart-path/api -- test/security/exam-snapshot.test.ts`; xác nhận RED đúng nguyên nhân.
- [ ] Implement canonical JSON, SHA-256 metadata hash, random nonce, `setAAD`, `getAuthTag`, `setAuthTag`, generic fail-closed errors.
- [ ] Chạy lại test crypto; sau GREEN kiểm tra `git diff --check`.
- [ ] Commit riêng: `feat: thêm crypto snapshot đề thi`.

### Task 2: Forward-only snapshot migration and keyring wiring

**Files:**
- Create: `database/migrations/022_exam_snapshots.sql`
- Modify: `.env.example`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/repositories/postgres-platform.ts`
- Create: `apps/api/src/backfill-exam-snapshots.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/test/exam-snapshot-migration.integration.test.ts`

**Interfaces:**
- `RepositoryOptions.examSnapshotKeyring`.
- `createExamSnapshot(client, assignmentId, actorId)`.
- CLI scripts `exam:snapshots:backfill` và `exam:snapshots:rotate`.

- [ ] Viết migration test trên database disposable: bảng/cột/index/RLS/grants/pointer tồn tại, append-only fields không có quyền delete qua API role.
- [ ] Chạy migration test RED trước khi tạo migration.
- [ ] Tạo bảng snapshot, `active_exam_snapshot_id`, `exam_sessions.exam_snapshot_id`, policy tenant và index; không chứa keyring secret.
- [ ] Load keyring production từ file/mount; test inject memory keyring; server fail-closed khi production thiếu keyring.
- [ ] Implement backfill idempotent theo assignment/version, rotation append-only và audit `EXAM_SNAPSHOT_BACKFILLED/ROTATED`.
- [ ] Chạy `npm run test -w @smart-path/api -- test/exam-snapshot-migration.integration.test.ts` trên database disposable và commit riêng: `feat: thêm migration snapshot đề thi`.

### Task 3: Exam publish/session/student response

**Files:**
- Modify: `apps/api/src/repositories/platform.ts`
- Modify: `apps/api/src/repositories/postgres-platform.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/test/http/exam-routes.test.ts`
- Modify: `apps/api/test/exam.integration.test.ts`
- Modify: `apps/api/test/http/platform-routes.test.ts`

**Interfaces:**
- Student exam response: `{ sessionId, assignmentId, title, endsAt, serverNow, integrity, items[] }`.
- `items[]` chỉ gồm `id, number, type, points, prompt, answer`; không gồm `answerKey/rubric`.

- [ ] Viết test student assignment/exam không chứa `answerKey`, `rubric`, `ciphertext`, `nonce`, `authTag`, key version hoặc plaintext snapshot; teacher vẫn lấy rubric khi cần.
- [ ] Chạy test RED.
- [ ] Publish tạo snapshot trước khi đổi assignment sang `PUBLISHED`; start session pin snapshot; get session decrypt server-side; grading đọc snapshot pin.
- [ ] Bỏ rubric khỏi student projection và fail-closed khi snapshot missing/tampered.
- [ ] Chạy HTTP/unit/integration exam tests GREEN; commit riêng: `fix: khóa projection exam cho học sinh`.

### Task 4: Integrity incident state machine

**Files:**
- Replace: `apps/api/src/domain/exam/integrity.ts`
- Replace: `apps/api/test/domain/exam-integrity.test.ts`
- Modify: `database/migrations/022_exam_snapshots.sql`
- Modify: `apps/api/src/repositories/platform.ts`
- Modify: `apps/api/src/repositories/postgres-platform.ts`

**Interfaces:**
- `IntegrityState = ACTIVE | GRACE | WARNING | LOCKED`.
- `evaluateIntegrityAt(incident, serverNow)`.
- Repository methods `restoreExamIncident`, `closeExamIncident`, `unlockExamSession`.

- [ ] Viết fake-clock tests ở 4,900ms; 5,000ms; 29,900ms; 30,000ms; duplicate signal; restore; network; attachment exemption; lock không submit; unlock.
- [ ] Chạy domain test RED.
- [ ] Implement server-generated incident, dedupe theo incident, server-time thresholds, append-only close/restore/lock/unlock events.
- [ ] Update finalizer để `LOCKED` không bị finalise bởi integrity; timeout vẫn `TIME_LIMIT`.
- [ ] Chạy domain tests GREEN và integration state transition test; commit riêng: `feat: chuyển integrity sang incident state machine`.

### Task 5: API contracts, authorization, idempotency/audit

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/repositories/platform.ts`
- Modify: `apps/api/src/repositories/postgres-platform.ts`
- Modify: `apps/api/src/repositories/postgres-school-administration.ts`
- Modify: `apps/api/src/repositories/school-administration.ts`
- Modify: `apps/api/src/repositories/postgres-auth.ts`
- Modify: `apps/api/src/repositories/postgres-resources.ts`
- Modify: `apps/api/src/services/resource-upload-service.ts`
- Modify: `apps/api/test/http/exam-routes.test.ts`
- Modify: `apps/api/test/http/platform-routes.test.ts`
- Create or modify: `apps/api/test/idempotency-audit.integration.test.ts`

**Interfaces:**
- Mutation replay same hash returns same response; same key/different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
- Restore/close/unlock require explicit reason where applicable and audit actor/target/reason.

- [ ] Viết tests cho profile SQL parameters, school approval/resend email, report export request hash, resource upload retry, crawler 422, session revoke, exam exemption/integrity/heartbeat and unlock authorization.
- [ ] Chạy targeted RED.
- [ ] Sửa từng root cause: parameter casts, activation delivery state, direct binary download, SSRF validation, repository idempotency, missing audit and cross-tenant authorization.
- [ ] Không đưa token/secret vào response hoặc audit metadata.
- [ ] Chạy targeted GREEN và integration isolated; commit riêng: `fix: khóa idempotency audit và tenant boundary`.

### Task 6: Contract/docs and UI-compatible API behavior

**Files:**
- Modify: `docs/openapi-student-records.yaml` nếu route liên quan contract hiện tại.
- Modify: `docs/decisions/ADR-002-exam-security-and-integrity.md`
- Modify: `docs/security/EXAM_SECURITY.md`
- Modify: `docs/architecture/OVERVIEW.md`
- Modify: `HANDOFF.md`

- [ ] Ghi route/schema/error/state transition mới, keyring/rotation/backfill runbook và reason/audit requirements.
- [ ] Không sửa các thay đổi UI Phase 1 chưa commit ngoài scope.
- [ ] Chạy UTF-8 check, `git diff --check`, secret scan và staged diff review.
- [ ] Commit docs nếu diff review rõ: `docs: cập nhật contract bảo mật CBT`.

### Task 7: Full verification and browser/manual evidence

- [ ] Chạy `npm run verify`.
- [ ] Chạy integration isolated liên quan và migration trên database disposable.
- [ ] Chạy `npm audit --audit-level=high` và triage advisory.
- [ ] Secret scan repository/staged diff.
- [ ] Chạy browser/manual Chrome: fullscreen, password-manager popup, file picker, network loss, restore, lock, proctor unlock, download/export.
- [ ] Đọc exit code/output đầy đủ; sửa và chạy lại mọi gate thất bại.
- [ ] Cập nhật `HANDOFF.md` evidence mới, commit hashes, finding mở và prompt kế tiếp.
- [ ] Push `revamp/intellischool-2026-09` không force-push; không tuyên bố READY.

