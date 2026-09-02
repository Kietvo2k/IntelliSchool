# Thiết kế AI học tập gọn và hỗ trợ học sinh

## Mục tiêu

Tập trung màn hình AI học tập vào hội thoại, tự động chọn nguồn tài liệu an toàn,
luôn kích hoạt agentic retrieval và giảm từ chối sai đối với yêu cầu học tập hợp lệ.

## Quyết định đã duyệt

- Rút gọn header và panel chọn tài liệu thành thông tin ngắn, phần phạm vi vẫn có thể mở
  khi cần nhưng không chiếm chiều cao mặc định.
- Bỏ thanh chọn `Tiêu chuẩn`, `Thinking`, `Agentic` và nguồn khỏi UI học sinh.
  Request UI cố định `reasoningMode: STANDARD`, `agentic: true`, `sourceMode: AUTO`.
  Thinking job vẫn được giữ ở API/runtime để không phá job đang tồn tại.
- Vùng chat chiếm phần chiều cao còn lại, dùng `minmax(0, 1fr)` và giới hạn chiều rộng
  theo viewport để nội dung dài không làm vỡ layout tại desktop hoặc mobile.
- Policy chỉ từ chối yêu cầu xin đáp án khi có ngữ cảnh rõ ràng là bài kiểm tra,
  quiz hoặc assignment đang mở. Câu hỏi giải thích, nhờ hướng dẫn hoặc nhờ giải bài
  tập thông thường được chuyển cho model. Prompt injection, lộ system prompt/secret
  và tool abuse vẫn bị chặn trước model.

## Kiểm thử

- Unit test cho `looksLikeAnswerFishing`: giữ chặn bài kiểm tra đang mở, cho phép
  yêu cầu học tập thông thường.
- Render test xác nhận UI học sinh không còn toolbar mode/source nhưng vẫn gửi mặc định
  Agentic/AUTO.
- Kiểm thử browser ở 320px, desktop và request thật không tràn ngang.
