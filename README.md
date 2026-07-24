# Smart Path Platform — Nền tảng trường số

Smart Path Platform là codebase hợp nhất mới cho LMS, học tập thích ứng và hướng nghiệp của trường THPT. Thư mục phát triển vẫn là `smartclass-platform` để không làm gián đoạn môi trường đang dùng. Hai dự án `neko-core-vaic-2026-main` và `Smartcareerdiscoveryplatform` chỉ là nguồn đối chiếu; không bị sửa, không bị migrate dữ liệu.

## Khởi động local

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d postgres minio mailpit
npm run db:seed
npm run dev
```

- Web: `http://127.0.0.1:5176`
- API: `http://127.0.0.1:3002/healthz`
- Mailpit: `http://127.0.0.1:8025`
- MinIO: `http://127.0.0.1:9001`

`npm run db:seed` chỉ dùng cho local/test, xóa dữ liệu Smart Path trong PostgreSQL rồi tạo đúng hai trường pilot. Không chạy lệnh này với môi trường production.

## Pilot seed

Tất cả tài khoản seed đều là test-only, mật khẩu `TestOnlyPassword!2026` và phải được thay trước khi dùng thật.

- Platform admin: `admin@smartpath.test`
- Hiệu trưởng THPT Nguyễn Du: `hieutruong.nguyendu@smartpath.test`
- Hiệu trưởng THPT Lê Quý Đôn: `hieutruong.lequydon@smartpath.test`
- Giáo viên Toán THPT Nguyễn Du: `giaovien.toan@nguyendu.smartpath.test`
- Học sinh THPT Nguyễn Du: `hocsinh.minh@nguyendu.smartpath.test`

Seed có hai tenant tách biệt, lớp 12A1, phân công giáo viên bộ môn/chủ nhiệm, học sinh, bài học, câu hỏi/bài tập mẫu, gradebook, sự kiện học tập và catalog hướng nghiệp cơ bản.

## Nền móng hiện có

- Session cookie `httpOnly`, `SameSite=Lax`; không có demo-header auth hoặc token trong localStorage.
- Password hashing scrypt, rate limit đăng nhập, session revoke và CORS allowlist.
- Platform admin duyệt school request bằng session thật; yêu cầu public chỉ có quyền INSERT tối thiểu.
- PostgreSQL SQL thuần, RLS tenant, role DB tách `smartpath_public`, `smartpath_api`, `smartpath_control`.
- Seed reset có checkpoint SQL tại `database/checkpoints/` trước khi reset dữ liệu Smart Path.
- Schema foundation đã có identity, tenancy, LMS versioned, adaptive learning, hướng nghiệp, AI/RAG partition, billing/import/crawler và audit để triển khai từng vertical slice.

## Kiểm thử

```powershell
npm run test -w @smart-path/api
npm run test -w @smart-path/web
npm run typecheck
npm run build
npm audit --workspace=@smart-path/api
```

Các kiểm thử hiện kiểm tra login/session cookie, chống giả mạo legacy role header, admin duyệt trường, CORS và RLS giữa hai trường seed. Các phase LMS/adaptive/career/AI tiếp theo sẽ bổ sung unit, integration, IDOR/BOLA và E2E theo kế hoạch.
