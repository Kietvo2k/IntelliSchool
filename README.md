# IntelliSchool

IntelliSchool là nền tảng vận hành trường THPT gồm quản trị đa tenant, LMS,
học tập thích ứng, hướng nghiệp, thi CBT và AI học tập. Thư mục phát triển vẫn
là \`smartclass-platform\`; các tên kỹ thuật Smart Path chỉ là compatibility
identifier trong giai đoạn tái cấu trúc.

## Trạng thái

**DO NOT SHIP.** Checkpoint hiện tại build/test được ở mức \`npm run verify\`,
nhưng các lỗi tương tác, CBT integrity và AI production phải được xử lý qua bốn
phase trong \`prompts/\` trước khi release.

## Khởi động local

\`\`\`powershell
Copy-Item .env.example .env   # chỉ lần đầu, không commit .env
docker compose up --build -d --remove-orphans
\`\`\`

Mở \`http://127.0.0.1:8080\`; health check tại \`/healthz\`. Stack local giới hạn
1 CPU và 1,8 GiB RAM. Không dùng seed/reset trên dữ liệu production.

## Lệnh kiểm chứng

\`\`\`powershell
npm run verify
npm run test:integration:isolated
npm run test:e2e:isolated
npm run test:release:isolated
npm audit --audit-level=high
\`\`\`

\`verify\` không cần Docker. Các lệnh isolated dùng stack disposable và không được
coi là bằng chứng AI provider thật nếu chưa cấu hình key/endpoint test.

## Dành cho agent và người triển khai

Đọc [AGENTS.md](AGENTS.md), [HANDOFF.md](HANDOFF.md) và
[docs/INDEX.md](docs/INDEX.md). Chạy các phase lần lượt từ
[prompts/README.md](prompts/README.md); không bỏ qua phase test/release.
