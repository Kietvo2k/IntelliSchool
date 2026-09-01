# Design system IntelliSchool

## Hướng thiết kế

**Utilitarian giáo dục, tin cậy, bình tĩnh, giàu thông tin.** Đây là web app vận
hành trường học, không phải landing SaaS hoặc “AI dashboard” trang trí. Ưu tiên
khả năng quét dữ liệu, lỗi rõ, luồng công việc liên tục và tiếng Việt dễ đọc.

## Token được khóa

| Vai trò | Giá trị mặc định |
| --- | --- |
| Primary | teal đậm #0F766E |
| Primary hover | #115E59 |
| Accent/warning | amber #B45309 |
| Canvas/surface | #F8FAFC / #FFFFFF |
| Text/muted | #0F172A / #475569 |
| Border | #CBD5E1 |
| Success/danger/info | #15803D / #B91C1C / #1D4ED8 |
| Heading/UI | Be Vietnam Pro |
| Body/fallback | Noto Sans, system-ui |
| Spacing | bội số 4px; workspace ưu tiên nhịp 8/12/16/24/32 |
| Motion | 120–220ms, transform/opacity, luôn có reduced-motion |

Mọi giá trị phải thành semantic token; cấm hex/font tùy tiện trong component.
Font tải bằng \`font-display: swap\` hoặc self-host để không gây FOIT/CLS.

## Chống AI slop

- Cấm fake browser/IDE/phone chrome, hero gradient vô cớ, eyebrow viết hoa dày
  đặc, bento card đồng trọng số và số liệu/testimonial bịa đặt.
- Không dùng emoji làm icon hệ thống; dùng Lucide đã có, cùng stroke/size token.
- Chỉ animate khi diễn đạt thay đổi trạng thái. Không giữ trang cũ trong lúc
  route mới tải; dùng skeleton khớp layout hoặc crossfade ngắn.
- Mỗi control phải có default, hover, focus-visible, active, disabled, loading,
  error và success; focus ring không được animate.
- Mobile bắt buộc 320/375/414/768px: không horizontal scroll, text click không
  xuống hai dòng, target ≥44px, layout CBT có phương án rõ thay vì ép desktop.

## Acceptance bắt buộc

- Hallmark audit: 0 critical.
- Axe serious/critical: 0.
- Color contrast body ≥4,5:1; color không là tín hiệu duy nhất.
- Keyboard đi được toàn bộ luồng đăng nhập, form, drawer, CBT và modal.
- LCP ≤2,5s, INP ≤200ms, CLS ≤0,1 ở bài test đã nêu.
