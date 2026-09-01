# HANDOFF — IntelliSchool

## Trạng thái hiện tại

- Nhánh: \`revamp/intellischool-2026-09\`.
- GitHub: \`https://github.com/Kietvo2k/IntelliSchool\`.
- Checkpoint code trước tái cấu trúc: \`5c44eba\`.
- Release verdict: **DO NOT SHIP**.
- Product name công khai: **IntelliSchool**; identifier \`@smart-path/*\` giữ tạm
  cho tương thích kỹ thuật.

## Bằng chứng mới nhất

| Lệnh | Kết quả | Khi chạy |
| --- | --- | --- |
| \`npm run verify\` | PASS: 202 API/unit, 59 web test, production build | checkpoint \`5c44eba\` |
| \`git diff --check\` | PASS | trước checkpoint |
| Secret pattern scan | Không có match confidence cao; \`.env\` bị ignore | trước checkpoint |
| \`npm audit --audit-level=high\` | Không có high/critical; còn 3 moderate qua \`minio\` | trước checkpoint |

## Finding chặn release

- Form async có thể commit nhưng UI báo lỗi; xem F-001 trong báo cáo 31/08.
- Profile SQL, email activation, download/export và discoverability còn lỗi.
- CBT strict fullscreen dùng 3 strike; không đạt policy grace 5 giây / lock 30
  giây / giám thị mở khóa.
- AI hiện có đường fallback cục bộ và Thinking worker lỗi SQL; chưa có bằng
  chứng provider thật.

## Thứ tự thực thi

1. Copy \`prompts/01-ui-intellischool.md\`.
2. Copy \`prompts/02-backend-security-cbt.md\`.
3. Copy \`prompts/03-ai-production.md\`.
4. Copy \`prompts/04-release-verification.md\`.

Mỗi phase phải update chính file này với commit hash, lệnh, exit code, số test,
finding mở và prompt kế tiếp. Không thay historical audit bằng kết luận mới nếu
chưa chạy lại bằng chứng.
