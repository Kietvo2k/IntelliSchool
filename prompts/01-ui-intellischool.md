/max

Bạn là senior frontend/product engineer của IntelliSchool. Chạy tuần tự trong
agent chính, không tạo subagent hay workflow song song.

## Mục tiêu

Tái định vị toàn bộ UI công khai từ Smart Path thành IntelliSchool, đồng thời
đóng các lỗi usability/F-001/UI trong báo cáo lịch sử mà không thay schema hoặc
lách backend security.

## Đọc bắt buộc trước khi sửa

1. `AGENTS.md`, `HANDOFF.md`, `docs/INDEX.md`.
2. `docs/product/INTELLISCHOOL_PRODUCT_CONTRACT.md`.
3. `docs/design/INTELLISCHOOL_DESIGN_SYSTEM.md`.
4. `docs/quality/full-interaction-retest-2026-08-31.md` và
   `docs/quality/ACCEPTANCE_MATRIX.md`.

## Branch và skill gate

- Xác nhận nhánh `revamp/intellischool-2026-09`, working tree sạch hoặc chỉ có
  thay đổi của phase này; không force-push.
- Nạp: `hallmark`, `ui-ux-pro-max`, `frontend-ui-engineering`,
  `browser-testing-with-devtools`, `test-driven-development`,
  `systematic-debugging`, `verification-before-completion`.
- Chạy Hallmark audit trước, ghi finding theo file/line/severity. Không bắt đầu
  redesign khi chưa có baseline screenshot/route matrix.

## Phạm vi triển khai

1. Token hóa theme IntelliSchool theo design system: Be Vietnam Pro/Noto Sans,
   teal đậm, amber có kiểm soát, semantic color/spacing/type/motion tokens.
2. Rebrand toàn bộ chữ, title, logo/asset công khai sang IntelliSchool; giữ
   package/database identifier tương thích.
3. Bỏ fake browser chrome, bento/card đồng trọng số, eyebrow dư thừa, gradient
   trang trí, icon không nhất quán và motion không truyền đạt trạng thái.
4. Sửa F-001 ở form async theo gốc rễ: lưu form reference/values trước await,
   disable khi pending, success/error đúng, invalidate/refresh danh sách.
5. Sửa nav role-based để route backend cho phép được discoverable; giữ deep link
   và back/scroll state.
6. Sửa loading/empty/error/success, route stale, mobile header, touch target,
   keyboard/focus, reduced-motion và CBT 320px. Không sửa integrity logic Phase 2.

## Test và acceptance

- Viết test trước cho mọi lỗi hành vi; test phải fail trước fix nếu có thể.
- Browser/axe tại 320, 375, 414, 768, 1024, 1440; không horizontal scroll.
- Hallmark critical = 0; axe serious/critical = 0; target thao tác ≥44px.
- Đo LCP ≤2,5s, INP ≤200ms, CLS ≤0,1 trên production-like route đại diện.
- Chạy ít nhất `npm run verify` và E2E/axe liên quan; không coi unit mock là đủ.

## Bàn giao

Update `HANDOFF.md` với finding đã đóng/còn mở, command, exit code, screenshot/
trace và commit hash. Review diff, secret scan, commit một mục đích:
`feat(ui): tái định vị giao diện IntelliSchool`, sau đó push nhánh hiện tại.
 Chỉ báo PASS cho tiêu chí đã có bằng chứng mới.

## Output Format (bắt buộc)

Kết thúc bằng Markdown với đúng các mục: `Status`, `Finding đã đóng`, `Finding mở`,
`Files thay đổi`, `Lệnh và exit code`, `Ảnh/trace`, `Commit hash`, `Prompt kế tiếp`.
