# Web thi CBT — spec hình ảnh (không improvisation)

Thi thử **của trường**, giao diện bám mẫu 4 màn. Không giả pháp nhân Cục QLCL / Bộ GDĐT trên footer.

Ảnh/layout khóa (đối chiếu, không improvisation):

- [01-login.svg](01-login.svg)
- [02-lobby.svg](02-lobby.svg)
- [03-taking.svg](03-taking.svg)
- [04-results.svg](04-results.svg)

Mẫu chỉ vẽ trắc nghiệm. Phần làm bài phải đủ bốn dạng QĐ 764: TN 4 lựa chọn, đúng/sai 4 ý, trả lời ngắn (số), tự luận (editor).

## Chrome chung

- Header full-width xanh: trái **GIAO DIỆN THI TRÊN MÁY TÍNH**; phải emblem trường + tên trường.
- Ẩn sidebar LMS. Nền xanh đậm, họa tiết tam giác (SVG/CSS).
- Route: `/app/exam`. CSS chỉ `.cbt-*`.

## Màn 1 Đăng nhập

Card trắng: **THI THỬ CỦA TRƯỜNG** (dành cho thí sinh); **ĐĂNG NHẬP LÀM BÀI THI**; Mã thí sinh; Mật khẩu (PIN, hiện/ẩn); Đợt thi; **Đăng nhập**.

## Màn 2 Sảnh

Hai thẻ: thông tin thí sinh | hội đồng thi. Lưới môn + pill **Vào thi**. **Quay lại**.

## Màn 3 Làm bài

Bar: họ tên, SBD, môn, ngày, ca | timer | Đang kết nối | NỘP BÀI | fullscreen.  
Công cụ: Quay lại / Tiếp theo | đã trả lời x/n | Lưu | A+/A−.  
Trái ngữ liệu, phải câu + UI đúng loại + cờ.  
Navigator **ngang đáy**: xanh lá đã trả lời, viền xanh câu hiện tại, xám chưa làm.

## Màn 4 Kết quả

Modal: nộp thành công; số câu; điểm chính thức hoặc điểm **tạm tính** (nêu rõ số câu tự luận chờ chấm); **Hoàn thành**. Với khóa integrity, trạng thái nộp do server finalize sau lần cảnh báo hợp lệ thứ ba, không phụ thuộc client tự nộp.
