# Smart Path Platform — Quy ước dự án

Đây là codebase hợp nhất mới cho LMS, học tập thích ứng và hướng nghiệp trường THPT.
Thư mục làm việc `smartclass-platform` giữ nguyên tên trong giai đoạn phát triển; tên hiển thị/sản phẩm là **Smart Path Platform**.

## Nguồn đối chiếu (KHÔNG sửa, KHÔNG migrate dữ liệu)

- `D:\FilelaptrinhD\SmartClass\neko-core-vaic-2026-main` — LMS/adaptive learning cũ (NekoPath). Domain logic tham khảo: `src/domain/{core,model,review-schedule}.ts`.
- `D:\FilelaptrinhD\Smartcareerdiscoveryplatform` — hướng nghiệp cũ (SCDP). Service tham khảo: `backend/src/services/{admission,aspiration,ai,scholarship,payment}`.
- Chỉ dùng hai repo này để đối chiếu logic đã kiểm chứng (RIASEC scoring, admission probability, adaptive diagnosis...). Viết lại theo schema PostgreSQL + RLS của Smart Path Platform, có test — không copy nguyên khối, không kéo Prisma vào.

## Stack và ràng buộc kiến trúc

- React 19 + Vite (`apps/web`), Fastify 5 + Node + TypeScript (`apps/api`), PostgreSQL thuần (không Prisma) + RLS, MinIO, Mailpit, Docker Compose.
- 3 role DB: `smartpath_public` (chỉ INSERT `school_requests`), `smartpath_api` (RLS theo `school_id` qua `app_current_school_id()`), `smartpath_control` (bypass RLS, dùng cho admin/seed/session).
- Mọi bảng dữ liệu trường có `school_id`; RLS bắt buộc + test phủ định giữa trường A/B (xem `apps/api/test/rls.integration.test.ts`).
- Mọi thao tác tạo/nộp/import/thanh toán bắt buộc header `X-Idempotency-Key`, lưu vào bảng `idempotency_records` (xem `PostgresPlatformRepository.idempotent`).
- Session cookie `httpOnly`, `SameSite=Lax`, không demo-header auth, không token localStorage. Test `auth.test.ts` phải luôn phủ định giả mạo header role.
- Response/error envelope thống nhất: `{ data: ... }` hoặc `{ error: { code, message, request_id } }` (xem `apps/api/src/app.ts:errorBody`).
- 4 vai trò: `PLATFORM_ADMIN`, `SCHOOL_OWNER` (hiệu trưởng), `TEACHER`, `STUDENT`. Giáo viên có 2 loại phân công: `SUBJECT_TEACHER` và `HOMEROOM_TEACHER`.
- Không lưu CCCD thô. Pilot dùng mã học sinh (`student_code`); nếu cần đối soát CCCD chỉ lưu HMAC fingerprint có salt server-side.
- UI/thông báo lỗi dùng tiếng Việt, tuân accessibility (keyboard, aria-label, trạng thái loading/empty/error/forbidden).

## Quy tắc code

- Không viết migration mới đè lên migration cũ đã áp dụng; luôn thêm file `XXX_ten_muc_dich.sql` mới, giữ nguyên bảng/dữ liệu cũ (xem cách `004_delivery_primitives.sql` làm).
- Domain logic thuần (scoring, grading, access control) đặt trong `apps/api/src/domain/**`, không phụ thuộc `pg`; test unit không cần DB.
- Repository (`apps/api/src/repositories/**`) là nơi duy nhất chạy SQL; route trong `app.ts` không tự viết SQL.
- Mọi route mutating phải qua `requireIdempotencyKey` + repository ghi `audit_events`.
- Không hard-code URL/tài khoản Zalo/Facebook thật — chỉ qua biến môi trường (`SUPPORT_ZALO_URL`, `SUPPORT_FACEBOOK_URL`).

## Lệnh thường dùng

```powershell
npm run dev          # chạy cả api (3002) và web (5176)
npm run test          # test @smart-path/api (vitest)
npm run typecheck     # typecheck 3 workspace
npm run build         # build contracts -> api -> web
npm run db:seed       # reset + seed 2 trường pilot (chỉ local/test)
docker compose up -d postgres minio mailpit
```

Test cần PostgreSQL (`auth.test.ts`, `rls.integration.test.ts`) yêu cầu Docker Desktop đang chạy và `docker compose up -d postgres`.

## Theo dõi tiến độ

Xem `HANDOFF.md` để biết trạng thái từng phase và việc cần làm tiếp theo.
