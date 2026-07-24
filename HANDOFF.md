# HANDOFF — Smart Path Platform

Cập nhật: 2026-07-24. Đối chiếu với 7 phase trong plan gốc (Smart Path Platform — Kế hoạch hợp nhất đầy đủ NekoPath + SCDP).

## Trạng thái theo phase

### Phase 1 — Reset và rebrand: XONG
- README, package name, `.env.example` đều dùng Smart Path Platform. Không còn dấu vết `eduplan-ai`.
- Không có demo-header auth, không in-memory repository trong production path (`apps/api/src/repositories/in-memory.js` chỉ còn artifact build cũ, không được `app.ts`/`server.ts` dùng — cần dọn ở lần sau nếu còn tồn tại).
- Git repo đã init tại `smartclass-platform` (`git init` + baseline commit `808460f`).

### Phase 2 — Identity, tenancy, admin: ĐANG LÀM (nền móng xong, còn thiếu vertical slice)
Đã có:
- Password auth + session cookie (`postgres-auth.ts`), login rate limit, lockout sau 5 lần sai, session revoke.
- School request → admin approve (`postgres-school-administration.ts`), tạo school code `SP-XXXXXXXX`, invitation token đã insert nhưng **chưa có route accept-invitation**.
- RLS đầy đủ 3 role DB + policy tenant/control cho toàn bộ bảng tenant (`002_tenant_security.sql`).
- Seed 2 trường pilot với đủ vai trò (`seed-pilot.ts`).

Đã bổ sung trong phiên 2026-07-24 (xem TaskList #2-#5):
- `POST /api/v1/classes` — hiệu trưởng tạo lớp (RLS-scoped, `PostgresPlatformRepository.createClass`).
- `POST /api/v1/classes/:classId/teachers` — hiệu trưởng phân công `SUBJECT_TEACHER`/`HOMEROOM_TEACHER`, validate subjectId bắt buộc/cấm theo role (`assignClassTeacher`).
- `POST /api/v1/classes/:classId/students` — hiệu trưởng/giáo viên ghi danh học sinh sẵn có vào lớp, giáo viên chỉ được ghi danh vào lớp mình được phân công (`enrollStudent`).
- `POST /api/v1/admin/students` — hiệu trưởng/giáo viên tạo học sinh mới (dùng `controlPool` vì phải insert `users`, xem `PostgresSchoolAdministrationRepository.createStudent`), sinh `student_code` dạng `SPHS-YYYY-XXXXXXXX`.
- `POST /api/v1/admin/teachers/invitations` — hiệu trưởng mời giáo viên mới, tạo `invitations` record với token.
- `POST /api/v1/auth/invitations/accept` — chấp nhận lời mời bằng token, set mật khẩu lần đầu (không cần session).
- `PATCH /api/v1/me/profile` — người dùng tự sửa `displayName`/`email`/`avatarObjectKey`; KHÔNG có route sửa `student_code`/`school_id` (đúng yêu cầu profile edit policy).
- Test: `apps/api/test/http/platform-routes.test.ts` có 7 test (idempotency, validation subjectId theo role, roster, invitation, profile) — tất cả PASS bằng test double, không cần DB.

Còn thiếu tiếp theo:
- Route lấy danh sách giáo viên/lớp/học sinh của trường (hiện có thể tạo nhưng chưa có API list/query để UI hiển thị).
- `getDashboard` trong `postgres-platform.ts` chưa trả roster/class list — cần bổ sung khi làm UI riêng từng vai trò (Phase 3).
- Chưa gửi email lời mời thật qua Mailpit (route trả `invitationToken` trong response JSON để test/dev dùng trực tiếp — cần bổ sung service gửi mail trước khi lên production).

### Phase 3 — LMS đầy đủ: API ĐÃ ĐỦ VERTICAL SLICE, UI CHƯA LÀM
Đã bổ sung trong phiên 2026-07-24 (sau roster CRUD, commit `3cf5087`):
- `POST /api/v1/question-banks` — tạo ngân hàng câu hỏi theo môn (`createQuestionBank`).
- `POST /api/v1/questions` — tạo câu hỏi + version đầu tiên (`is_approved = false` mặc định, đúng yêu cầu plan "giáo viên phải duyệt trước khi publish").
- `POST /api/v1/assignments` — tạo bài tập ở trạng thái `DRAFT`, chỉ nhận `question_version_id` đã `is_approved = true` (`createAssignment`).
- `POST /api/v1/assignments/:id/publish` — chuyển `DRAFT` → `PUBLISHED`, chỉ giáo viên được phân công lớp/môn hoặc hiệu trưởng (`publishAssignment`, dùng lại `assertTeacherCanManage`).
- `POST /api/v1/attempts/:attemptId/answers/:assignmentItemId/grade` — chấm tự luận, tự tính lại tổng điểm và ghi `gradebook_entries` khi tất cả câu đã có điểm (`gradeEssay`).
- `GET /api/v1/gradebook?classId=&subjectId=&studentId=` — query sổ điểm theo lớp, giáo viên chỉ xem được lớp mình được phân công (`getGradebook`).
- Test: `apps/api/test/http/platform-routes.test.ts` có thêm 3 test case cho toàn bộ luồng question bank → question → assignment → publish → grade → gradebook. Tổng 24/28 test pass (4 skip do thiếu PostgreSQL, không phải lỗi code).

Đã bổ sung thêm (commit `4ca5164`):
- `GET /api/v1/assignments?classId=&subjectId=` — liệt kê bài tập theo lớp/môn; học sinh chỉ thấy bài `PUBLISHED` và chỉ khi đã ghi danh lớp đó, giáo viên chỉ xem lớp được phân công (`listAssignments`).
- `GET /api/v1/me/grades` — học sinh xem điểm cá nhân của chính mình, không cần truyền classId/studentId (`getMyGrades`, chỉ role STUDENT).

Còn thiếu tiếp theo (Phase 3):
- Route GET để list question banks/questions theo môn (hiện chỉ có route tạo, chưa có route liệt kê cho UI ngân hàng câu hỏi).
- Web: vẫn chỉ có 1 `RoleWorkspace` chung cho 4 role, CHƯA có màn hình con riêng (không có trang lớp học, ngân hàng câu hỏi, bài tập, chấm bài...). Đây là phần việc UI lớn nhất còn lại của Phase 3.
- Chưa có báo cáo tiến độ tổng hợp theo lớp/học sinh (khác gradebook thô — cần tính trung bình, xu hướng theo thời gian).

### Phase 4 — NekoPath adaptive learning: MỚI BẮT ĐẦU
- Domain thuần `domain/learning/adaptive.ts` (63 dòng) + schema đủ (skill_graphs, skill_item_mappings, learning_events, adaptive_diagnoses, teacher_overrides, offline_outbox).
- Route duy nhất: `POST /api/v1/sync/events` (offline outbox, có idempotency + conflict detection theo hash).
- Chưa có: knowledge graph thật, hint ladder, review schedule (dù `neko-core-vaic-2026-main/src/domain/review-schedule.ts` đã có logic tham khảo), PWA offline UI, teacher override UI.

### Phase 5 — SCDP hướng nghiệp: MỚI BẮT ĐẦU
- Domain `domain/career/scoring.ts` (123 dòng, có `scoreRiasecAnswers`, `rankCareerMatches`).
- Route: `POST /api/v1/career/assessments/riasec`, `GET /api/v1/career/recommendations`.
- Schema đủ (careers, majors, education_institutions, admission_scores, scholarships, career_profiles, career_share_grants, aspirations, saved_items, goals, reminders) nhưng chưa có route cho catalog/admission probability/scholarship/aspiration/goals.

### Phase 6 — AI, RAG, import/crawler, billing: CHỈ CÓ KHUNG
- `domain/ai/policy.ts` (43 dòng), `domain/admin/billing.ts` (22 dòng, có `calculateMonthlyCharge`), `domain/admin/crawler-safety.ts` (18 dòng, có `assertCrawlUrlIsSafe` chống SSRF cơ bản).
- Route: `GET /api/v1/admin/schools/:schoolId/billing-quote`, `POST /api/v1/admin/crawl-jobs` (chỉ queue, chưa xử lý job thật).
- Chưa có: AI provider router thật, RAG ingestion/embedding, import job xử lý, contact settings UI.

### Phase 7 — Hardening và release: CHƯA BẮT ĐẦU
- Chưa security review chính thức, chưa load test, chưa backup/restore drill, chưa Cloudflare deploy.

## Kiểm thử — trạng thái xác nhận thực tế (2026-07-24)

- `npm run typecheck`: PASS sạch cả 3 workspace.
- `apps/web` test: 3/3 PASS.
- `apps/api` test: 17 PASS, 4 SKIPPED — 2 file (`auth.test.ts`, `rls.integration.test.ts`) cần PostgreSQL thật, hiện SKIP vì Docker Desktop chưa chạy trên máy dev (`ECONNREFUSED 127.0.0.1:5433`). Không phải lỗi code — cần `docker compose up -d postgres minio mailpit` trước khi chạy lại.

## Việc tiếp theo (theo TaskList trong phiên làm việc)

1. Roster CRUD cho giáo viên/hiệu trưởng.
2. Invitation accept flow + set password.
3. Profile edit policy cho học sinh.
4. Route quản lý giáo viên/lớp/phân công.

Sau khi xong Phase 2, chuyển sang Phase 3 (LMS route + UI riêng từng vai trò), rồi Phase 4-6 theo thứ tự trong plan gốc.
