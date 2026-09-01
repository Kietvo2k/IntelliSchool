# IntelliSchool — Hợp đồng làm việc cho AI agent

## Mục tiêu và trạng thái

IntelliSchool là nền tảng số đa vai trò cho trường THPT: quản trị trường, LMS,
thích ứng, hướng nghiệp, thi CBT và AI học tập. Tên thư mục hiện hành là
\`smartclass-platform\`; các identifier kỹ thuật \`@smart-path/*\`, bảng và DB role
chưa đổi trong bốn phase để giữ tương thích migration.

Trạng thái release hiện tại là **DO NOT SHIP**. \`npm run verify\` có thể xanh
nhưng không thay thế kiểm thử tương tác, provider AI thật hoặc release gate.

## Bắt đầu mọi task

1. Xác nhận đang ở \`D:\\FilelaptrinhD\\SmartClass\\smartclass-platform\` và nhánh
   \`revamp/intellischool-2026-09\`.
2. Đọc theo thứ tự: \`HANDOFF.md\`, \`docs/INDEX.md\`, tài liệu của phase đang làm,
   rồi báo cáo quality mới nhất.
3. Gọi \`mode-picker\` → \`mode-orchestrator\`; task trong \`prompts/\` bắt buộc
   \`/max\` và chạy tuần tự trong agent chính, không dùng subagent.
4. Trước khi sửa code, xác định reproduction và test cho hành vi cần đổi.
5. Không tự nhận hoàn tất: chạy verification mới, đọc exit code và ghi bằng
   chứng vào \`HANDOFF.md\`.

## Bất biến kỹ thuật

- React/Vite ở \`apps/web\`; Fastify/TypeScript ở \`apps/api\`; PostgreSQL + RLS.
- Cookie session phải \`httpOnly\`, \`secure\` ở production và \`SameSite\`; không
  token localStorage, không demo-header auth.
- Mọi bảng tenant có \`school_id\`; route/repository phải chứng minh RLS âm tính
  giữa hai trường.
- SQL chỉ ở repository; domain logic thuần không phụ thuộc \`pg\`.
- Mutating route cần idempotency và audit event. Không log secret, mật khẩu,
  token, đáp án hoặc dữ liệu học sinh không cần thiết.
- Migration chỉ forward-only. Không sửa migration đã áp dụng, không reset dữ
  liệu trừ khi prompt ghi rõ môi trường disposable.
- Toàn bộ nội dung tiếng Việt lưu UTF-8 có dấu.

## Cổng bắt buộc theo domain

- UI: \`hallmark\` audit + \`ui-ux-pro-max\`, keyboard/axe/responsive/reduced-motion.
- Backend/security: STRIDE, input validation, RLS, SSRF, audit và migration test.
- AI: \`senior-prompt-engineer\`, AI security, provider thật, tenant-safe RAG và
  eval; mock không được dùng làm bằng chứng release.
- CBT: thời gian server-authoritative; integrity không tin clock/payload client;
  đáp án không được xuất hiện ở API học sinh.
- Trước commit: \`git diff --check\`, secret scan, test liên quan và review staged diff.

## Bằng chứng và Git

- Không force-push. Commit phải nhỏ, một mục đích, tiếng Việt có dấu.
- Nhánh hiện tại chứa checkpoint \`5c44eba\`; không trộn code của nhiều phase vào
  cùng commit.
- \`HANDOFF.md\` chỉ lưu trạng thái hiện tại, lệnh vừa chạy, kết quả, commit hash,
  finding mở và prompt kế tiếp. Báo cáo cũ giữ ở \`docs/quality/\` như bằng chứng
  lịch sử, không dùng để khẳng định trạng thái mới.

## Nguồn tài liệu

\`docs/INDEX.md\` là bản đồ nguồn sự thật. Các prompt có thể copy trực tiếp nằm
trong \`prompts/\`; chạy đúng thứ tự 01 → 04.
