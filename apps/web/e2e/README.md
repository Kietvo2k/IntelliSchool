# Bộ kiểm thử end-to-end

Bộ e2e Playwright + axe-core kiểm luồng công khai, LMS, admin, accessibility ở 4 breakpoint
(375/768/1024/1440 px), điều hướng bàn phím, clean-console, CBT môn Hóa, AI tự truy hồi
và responsive 320/375/768/1024/1440 px. Reduced-motion hiện được hỗ trợ ở source nhưng
chưa có assertion riêng trong bộ e2e.

Bộ này chạy trên UI thật và dùng stack test cô lập. Không nằm trong
`npm run verify` để verify vẫn chạy được khi chưa dựng Docker.

## Cài đặt lần đầu

```powershell
npm install                 # cài @playwright/test + @axe-core/playwright
npx playwright install chromium
```

## Chạy

```powershell
# Terminal 1 — dependency services (cổng test riêng)
npm run test:stack:up

# Terminal 2 — app-test + e2e (tự force-seed trước khi chạy)
npm run test:e2e:isolated

# Dọn container, network và volume disposable
npm run test:stack:down
```

Báo cáo HTML nằm ở `apps/web/playwright-report/`. Ảnh/video chỉ lưu khi test fail.

## Nội dung

- `01-registration-activation.e2e.ts` — gửi yêu cầu mở trường + hàng đợi duyệt của hiệu trưởng. Kích hoạt qua Mailpit kiểm thủ công (link một lần trong email).
- `02-platform-admin.e2e.ts` — admin xem trường, người dùng, nhật ký bảo mật.
- `03-lesson-resource.e2e.ts` — giáo viên soạn bài giảng/tài nguyên, học sinh xem.
- `04-assignment-gradebook.e2e.ts` — ngân hàng câu hỏi, bài tập, sổ điểm, báo cáo, điểm của học sinh.
- `05-accessibility-keyboard.e2e.ts` — axe ở 4 breakpoint, drawer mobile, điều hướng bàn phím, dashboard 4 vai trò không lỗi console.
- `06-route-matrix.e2e.ts` — đăng nhập từng vai trò và đi qua toàn bộ link workspace đang hiển thị, không có page error hoặc console error.
- `07-ai-career.e2e.ts` — AI tự lấy tài liệu, chat thật và chặn nhảy bước hướng nghiệp chưa hoàn thành.
- `08-responsive.e2e.ts` — năm breakpoint không tràn ngang ở CBT, AI và các màn hướng nghiệp chính.

## Tài khoản seed

Xem `fixtures.ts`. Tất cả là test-only, mật khẩu `TestOnlyPassword!2026`. Không dùng tài khoản này ở môi trường thật.
