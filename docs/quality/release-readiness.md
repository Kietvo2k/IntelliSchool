# Báo cáo release-readiness — Smart Path Platform

Cập nhật lần cuối: 2026-08-30. Phạm vi: working tree hiện tại của `smartclass-platform`; chưa commit, push hoặc deploy.

> **Verdict audit độc lập: DO NOT SHIP.** Các suite hiện tại đều xanh nhưng audit đã xác nhận AI JavaScript sandbox có thể truy cập Node `process`/`process.getBuiltinModule`, drawer mobile đóng vẫn nằm trong tab/AX tree và production chưa có CSP. Xem báo cáo đầy đủ tại `docs/quality/full-platform-audit-2026-08-29.md`.

## Kết quả kiểm chứng

| Cổng | Kết quả |
|---|---|
| Typecheck + unit/API | 50 file, 202 test pass |
| Web unit/component | 38 file, 57 test pass |
| Integration cô lập | 19 file, 36/36 test pass |
| Browser E2E | 28/28 test pass |
| Responsive | AI/hướng nghiệp và màn chính không tràn ngang; CBT tại 320px tràn 26px, phù hợp giới hạn desktop nhưng vẫn là PARTIAL UX |
| Axe/keyboard/console | Axe serious/critical 0 ở 4 breakpoint; drawer keyboard; route matrix bốn vai trò không page error/console error |
| npm audit | 0 vulnerability High/Critical |
| npm audit signatures | 443 package có registry signature; 95 package có attestation |
| Bundle | initial JS 142,61 KiB gzip; workspace 82,76 KiB gzip; renderer Markdown/KaTeX lazy 119,44 KiB gzip; CSS 16,48 KiB gzip; không chunk JS >500 kB |
| Diff hygiene | `git diff --check` pass |

## Retest Browser và Docker production-mode

- Docker app và PostgreSQL healthy; `/healthz` tại `http://127.0.0.1:5176/healthz` trả 200 với `status=ok`.
- Browser thật đã đi qua 56 route theo bốn vai trò (8/20/13/15). Route matrix không có console error hoặc HTTP failure ngoài 403 đúng quyền.
- Lỗi cần chặn trước khi ship: chuyển route giữ màn cũ hơn 1 giây; Billing/Career/Skill drafts thiếu loading hoặc retry; Career submit không bắt rejection/busy; AI background worker query `u.role` không tồn tại tại `postgres-platform.ts:3153`.
- Lỗi UX cần ưu tiên tiếp: `is-error` dùng `role=status`, touch target nhỏ, header mobile bị cắt, link Mailpit local lọt vào registrations và README E2E mô tả reduced-motion chưa có assertion.
- Điểm chức năng/UI/UX của vòng retest: **7,0/10**. Verdict vẫn **DO NOT SHIP** cho đến khi xử lý các lỗi P1 và cập nhật bằng chứng.

## Ma trận chức năng

- Công khai: landing, đăng nhập, yêu cầu mở trường, duyệt đăng ký.
- Platform admin: dashboard, trường học, người dùng, audit log, billing và catalog.
- Hiệu trưởng: dashboard, LMS, billing, AI knowledge, giám thị và route guard.
- Giáo viên: LMS, assignment, gradebook, progress, grading, AI assistant, phòng thi.
- Học sinh: CBT Hóa đúng môn/kỳ, điểm tạm tính, AI tự truy hồi, quiz hướng nghiệp, kết quả/trường/nguyện vọng.
- Cross-cutting: session, tenant/RLS, idempotency, resource scan, responsive 320–1440px, keyboard, console/network.

## Findings đã xử lý

- Playwright nhận sai pattern `*.e2e.ts` → cấu hình `testMatch` rõ ràng.
- Seed integration chậm/race → readiness marker, stack disposable, quyền migration và PostgreSQL test riêng.
- Debug endpoint localhost gây request failure → đã loại bỏ toàn bộ call/runtime payload.
- Regex HTML sanitizer → allowlist parser phía server + regression corpus.
- Mobile nav/header và dashboard copy → drawer semantic, responsive overflow guard và layout grid/flex.
- 422 `/api/v1/lessons` trong AI knowledge → truy vấn theo từng `classId`.
- Assertion E2E quá rộng → locator theo heading/route cụ thể.
- CBT lẫn môn → metadata kỳ thi, cổng kỳ → môn và sảnh chỉ hiện ca đã chọn.
- Khóa bài nhầm → event allowlist, debounce server-side, cảnh báo 1/3–2/3 và finalize idempotent ở lần 3.
- Điểm tự luận không hiện → điểm khách quan `PROVISIONAL`, điểm chính thức sau giáo viên chấm, bảng điểm có kỳ/bài/trạng thái.
- AI phải chọn tay tài liệu → backend tự truy hồi RAG/lớp/môn + tool trace; Markdown/LaTeX lazy, raw HTML bị bỏ.
- Stepper hướng nghiệp nhảy bước → khóa bước tương lai, yêu cầu trả lời/bỏ qua từng câu, catalog tổ hợp lấy từ từ điển mã–môn.

## Chưa làm / giới hạn có chủ đích

- Chưa deploy hoặc commit; không reset database local/VPS.
- Catalog ngành/trường là seed có URL/disclaimer; chưa thay thế quy trình kiểm chứng đề án tuyển sinh từng trường theo từng năm.
- Renderer KaTeX tải khi cần để giữ initial bundle; lần mở phản hồi AI có công thức có thêm chunk lazy.
