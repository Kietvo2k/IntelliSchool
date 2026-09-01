# Kế hoạch triển khai Phase 3

Triển khai theo lát dọc, theo thứ tự: nền tảng dữ liệu và hợp đồng; identity/platform admin; bài giảng và tài nguyên; ngân hàng câu hỏi/assignment/gradebook; dashboard, báo cáo và export; cuối cùng là kiểm thử end-to-end cùng tài liệu vận hành.

Mỗi lát dọc phải có test đơn vị trước, kiểm thử HTTP tiếp theo và checkpoint khi Docker PostgreSQL/MinIO/Mailpit/ClamAV hoạt động. Giữ kiến trúc React/Vite + Fastify/PostgreSQL/RLS + MinIO và thiết kế xanh lá–kem–cam hiện có.

Trạng thái ngày 2026-07-25: Docker PostgreSQL/MinIO/Mailpit/ClamAV đã được dùng cho checkpoint tích hợp. Đã có vertical slice cho identity/platform admin, lesson/resource scan, question/import, assignment/gradebook và report export; các luồng còn lại vẫn phải được kiểm tra theo Definition of Done trước khi đánh dấu hoàn thành Phase 3.
