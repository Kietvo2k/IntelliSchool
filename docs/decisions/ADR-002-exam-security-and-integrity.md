# ADR-002: Exam snapshot mã hóa và integrity server-authoritative

## Status

Accepted — 2026-09-01

## Context

Answer key/rubric hiện lưu JSON plaintext; strict CBT dùng 3 strike dễ auto-lock
sai trên browser surface và không có unlock workflow.

## Decision

Publish tạo immutable AES-256-GCM exam snapshot có key version; client không có
answer key. Integrity gộp tín hiệu thành incident: grace 5s, warning đến 30s,
lock không auto-submit; proctor unlock có idempotency, reason và audit.

## Consequences

- Cần forward-only migration, keyring ngoài repo, backfill và rotation test.
- Server clock/background finalizer là authority; client chỉ hiển thị progress.
- Không thể tuyên bố production-ready chỉ nhờ test đơn vị.

## Implementation evidence — 2026-09-02

- Migrations `022`–`025` tạo snapshot append-only, incident state, RLS/grants và quyền maintenance riêng cho control role.
- AES-256-GCM dùng nonce 12 byte, auth tag 16 byte, AAD canonical metadata và keyring JSON ngoài repo qua `EXAM_SNAPSHOT_KEYRING_FILE`.
- Session pin `exam_snapshot_id`; student projection chỉ có prompt/type/points/answer đã lưu, không có answer key, rubric hoặc ciphertext.
- Integrity dùng `ACTIVE/GRACE/WARNING/LOCKED`, mốc 5/30 giây theo server time; lock không ghi submit và unlock có reason/idempotency/audit.
- Backfill idempotent và rotation append-only giữ lại revision/key cũ cho session đang chạy.
