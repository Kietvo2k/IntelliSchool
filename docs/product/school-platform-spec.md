# Smart Path — spec nền tảng số trường học

Cập nhật: 2026-08-28. SCDP/Neko chỉ đọc. Motion vòng đời: F5 skeleton→enter, chuyển trang (sidebar đứng), Back đảo hướng (`PathScrollRestoration` theo pathname, không dùng RR data-router `ScrollRestoration`), lướt whileInView once, refetch SoftRefresh. Chỉ `transform`/`opacity`/`stroke-dashoffset`. `prefers-reduced-motion` cắt chuyển động.

## Backend vs UI

Chỉ backend: model, hạn mức, chuẩn hóa knowledge 80/20, tóm tắt học lực, chấm tự động, crawl, SIMGR, sandbox JS, overflow phiên AI.  
Phải có UI: chat soạn bài/đề, AI học tập, phỏng vấn ngoại khóa, phân tích hướng nghiệp, editor bài giảng/tự luận, phòng thi hình, lộ trình vàng.

## Bài giảng / tài nguyên

Video trên (URL hoặc upload); tài liệu dưới (chữ, ảnh, công thức, Word/PDF). `available_from` / `available_until`. Tài nguyên READY của bài đã xuất bản + trong lịch → thư viện lớp.

## Bốn dạng câu (QĐ 764/QĐ-BGDĐT)

1. Trắc nghiệm: 4 phương án A–D (`LetterChoice`), chọn 1. Thi: 0,25/câu. Có thể kèm `imageSvg`/`imageUrl`.
2. Đúng/sai: stem tùy chọn + đúng 4 ý; điểm 0,1 / 0,25 / 0,5 / 1,0 theo số ý đúng, map vào `item.points`.
3. Trả lời ngắn: điền số. Toán thi 0,5; môn khác 0,25.
4. Tự luận: GV chấm tay; HS editor + KaTeX. Khi nộp bài có cả câu khách quan và tự luận, hệ thống trả điểm **tạm tính** của phần đã chấm tự động; sổ điểm chỉ thành chính thức khi giáo viên hoàn tất.

Xuất bản bài tập/đề: **tối thiểu 5 câu**. Chat AI soạn **hỏi ý kiến** trước khi sinh; UI thẻ câu, không dump JSON.

## Web thi

Xem [exam-cbt/visual-spec.md](exam-cbt/visual-spec.md). SVG họa tiết + emblem. Footer tên trường, không giả Bộ.

## Tin nhắn

Messenger: kênh lớp + 1-1. `channel_kind` CLASS | DIRECT.

## Hướng nghiệp

Khám phá: intro → năng lực 20 câu tư duy (5 dễ, 5 trung bình, 10 khó; 15 chọn đáp án + 5 giải thích) → Holland Likert 1–5 → chat Hoạt động & trải nghiệm 10 + ≤5 follow-up → điểm học (chip môn đã có) → hồ sơ SCDP. Bước tương lai bị khóa đến khi người học trả lời/bỏ qua từng câu hoặc chọn bỏ qua cả bước có chủ đích; tỉnh/thành cần có khi xem kết quả, còn mục tiêu học tập có thể để trống. SIMGR 0.30/0.15/0.15/0.30/0.10; chiều trống = 0.5; không bắt buộc RIASEC. Tổ hợp xét tuyển lấy từ catalog mã–môn, không dùng danh sách sáu mã cố định; xếp hạng trường phải nêu tổ hợp khớp, điểm còn thiếu và chất lượng nguồn.

## Nav

- HS: AI học tập `/app/ai-study` (cũ `/app/ai-assistant` redirect). Không chữ “Trợ giảng”.
- GV: Soạn bài AI. Ẩn cấu hình AI / skill / adaptive / danh mục nghề.
- Hiệu trưởng: nhóm Soạn bài AI (Cấu hình, Soạn bài, Kho tri thức).

## Hồ sơ / knowledge / AI

AI học tập tự truy hồi tài liệu READY trong phạm vi trường/lớp/môn và ghi lại tool trace; người học chỉ mở phần điều chỉnh phạm vi khi cần. Phản hồi dùng Markdown/LaTeX an toàn, không render raw HTML hoặc JSON thô. Sandbox chỉ chạy mã đã được backend cho phép.

## Phòng thi CBT

Mỗi ca thi có một môn và metadata kỳ (`Luyện tập`, giữa/cuối kỳ I–II, thi thử tốt nghiệp hoặc kỳ khác). Cổng thi chọn **kỳ → môn**, sảnh chỉ hiện ca đã chọn. Rời trang được backend xác nhận, debounce một giây: cảnh báo 1/3 và 2/3 không khóa; lần 3 khóa và finalize server-side idempotent. Mất kết nối không tạo strike.

Hồ sơ cá nhân + học bạ số. Knowledge card `KnowledgeCardView` (không `<pre>` JSON). Chat: `presentAssistantText`, phiên, RAG `documentIds`, sandbox JS 3s, banner ~128k tự mở phiên mới (`013_ai_sessions_context.sql`).
