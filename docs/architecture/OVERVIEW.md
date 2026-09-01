# Kiến trúc IntelliSchool hiện tại

## Thành phần

\`\`\`text
React/Vite (apps/web)
  └─ cookie session + API client
       └─ Fastify (apps/api)
            ├─ domain logic thuần
            ├─ repository SQL duy nhất
            ├─ AI provider/RAG/job worker
            └─ resource/report workers
                 └─ PostgreSQL + RLS theo school_id
\`\`\`

\`apps/web\` không tự tin trạng thái nghiệp vụ sau HTTP. \`apps/api\` là authority cho
session, quyền, timebox CBT, audit, AI usage và tenant scope. PostgreSQL RLS là
lớp phòng vệ cuối, không thay thế authorization ở route/repository.

## Compatibility

- Giữ \`@smart-path/*\`, \`smartpath_*\`, migration và cookie name hiện có.
- Các route public/user-facing đổi chữ Smart Path sang IntelliSchool trong Phase
  UI. Contract kỹ thuật chỉ thay khi có docs, migration và test tương ứng.
- NekoPath/SCDP là nguồn tham khảo read-only ngoài workspace; không copy nguyên
  khối hoặc migrate dữ liệu từ chúng.

## Ranh giới tin cậy

| Biên | Không tin | Kiểm soát |
| --- | --- | --- |
| Browser → API | role, clock, integrity payload, idempotency reuse | cookie auth, schema, server clock, audit |
| API → PostgreSQL | tenant context | transaction RLS, \`school_id\`, parameterized SQL |
| Upload/crawler → worker | MIME, URL, file content | size/type scan, HTTPS allowlist, quarantine |
| RAG/model → API | instruction/model output | tenant filter, schema, tool allowlist, output encoding |
| CBT → grading | answer order/client cache | immutable snapshot, server session, server-side grading |

## Decision cần thực thi ở phase sau

Xem ADR-001 đến ADR-003 trong \`docs/decisions/\`. Chỉ Phase 2/3 mới được đổi
API/schema liên quan; Phase 1 không lách thay đổi backend để che lỗi UX.

## Phase 2 security boundary

- Exam publish ghi snapshot AES-256-GCM append-only; assignment và session pin revision cụ thể.
- Keyring không nằm trong repo/database; server fail-closed khi không giải mã được snapshot.
- Student API map từ snapshot đã giải mã và loại bỏ answer key/rubric; grading/proctor chỉ xử lý server-side.
- Integrity incident và unlock/restore đều tenant-scoped, idempotent và audit trong transaction.
