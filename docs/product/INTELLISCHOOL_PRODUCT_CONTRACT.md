# Hợp đồng sản phẩm IntelliSchool

## Đối tượng và công việc chính

| Vai trò | Công việc không được hỏng |
| --- | --- |
| Platform admin | duyệt trường, quản lý tenant/người dùng, audit và billing |
| School owner | vận hành lớp, nhân sự, học liệu, cấu hình AI, giám thị |
| Teacher | soạn/publish bài, ngân hàng câu hỏi, giao bài, chấm, theo dõi |
| Student | học, làm bài, thi CBT, nhận điểm, hướng nghiệp và hỏi AI |

IntelliSchool không được mô phỏng cơ quan nhà nước/Bộ Giáo dục. CBT là hệ thống
thi thử/thi nội bộ của trường, có nhãn rõ ràng.

## Nguyên tắc UX

- Một màn hình có một hành động chính; trạng thái loading, empty, error, success
  đều là một phần của chức năng.
- Không dùng card/grid trang trí để che luồng nghiệp vụ. Nav phải làm lộ mọi
  quyền mà backend đã cấp, đặc biệt skill graph, adaptive và proctor.
- UI tiếng Việt rõ nguyên nhân và cách phục hồi; không dùng lỗi chung chung.
- Học sinh không nhìn thấy đáp án, rubric, tool trace, API key hoặc chi tiết
  nội bộ AI.
- Product name/wordmark/asset công khai là **IntelliSchool**. Không đổi schema,
  package scope, cookie name hoặc DB role trong bốn phase này.

## SLO pilot production

- 1–5 kỹ sư, tối đa 5 trường/5.000 người dùng, ngân sách hạ tầng ≤500 USD/tháng.
- API: p50 ≤200ms, p95 ≤600ms, p99 ≤1,2s.
- Web mobile 4G: LCP ≤2,5s, INP ≤200ms, CLS ≤0,1.
- Availability target 99,5%; release phải có rollback/known-risk rõ ràng.

## Không nằm trong bốn phase

- Đổi tên database, package scope hoặc thư mục workspace.
- Production deployment, xoá volume thật, migration destructive hoặc public
  marketing claim không có số liệu kiểm chứng.
