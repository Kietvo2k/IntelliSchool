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
