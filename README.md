# Smart Path Platform — Nền tảng trường số

Smart Path Platform là codebase hợp nhất mới cho LMS, học tập thích ứng và hướng nghiệp của trường THPT. Thư mục phát triển vẫn là `smartclass-platform` để không làm gián đoạn môi trường đang dùng. Hai dự án `neko-core-vaic-2026-main` và `Smartcareerdiscoveryplatform` chỉ là nguồn đối chiếu; không bị sửa, không bị migrate dữ liệu.

## Yêu cầu

- **Docker Desktop** đang chạy. Toàn bộ web + API + Postgres chạy trong Docker.
- Trần cứng của stack: **1 CPU**, **1.8 GB RAM**, **8 GB đĩa** (file app 6 GB, phần còn lại cho Postgres).
- Không bật ClamAV / MinIO / Mailpit ở chế độ này (quá nặng). File lưu đĩa local; email ghi vào `/data/mail`.
- Copy `.env.example` → `.env` nếu chưa có. Key AI và Supabase để trống cũng chạy được.

## Khởi động (khuyến nghị)

Trong `smartclass-platform`:

```powershell
Copy-Item .env.example .env   # chỉ lần đầu
docker compose up --build -d --remove-orphans
```

Lần đầu image build có thể mất vài phút. Container `app` tự đợi Postgres, seed nếu database trống, rồi phục vụ web+API cùng một cổng.

### Địa chỉ

| Dịch vụ | URL |
|---|---|
| Web + API | http://127.0.0.1:8080 |
| Web (cổng cũ) | http://127.0.0.1:5176 (cùng app) |
| Health | http://127.0.0.1:8080/healthz |
| PostgreSQL (debug) | `127.0.0.1:5433` |

Tài khoản demo: mật khẩu `TestOnlyPassword!2026`, PIN thi `ExamPin2026!`. Email ví dụ `hocsinh.minh@nguyendu.smartpath.test`.

### Supabase (tùy chọn)

1. Chạy `database/supabase-bootstrap.sql` trên SQL Editor (đổi mật khẩu 3 role).
2. Import schema `database/migrations/*.sql` theo thứ tự.
3. Điền `SUPABASE_PUBLIC_DATABASE_URL`, `SUPABASE_API_DATABASE_URL`, `SUPABASE_CONTROL_DATABASE_URL` trong `.env` (direct `db.*.supabase.co:5432?sslmode=require`, không dùng transaction pooler).
4. `docker compose -f docker-compose.yml -f docker-compose.supabase.yml up --build -d`

### Máy mạnh (MinIO + ClamAV + Mailpit + npm run dev)

```powershell
docker compose -f docker-compose.full.yml up -d
npm install
npm run db:seed
npm run dev
```

Không chạy `docker-compose.yml` và `docker-compose.full.yml` cùng lúc (trùng cổng 5433).

## Kiểm tra nhanh

```powershell
Invoke-RestMethod http://127.0.0.1:8080/healthz
```

Login từ trình duyệt tại **http://127.0.0.1:8080**.

## Khởi động lại

```powershell
docker compose up -d --remove-orphans
```

Seed chỉ chạy khi bảng `users` trống. Muốn nạp lại demo: `docker compose exec app node apps/api/dist/seed-pilot.js` (sẽ xóa dữ liệu tenant).

## Xử lý sự cố thường gặp

### Chỉ thấy giao diện, không đăng nhập/đăng ký được

1. Docker Desktop đã bật chưa?
2. `docker compose ps` — `postgres` và `app` có healthy không?
3. Mở **http://127.0.0.1:8080** (không phải Vite trên host).

### Schema cũ / volume Postgres

```powershell
docker compose down -v
docker compose up --build -d
```

Volume xóa sẽ seed lại demo. Không dùng trên dữ liệu thật.

### `ERR_CONNECTION_REFUSED` khi mở http://127.0.0.1:8080

`docker compose ps` xem `app` đã Up chưa. Log: `docker compose logs app --tail 80`.

### `docker compose` báo lỗi kết nối Docker

Mở **Docker Desktop**, đợi trạng thái Running, rồi chạy lại lệnh compose.

Seed chỉ dùng cho local/test: xóa dữ liệu Smart Path rồi tạo lại hai trường pilot. **Không chạy trên production.**

## Tài khoản seed (đăng nhập thử)

Tất cả tài khoản dưới đây dùng mật khẩu **`TestOnlyPassword!2026`** (test-only, đổi trước khi dùng thật):

| Vai trò | Email |
|---|---|
| Platform admin | `admin@smartpath.test` |
| Hiệu trưởng THPT Nguyễn Du | `hieutruong.nguyendu@smartpath.test` |
| Hiệu trưởng THPT Lê Quý Đôn | `hieutruong.lequydon@smartpath.test` |
| Giáo viên Toán (Nguyễn Du) | `giaovien.toan@nguyendu.smartpath.test` |
| Học sinh (Nguyễn Du) | `hocsinh.minh@nguyendu.smartpath.test` |

Seed tạo hai tenant, lớp 12A1, bài học/bài tập mẫu, gradebook, model AI demo và tài liệu tri thức mẫu cho Trợ giảng AI.

### Nạp thêm dữ liệu demo số lượng lớn (không xóa dữ liệu hiện có)

```powershell
npm run db:seed:demo
```

Lệnh này tạo thêm 96 tài khoản, 16 lớp, 192 bài kiểm tra/bài tập và 48 tài liệu/RAG nguồn trên hai trường pilot. Có thể chạy lại an toàn; dữ liệu được định danh theo email, tên bài và object key cố định. Tài khoản demo dùng mẫu `demo.hs01@sp-pilot001.smartpath.test` hoặc `demo.gv01@sp-pilot002.smartpath.test`, cùng mật khẩu test-only được khai báo trong `apps/api/src/seed-demo-data.ts`.

### Thử nhanh Trợ giảng AI (không cần API key)

Đăng nhập giáo viên hoặc học sinh Nguyễn Du → **Trợ giảng AI** → hỏi ví dụ *“Giải thích đạo hàm của x²”*. Seed đã nạp tài liệu mẫu; trợ giảng trả lời **trích xuất cục bộ có trích dẫn** khi chưa cấu hình model. Muốn dùng model thật: điền `AI_BASE_URL` + `AI_OPENAI_API_KEY` (hoặc `AI_ANTHROPIC_API_KEY`) trong `.env`, rồi cấu hình trong **Cài đặt AI**.

## Bootstrap admin nền tảng (tùy chọn, không dùng seed)

Đặt `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_DISPLAY_NAME`, `APP_BASE_URL` và SMTP trong `.env`, sau đó:

```powershell
npm run bootstrap:platform-admin
```

Lệnh gửi liên kết kích hoạt một lần (30 phút), không tạo mật khẩu cố định.

## Tính năng hiện có

- **Tài khoản & quản trị:** đăng ký giáo viên/học sinh bằng mã trường, hiệu trưởng duyệt/từ chối, email kích hoạt, đăng nhập, đặt lại mật khẩu, quản lý phiên; workspace admin nền tảng (duyệt trường, danh sách trường/người dùng, khóa tài khoản, thu hồi phiên, mời admin, audit log có bộ lọc/phân trang).
- **LMS:** bài giảng/tiến độ, tài nguyên MinIO qua quarantine + ClamAV, ngân hàng câu hỏi bốn loại, import CSV/XLSX, assignment nhiều lượt, chấm tự luận, gradebook, báo cáo và export CSV/XLSX.
- **Học tập thích ứng (Phase 4):** đồ thị kỹ năng có duyệt bốn mắt, ánh xạ câu hỏi ↔ kỹ năng, chẩn đoán gốc rễ từ learning events, lộ trình ôn tập cho học sinh và bảng chẩn đoán cho giáo viên.
- **Hướng nghiệp (Phase 5):** danh mục nghề/ngành/trường/điểm chuẩn theo khối, trắc nghiệm RIASEC + năng lực, gợi ý nghề (SIMGR), xác suất trúng tuyển, học bổng, nguyện vọng, mục tiêu và nhắc việc.
- **Trợ giảng AI (Phase 6):** cấu hình provider (OpenAI-compatible/Anthropic) + hạn mức chi phí; nạp tri thức (RAG) từ bài giảng hoặc văn bản; chat chính sách **lai** — ưu tiên bám tài liệu và trích dẫn, khi không có tài liệu vẫn trả lời bằng kiến thức chung có gắn nhãn, và từ chối đưa đáp án cho bài đang mở. Có trả lời trích xuất cục bộ để chạy được khi chưa có key.
- **Gói dịch vụ (Phase 7):** hiệu trưởng xem gói/chi phí theo số lớp; admin nền tảng đặt trạng thái, hạn mức lớp, đơn giá và ghi nhận thanh toán, có audit.
- **Docker local** (mặc định): một container `app` (web tĩnh + API) và Postgres alpine, giới hạn **1 CPU / 1.8 GB RAM**; file trên đĩa, không MinIO/ClamAV/Mailpit.

## Nền móng hiện có

- Session cookie `httpOnly`, `SameSite=Lax`; không có demo-header auth hoặc token trong localStorage.
- Password hashing scrypt, rate limit đăng nhập, session revoke và CORS allowlist.
- Platform admin duyệt school request bằng session thật; yêu cầu public chỉ có quyền INSERT tối thiểu.
- PostgreSQL SQL thuần, RLS tenant, role DB tách `smartpath_public`, `smartpath_api`, `smartpath_control`.
- Seed reset có checkpoint SQL tại `database/checkpoints/` trước khi reset dữ liệu Smart Path.
- Schema foundation đã có identity, tenancy, LMS versioned, adaptive learning, hướng nghiệp, AI/RAG partition, billing/import/crawler và audit để triển khai từng vertical slice.

## Kiểm thử

```powershell
npm run verify
npm run test:stack:up
npm run test:integration:isolated
npm run test:e2e:isolated
npm run test:release:isolated  # verify + integration + Browser E2E + audit, teardown luôn chạy
npm run test:stack:down
npm audit --audit-level=high
git diff --check
```

`verify` chạy typecheck, unit/API, web test, production build và bundle budget (không cần Docker). Integration/E2E dùng `docker-compose.test.yml` với database/volume/cổng cô lập, không reset dữ liệu local. `test:integration:isolated` bao phủ RLS hai tenant, identity, resource scan, question/import, lesson, assignment/gradebook, CBT kỳ–môn–điểm tạm tính, dashboard, report export, đồ thị kỹ năng, adaptive, hướng nghiệp, RAG + chat AI và gói dịch vụ. `test:e2e:isolated` chạy UI thật bằng Chromium, axe, keyboard, reduced-motion, clean-console, route matrix bốn vai trò, CBT Hóa, AI tự truy hồi và responsive 320/375/768/1024/1440px.

Các ngưỡng build tự động: chunk JavaScript tối đa 500 kB, initial JS gzip tối đa 200 KiB và CSS gzip tối đa 50 KiB. Stack test dùng `fsync=off` chỉ cho PostgreSQL disposable; không dùng cấu hình này ở production.

### Reset riêng ca thi pilot

Không dùng `db:seed` để xử lý một ca thi đã nộp. Lệnh dưới chỉ xóa session, lượt làm, điểm và nhật ký của năm ca seed xác định thuộc `SP-PILOT001`; không quét các ca thi có tên tương tự ở trường khác, không xóa ngân hàng câu hỏi, bài tập thường hoặc dữ liệu production.

```powershell
$env:PILOT_EXAM_RESET_CONFIRM = 'RESET_PILOT_EXAMS'
npm run db:reset:pilot-exams -w @smart-path/api
```

Lệnh tự từ chối khi `NODE_ENV=production`. Với stack test, đặt các biến database test tương ứng hoặc dùng lại `test:stack:up` trước khi chạy.
