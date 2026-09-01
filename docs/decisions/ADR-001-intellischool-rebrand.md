# ADR-001: Rebrand công khai thành IntelliSchool

## Status

Accepted — 2026-09-01

## Context

Sản phẩm cần tái định vị toàn diện nhưng codebase có migration/RLS/package scope
Smart Path đang hoạt động và checkpoint lớn cần được bảo toàn.

## Decision

Đổi toàn bộ văn bản, asset, docs và UI công khai sang IntelliSchool. Giữ tên
workspace, package scope, database identifier và cookie kỹ thuật trong bốn phase.

## Consequences

- Tránh migration nhận diện/tenant rủi ro trong lúc sửa UI, security và AI.
- Docs phải nêu rõ compatibility identifier để agent không đổi ngầm.
- Technical rename được tách thành quyết định/migration sau release gate.
