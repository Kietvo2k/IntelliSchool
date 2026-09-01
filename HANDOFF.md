# HANDOFF — Smart Path Platform

Cập nhật: 2026-08-29 (Docker 1 CPU / 1.8GB / 8GB) — UI/motion/SCDP/AI/CBT overhaul

## Tái thiết tiếp theo — 2026-08-29

- `STRICT_WEB`: server phân loại incident, gom tín hiệu focus, không tính mất mạng/hộp chọn tệp, yêu cầu fullscreen + desktop và seed ca thi strict; migration `016_strict_web_integrity.sql`.
- Grant đính kèm tự luận do server cấp, sống 60 giây và dùng một lần; incident lưu `incident_id`/`counted`/`reason`, không tin payload exemption từ client; migration `020_exam_attachment_exemptions.sql`.
- Tự luận dùng rich editor có toolbar; upload học sinh qua `/api/v1/library/uploads` là tài liệu riêng, có luồng gửi duyệt/duyệt vào Thư viện số; migration `018_private_library_resources.sql`.
- Năng lực đổi thành 20 câu tư duy (5 dễ, 5 trung bình, 10 khó; 15 MCQ + 5 giải thích), draft RLS có version và autosave; migration `017_career_assessment_drafts.sql`.
- AI có controls Standard/Thinking, Agentic, source scope; Thinking chạy job bền vững `ai_jobs` và không trả raw tool stdout; migration `019_ai_jobs.sql`.
- Worker inline claim job bằng điều kiện DB và startup tự reclaim `QUEUED`/`RUNNING` stale sau restart, tránh mất lượt Thinking khi tiến trình API bị khởi động lại.
- Kết quả hướng nghiệp dùng hồi quy theo năm có chặn extrapolation, RIASEC vector compatibility, confidence và context phỏng vấn một câu/lượt.

## Quality hardening — 2026-08-29

- Đã bỏ debug telemetry tạm thời khỏi frontend; anonymous session trả `200 { data: { user: null } }` để không tạo console error giả.
- Lesson HTML dùng sanitizer allowlist phía server; cấm script/style/iframe/SVG/form/event handler và ép `noopener noreferrer` cho link mở tab mới.
- Mobile workspace dùng drawer có overlay, Escape, focus và skip link; dashboard không còn dính chữ ở viewport 375px.
- Stack test cô lập ở `docker-compose.test.yml`; migration forward-only 014 bổ sung quyền `TRUNCATE` cho control seed. Bundle budget được kiểm tự động.
- Xác nhận hiện tại: unit/API 188 test, web 53 test, integration 34/34, Browser E2E 28/28 (route matrix bốn vai trò, CBT Hóa, AI tự truy hồi và responsive 320–1440px), axe serious/critical 0, npm audit High/Critical 0.
- CBT/điểm: migration `015_exam_periods.sql`, kỳ → môn, ca Hóa pilot 5 câu, integrity 3 warning do server xác nhận/finalize, điểm `PROVISIONAL` trước tự luận và bảng điểm theo kỳ/bài.
- AI/hướng nghiệp: RAG tự chọn theo scope, Markdown/KaTeX lazy và an toàn, stepper không nhảy bước tương lai, catalog tổ hợp mã–môn, thêm nghề pilot đa lĩnh vực và lý do/điểm thiếu khi xếp hạng trường.
- Lệnh reset hẹp ca thi pilot: `PILOT_EXAM_RESET_CONFIRM=RESET_PILOT_EXAMS npm run db:reset:pilot-exams -w @smart-path/api`; cấm production, chỉ xóa session/attempt/grade/integrity của năm ca seed xác định tại `SP-PILOT001`.

### Rủi ro còn mở sau hardening

- Dữ liệu catalog/điểm chuẩn vẫn có disclaimer seed mẫu; PORTAL và crawler ngoài allowlist vẫn là stub.
- Integration reset/seed từng file, nhưng PostgreSQL disposable test đã giảm thời gian toàn suite xuống khoảng 41 giây.
- Chưa deploy production và chưa thay đổi các volume local đang chạy.

## Career / exam / AI overhaul (2026-08-28)

Đã làm 12 mục: motion vòng đời, token UI, CBT hình, lộ trình vàng + skip, năng lực 30, chat ngoại khóa, hồ sơ/điểm, SIMGR, AI học tập, cấm JSON/mock.

- Motion: `apps/web/src/lib/motion.ts`, `PageTransition`, `ScrollReveal`, `SoftRefresh`, `PathScrollRestoration` (pathname; không dùng RR `ScrollRestoration` vì cần data router). Sidebar không animate. CBT fade 200ms. Reduced-motion cắt transform.
- UI: PathwayStepper, LetterChoice, KnowledgeCardView, SimgrRadar, ChatShell, CbtBackdrop, GradeChip, AnalyzeProgress. Sửa `.workspace-feature p` không uppercase.
- CBT: họa tiết SVG, emblem, `imageSvg`/`imageUrl`, LetterChoice A–D, timer ≤5 phút pulse, footer trường. Spec SVG UTF-8 trong `docs/product/exam-cbt/`. Câu hỏi fade 200ms, thanh công cụ/navigator đứng yên. Volume sống: `database/patches/014_exam_images_live.sql`.
- Khám phá: 6 bước vàng, skip năng lực/Holland/extra/điểm; tỉnh+mục tiêu bắt buộc khi xem kết quả. Năng lực 30 (10 tự luận, AI rubric hoặc `pendingEssay`). Extra chat 10 + 5 follow-up. Không nút mock analyze.
- SIMGR: RIASEC trống = 0.5; không bắt buộc assessment; S = academic hoặc 0.55 academic + 0.45 aptitude. Tests `scoring-simgr.test.ts`.
- AI: HS **AI học tập** `/app/ai-study`; GV **Soạn bài AI**. Phiên, RAG `documentIds`, sandbox `worker_threads` 3s/32MB, overflow 128k + `parent_session_id`. Migration `013_ai_sessions_context.sql` + patch `database/patches/013_live_backfill.sql`.
- Cấm JSON: `presentAssistantText`; Profile/Homeroom không `<pre>`; compose parse `raw` rồi thẻ câu.

Volume Postgres cũ: `docker cp database/patches/013_live_backfill.sql` rồi `psql -f`. Seed hình: `docker compose down -v` rồi `up` + `npm run db:seed`.

## Docker constrained (2026-08-27)

Chạy cả web + API trong Docker. Trần: **1.00 CPU**, **1800 MiB RAM** (`postgres` 0.30 CPU / 420 MiB, `app` 0.70 CPU / 1380 MiB). File local tối đa 6 GiB. Không bật ClamAV/MinIO/Mailpit.

```powershell
docker compose up --build -d --remove-orphans
```

Mở http://127.0.0.1:8080 (cũng map 5176). Seed tự chạy khi `users` trống.

Supabase: điền `SUPABASE_*` trong `.env`, xem `database/supabase-bootstrap.sql`, rồi
`docker compose -f docker-compose.yml -f docker-compose.supabase.yml up --build -d`.

## School platform overhaul (2026-08-27)

Đã làm trọn 14 nhóm + web thi CBT 4 màn, bám QĐ 764 (4 dạng câu). SCDP/Neko chỉ đọc.

- Spec: `docs/product/school-platform-spec.md`, `docs/product/exam-cbt/visual-spec.md` (+ SVG layout lock).
- Migration `012_school_platform.sql`: lịch/video bài giảng, kênh CLASS/DIRECT, học bạ số, knowledge card, catalog extras.
- CBT `/app/exam` tách khỏi sidebar LMS. Header **GIAO DIỆN THI TRÊN MÁY TÍNH**. Không giả Bộ/Cục. Navigator ngang đáy. 4 dạng câu (đúng/sai 4 ý; điền số).
- Xuất bản bài tập/đề ≥ 5 câu. Chat soạn đề hỏi ý kiến rồi điền khung JSON chuẩn, không tự publish (không phụ thuộc model sinh tự do).
- Nav GV: Tổng quan, Lớp, Bài giảng, Tài nguyên, Ngân hàng, Bài tập, Thi, Sổ điểm, Chấm tự luận, Tiến độ, Tin nhắn, **Soạn bài AI**. Ẩn skill/adaptive/cấu hình AI/danh mục nghề.
- Tin nhắn Messenger (kênh lớp + 1-1, polling 5s). Hồ sơ + học bạ + thẻ 80/20. Chat trợ giảng/học tập/hướng nghiệp có UI.
- Khám phá: intro → năng lực SCDP → Holland/RIASEC → ngoại khóa ≤5 follow-up → điểm học → hồ sơ.
- Catalog: coverage 2024–2026 (complete=false) + crawl HTTPS allowlist (`tuyensinh247.com`, `vnexpress.net`). Seed điểm theo năm + học bổng. API bài giảng gộp cột `video` vào content.

`npm run verify` (2026-08-28): typecheck + **179** unit/API + **52** web + production build. Docker `app` rebuild. Browser 1280/375: SPA mount (`PathScrollRestoration` thay RR `ScrollRestoration`), F5 dashboard, Back Bài giảng→Tổng quan, lộ trình vàng + skip, A–D, Likert Holland, chat ngoại khóa không JSON, điểm chip, CBT hình + A–D, hồ sơ 80/20 không `<pre>`, AI học tập Phiên mới, GV Soạn bài AI, reduced-motion. Volume: 013 + `014_exam_images_live.sql`.

Browser đã đi: nav GV; soạn đề AI hỏi rồi điền ≥5 câu (GV cần duyệt); Messenger kênh lớp + 1-1; CBT 4 màn (login → sảnh → làm bài 5 câu đủ 4 dạng → modal kết quả 5/5); hồ sơ học bạ + 80/20 + PORTAL stub; bài giảng YouTube embed; chat học tập cá nhân; trường gợi ý có điểm/nguồn.

Volume Postgres cũ (không `down -v`): `database/patches/012_live_backfill.sql` (UTF-8 qua `docker cp`). Seed đầy đủ: `docker compose down -v` rồi `up` + `npm run db:seed`.

Seed (mật khẩu chung `TestOnlyPassword!2026`, PIN ca thi `ExamPin2026!`):

| Vai trò | Email | Ghi chú |
|---|---|---|
| Admin nền tảng | `admin@smartpath.test` | |
| Hiệu trưởng Nguyễn Du | `hieutruong.nguyendu@smartpath.test` | |
| GV Toán / Lý | `giaovien.toan@nguyendu.smartpath.test` | |
| GVCN | `giaovien.chunhiem@nguyendu.smartpath.test` | |
| GV Văn | `giaovien.van@nguyendu.smartpath.test` | mới |
| GV Hóa | `giaovien.hoa@nguyendu.smartpath.test` | mới |
| GV Anh | `giaovien.anh@nguyendu.smartpath.test` | mới |
| HS Minh An | `hocsinh.minh@nguyendu.smartpath.test` | `SPHS-2026-000001` |
| HS Linh | `hocsinh.linh@nguyendu.smartpath.test` | `SPHS-2026-000002` |
| HS Hưng | `hocsinh.hung@nguyendu.smartpath.test` | `SPHS-2026-000003` |
| HS Mai | `hocsinh.mai@nguyendu.smartpath.test` | `SPHS-2026-000004` |

Ca thi lớp 12A1: Toán, Ngữ văn, Vật lí, Hóa học, Tiếng Anh (mỗi đề ≥5 câu, đủ 4 dạng). Bài giảng thêm Este/lipid và Reading.

### Rủi ro còn mở

- Catalog 2024–2026 chưa verify hết tổ hợp × năm; coverage flag + disclaimer.
- Cổng TTĐT không kết nối (PORTAL stub).
- Video lớn / ClamAV timeout. TipTap đầy đủ chưa cài npm — editor giàu dùng HTML đã sanitize.
- Đề cũ TRUE_FALSE 1 mệnh đề / MCQ 3 lựa chọn: reset seed local, không migrate production giả.
- Crawler SCDP gốc vẫn stub; Smart Path chỉ fetch excerpt HTTPS allowlist.

## Việc còn lại (HOÃN)

- Phase 8 (Production VPS) và Phase 9 tạm hoãn.
- Cổng integration/E2E trước đây hoãn vì thiếu Docker đã được đóng trong mục **Quality hardening** ở đầu file bằng stack test cô lập.


## Trạng thái hiện tại

Phase 3 đã có các vertical slice chạy được trên React/Vite + Fastify/PostgreSQL RLS + MinIO:

- Identity: đăng ký bằng mã trường, duyệt/từ chối đăng ký, kích hoạt mật khẩu một lần, login, reset mật khẩu, danh sách và thu hồi phiên.
- Platform admin: bootstrap qua biến môi trường, lời mời admin, duyệt trường, quản lý trường/người dùng, khóa/mở tài khoản, thu hồi phiên và audit log có bộ lọc/phân trang.
- LMS: bài giảng và lesson progress; tài nguyên qua MinIO quarantine + ClamAV; ngân hàng câu hỏi/version/duyệt bốn mắt; import CSV/XLSX; assignment nhiều lượt, tự chấm, chấm tự luận, return, gradebook và lịch sử override.
- Báo cáo: dashboard theo bốn vai trò, progress report và export gradebook/progress CSV/XLSX qua MinIO riêng tư.

## Hạ tầng local

- Mặc định: `docker compose up --build -d` — `app` (web+API :8080) + Postgres alpine. Trần 1 CPU / 1.8 GB RAM.
- File đĩa volume `app-data` (quota 6 GiB). Email ghi `/data/mail`. Không MinIO/ClamAV/Mailpit.
- Web: `http://127.0.0.1:8080` (cũng `http://127.0.0.1:5176`). Health: `/healthz`.
- Supabase tùy chọn qua `.env` `SUPABASE_*` + `docker-compose.supabase.yml`.
- Docker data disk: `F:\Docker\DockerDesktopWSL` (nếu vẫn cấu hình vậy).

## Kiểm tra đã xác nhận ngày 2026-07-25

- `npm run verify`: PASS — typecheck, 72 unit/API tests, 19 web tests và production build.
- `npm run test:integration`: PASS — 13 suite, 20 tests với PostgreSQL thật.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: PASS.
- Trang chủ và trang đăng nhập đã được kiểm tra trong trình duyệt: không có console warning/error; cấu trúc heading, nhãn form và điều hướng bàn phím cơ bản hiện diện.

## Phase 3F — bộ e2e + accessibility (đã thêm)

Bộ kiểm thử trình duyệt Phase 3F đã được dựng tại `apps/web/e2e/` với Playwright +
axe-core, tách khỏi `npm run verify` để verify vẫn xanh khi chưa dựng stack:

1. `01-registration-activation` — gửi yêu cầu mở trường + hàng đợi duyệt của hiệu trưởng (kích hoạt Mailpit kiểm thủ công).
2. `02-platform-admin` — trường, người dùng, nhật ký bảo mật.
3. `03-lesson-resource` — bài giảng/tài nguyên cho giáo viên và học sinh.
4. `04-assignment-gradebook` — ngân hàng câu hỏi, bài tập, sổ điểm, báo cáo, điểm học sinh.
5. `05-accessibility-keyboard` — axe ở 375/768/1024/1440 px, điều hướng bàn phím cho luồng nộp/chấm, dashboard 4 vai trò không lỗi console.

Cách chạy: xem `apps/web/e2e/README.md`. Cần `docker compose up` + `npm run db:seed` +
`npm run dev`, sau đó `npx playwright install chromium` và `npm run test:e2e:browser -w @smart-path/web`.

Việc còn lại để đóng hẳn Phase 3 (cần môi trường có Docker): chạy trọn bộ e2e trên,
xác nhận 0 lỗi axe critical/serious và rà trực quan 4 dashboard có dữ liệu seed thật.

## Phase 4A — Skill graph + item mapping (đã thêm)

- Migration `006_adaptive_slice.sql`: thêm `title/status/created_by/review_reason/updated_at` cho `skill_graphs`, ràng buộc metadata duyệt, index. Forward-only.
- Domain `apps/api/src/domain/learning/graph.ts`: validate DAG (mã hợp lệ, không trùng, cạnh đúng, không tự lặp, không chu trình), `topologicalOrder`, `directPrerequisites`. Test `test/domain/graph.test.ts` (5).
- Repository: `createSkillGraph/updateSkillGraph/submitSkillGraphForReview/reviewSkillGraph/mapSkillItems/listSkillGraphs/getSkillGraph` với idempotency + audit + duyệt bốn mắt (người soạn không tự duyệt; giáo viên chỉ duyệt môn được phân công). Đồ thị APPROVED là bất biến; sửa đổi = tạo version mới.
- Routes: `GET/POST /api/v1/skill-graphs`, `GET/PUT /api/v1/skill-graphs/:id`, `POST /api/v1/skill-graphs/:id/{submit,review,mappings}`. Đã thêm `PUT` vào CORS allowlist.
- UI: `apps/web/src/routes/SkillGraphsPage.tsx` (+ nav giáo viên/hiệu trưởng, route `/app/skill-graphs`). Test `SkillGraphsPage.test.tsx`.
- Test HTTP `test/http/skill-graph-routes.test.ts` (3), integration `test/skill-graph.integration.test.ts` (cần Docker) đã thêm vào `test:integration`.
- Verify: `npm run verify` PASS (typecheck, 75 unit/API, 20 web, build).

## Phase 4B — Learning events + chẩn đoán + lịch ôn (đã thêm)

- Domain: `diagnoseRootCause` (tìm kỹ năng tiên quyết sớm nhất đủ bằng chứng; abstain NEEDS_MORE_EVIDENCE khi <minEvidence; ON_TRACK khi không có lỗi), `planRemediationPath` (xếp theo thứ tự tiên quyết), `downstreamSkills`. Test `test/domain/adaptive-root-cause.test.ts` (5).
- Repository: `recordLearningEvents` (ghi `learning_events` idempotent theo event_key khi chấm auto/tự luận, chỉ cho câu có mapping trong đồ thị ĐÃ DUYỆT; essay coi là đúng khi >=50% điểm); `getAdaptiveDiagnoses` (nhóm theo nhu cầu, ưu tiên = số HS × (kỹ năng hạ nguồn+1)), `overrideAdaptiveDiagnosis` (ghi `teacher_overrides` + snapshot `adaptive_diagnoses`), `getMyAdaptivePlan` (lộ trình + lịch ôn, tôn trọng override DISMISS). Đã hook vào `submitAssignment` và `gradeEssay`.
- Routes: `GET /api/v1/adaptive/diagnoses`, `POST /api/v1/adaptive/overrides`, `GET /api/v1/adaptive/my`. Test HTTP `test/http/adaptive-routes.test.ts` (3), integration `test/adaptive.integration.test.ts`.

## Phase 4C — UI adaptive (đã thêm)

- `AdaptiveDiagnosisPage.tsx` (giáo viên/hiệu trưởng): lọc lớp+môn, nhóm ưu tiên, danh sách học sinh mở được bằng chứng, nút xác nhận/bác bỏ. Route `/app/adaptive`, nav "Lớp theo nhu cầu".
- `MyLearningPathPage.tsx` (học sinh): lộ trình theo thứ tự tiên quyết + việc ôn đến hạn, tôn trọng override. Route `/app/my-path`, nav "Lộ trình của em".
- Test `AdaptiveDiagnosisPage.test.tsx` (2). Verify: `npm run verify` PASS (88 unit/API, 22 web, build).

## Phase 5A — Catalog hướng nghiệp (đã thêm)

- Migration `007_career_catalog.sql`: `admission_scores.exam_block` + unique (program, year, block); `education_institutions` thêm description/website/admission_method; index.
- Domain `apps/api/src/domain/career/admission-blocks.ts`: 12 tổ hợp, `pickBestBlockScore`, `clampPriorityBonus` (≤2.75), `isValidExamBlock`. Test `test/domain/admission-blocks.test.ts` (4).
- Repository: đọc `listCareers/listInstitutions/getInstitutionDetail/listScholarships` (catalog toàn nền tảng qua control pool); admin ghi `adminUpsertCareer/Major/Institution/Scholarship` + `adminImportAdmissionScores` (validate all-or-nothing theo tổ hợp/năm/điểm, báo lỗi theo dòng) qua helper `controlMutation` (chỉ PLATFORM_ADMIN, idempotency + audit).
- Routes: `GET /api/v1/{careers,institutions,institutions/:id,scholarships}` (mọi vai trò đăng nhập), `POST /api/v1/admin/{careers,majors,institutions,admission-scores/import,scholarships}` (admin). Crawler tách khỏi catalog: `crawl_jobs` chỉ xếp hàng, không tự ghi catalog.
- Seed mở rộng: 2 nghề, 2 ngành, 1 trường chi tiết, điểm chuẩn nhiều năm/tổ hợp, học bổng có tiêu chí.
- UI `CareersPage.tsx` (browse cho mọi vai trò + panel quản lý cho admin), route `/app/careers`, nav 4 vai trò. Test `CareersPage.test.tsx` (2), HTTP `test/http/catalog-routes.test.ts` (3), integration `test/career.integration.test.ts`.
- Verify: `npm run verify` PASS.

## Phase 5B — Trắc nghiệm + gợi ý nghề (đã thêm)

- Domain `apps/api/src/domain/career/aptitude.ts`: 30 câu (15 tư duy + 15 đời sống, 10 tự luận), `scoreAptitude` (MCQ tỉ lệ đúng, essay rubric hoặc pending, chiều trống = 0.5), `publicAptitudeQuestions`. Test `test/domain/aptitude.test.ts` + `scoring-simgr.test.ts`.
- Repository: `getAptitudeQuestions/saveAptitudeAssessment/getCareerProfile/updateCareerProfile/setCareerShareGrant/getStudentCareerProfile`; `getCareerRecommendations` blend RIASEC+aptitude+học lực + luôn kèm `disclaimer`. Chia sẻ mặc định tắt; giáo viên chủ nhiệm 403 nếu chưa được cấp quyền.
- Routes: `GET /api/v1/career/aptitude/questions`, `POST /api/v1/career/assessments/aptitude`, `GET/PATCH /api/v1/career/profile`, `POST /api/v1/career/share-grants`, `GET /api/v1/students/:id/career-profile`. Test HTTP `test/http/career-routes.test.ts` (3).
- UI `CareerQuizPage.tsx` (RIASEC + năng lực + kết quả có disclaimer + consent), route `/app/career-quiz`. Test `CareerQuizPage.test.tsx`.
- Verify: `npm run verify` PASS (102 unit/API, 25 web, build).

## Phase 5C — Xác suất đỗ + nguyện vọng + học bổng (đã thêm)

- Domain `admission.ts` (hồi quy tuyến tính ≤3 năm, σ từ phần dư, phân nhóm SAFE/CONSIDER/REACH/RISKY/INSUFFICIENT_DATA, clamp bonus 2.75, luôn disclaimer) + `scholarship.ts` (lọc cứng loại thẳng, mềm tính điểm, thiếu = 0.5). Test `test/domain/admission-scholarship.test.ts` (6).
- Repository: `computeAdmissionProbability` (chọn tổ hợp tốt nhất từ điểm hồ sơ, lọc lịch sử theo tổ hợp), `listAspirations/addAspiration/deleteAspiration/reorderAspirations` (reorder tránh vi phạm UNIQUE(user,priority) bằng dời tạm +1000), `getMatchedScholarships`, `listSavedItems/addSavedItem/removeSavedItem`, `listGoals/addGoal/completeGoal`, `listReminders/addReminder/completeReminder`.
- Routes (student-only, helper `studentMutation/studentQuery/studentIdMutation`): `POST /api/v1/career/admission-probability`, `GET /api/v1/career/scholarship-matches`, `GET|POST /api/v1/aspirations` + `/reorder` + `/:id/delete`, `saved-items` + `/:id/delete`, `goals` + `/:id/complete`, `reminders` + `/:id/complete`. Test HTTP `test/http/aspiration-routes.test.ts` (3).
- UI `AspirationsPage.tsx` (thêm/sắp xếp/xóa nguyện vọng, badge xác suất kèm disclaimer, cảnh báo toàn rủi ro, học bổng phù hợp), route `/app/aspirations`, nav học sinh. Test `AspirationsPage.test.tsx`.
- Verify: `npm run verify` PASS.

## Phase 6A — AI provider + hạn mức (đã thêm)

- Chính sách AI CÂN BẰNG (chống hallucination): ưu tiên nguồn nhưng không ép; citation chỉ sinh từ server; guard tối thiểu (không siết quá).
- Domain `domain/ai/cost.ts` (estimateCostVnd, checkBudget, approximateTokens) + `domain/ai/guard.ts` (guardUserPrompt: EMPTY/TOO_LONG/INJECTION; looksLikeAnswerFishing). Test `test/domain/ai-cost-guard.test.ts` (6).
- Service `services/ai/providers.ts`: interface `AiProvider` chung + `OpenAiCompatibleProvider` + `AnthropicProvider` (retry 2, timeout, key chỉ ở header), `providerFromModel` (key từ env). Test `test/ai-providers.test.ts` (4, mock fetch).
- Migration `008_ai_provider.sql`: `ai_models.input_vnd_per_1k/output_vnd_per_1k/updated_at`, index usage.
- Repository: `listAiModels/upsertAiModel` (owner), `getAiUsageSummary`, `aiHealthCheck`. Routes `GET|POST /api/v1/ai/models`, `GET /api/v1/ai/usage`, `GET /api/v1/ai/health`. Test HTTP `test/http/ai-routes.test.ts` (2).
- UI `AiSettingsPage.tsx` (owner khai báo model + hạn mức, xem usage, kiểm tra kết nối; key ở env), route `/app/ai-settings`. Test `AiSettingsPage.test.tsx`.
- Verify: `npm run verify` PASS.

## Phase 6B — RAG ingestion (đã thêm)

- Migration `009_rag_chunks.sql`: `rag_chunks.embedding real[]` + `embedding_dim`; `rag_documents` nới `resource_id` NULL, thêm `lesson_id/source_kind/title/chunk_count/created_by/updated_at` + ràng buộc nguồn; index scope. Không cần pgvector để chạy local.
- Domain `domain/ai/rag.ts` (thuần): `chunkText` (tách đoạn có overlap), `localEmbed` (hashing trick, L2-normalize, tất định, offline), `cosineSimilarity`, `rankChunks`, `tokenize` (bỏ dấu tiếng Việt), `extractLessonText`. Test `test/domain/rag.test.ts` (7).
- Repository: `ingestRagContent` (LESSON/TEXT, chunk + embed + lưu, audit), `listRagDocuments`, `deleteRagDocument`, `searchRag` (+ helper `retrieveCitations` cosine tại app trong phạm vi RLS lớp/môn). Routes `GET|POST /api/v1/ai/rag/documents`, `DELETE /api/v1/ai/rag/documents/:id`, `POST /api/v1/ai/rag/search`. Đã thêm `DELETE` vào CORS.

## Phase 6C — Chat AI chính sách lai + UI (đã thêm)

- Domain `domain/ai/chat.ts` (thuần): `decideMode` (GROUNDED nếu có citation, ngược lại GENERAL), `buildSystemPrompt/buildContextBlock/buildUserPrompt`, `buildExtractiveAnswer` (fallback cục bộ khi chưa có model), `ANSWER_FISHING_RESPONSE`.
- Repository `chatWithAi`: guard → answer-fishing → truy hồi citation → gọi provider (nếu có key, có kiểm tra hạn mức + ghi `ai_usage_logs`) hoặc trả lời trích xuất cục bộ; lưu `ai_sessions/ai_messages` idempotent. `listAiSessions/getAiSessionMessages`. Routes `POST /api/v1/ai/chat`, `GET /api/v1/ai/sessions`, `GET /api/v1/ai/sessions/:id/messages`.
- UI: `AiAssistantPage.tsx` (chat mọi vai trò, hiển thị citation + nhãn chế độ, chọn phạm vi môn/lớp) và `AiKnowledgePage.tsx` (giáo viên/hiệu trưởng nạp/xóa tài liệu). Nav + route tương ứng. Test HTTP `test/http/rag-routes.test.ts` (3), web `AiAssistantPage.test.tsx` (2) + `AiKnowledgePage.test.tsx` (1), integration `test/rag.integration.test.ts`.

## Phase 7 — Gói dịch vụ / Billing (đã thêm)

- Repository: `getSchoolBillingOverview` (owner: trạng thái + số lớp + chi phí `calculateMonthlyCharge` + lịch sử `billing_events`), `adminListSubscriptions`, `adminUpdateSubscription` (trạng thái/hạn mức/đơn giá + audit), `adminRecordBillingEvent`, `adminListBillingEvents`.
- Routes: `GET /api/v1/billing/overview` (owner), `GET /api/v1/admin/billing/subscriptions`, `PUT /api/v1/admin/schools/:id/subscription`, `GET|POST /api/v1/admin/schools/:id/billing-events` (admin).
- UI: `BillingPage.tsx` (owner) + `AdminBillingPage.tsx` (admin) + nav. Test HTTP `test/http/billing-routes.test.ts` (3), web `BillingPage.test.tsx` (2), integration `test/billing.integration.test.ts`.

## Seed + tài liệu chạy local (đã cập nhật)

- Seed `seed-pilot.ts` thêm một model AI demo (bật sẵn) và một tài liệu tri thức mẫu (kèm embedding cục bộ) cho THPT Nguyễn Du → Trợ giảng AI trả lời có trích dẫn ngay khi test local, không cần key.
- `.env.example` thêm khối AI (`AI_BASE_URL`, `AI_OPENAI_API_KEY`, `AI_ANTHROPIC_API_KEY`, `AI_EMBEDDING_MODEL`) — bỏ trống vẫn chạy (fallback trích xuất).
- README bổ sung cảnh báo migration chỉ chạy trên volume trống (dùng `docker compose down -v` khi nâng cấp schema local) và hướng dẫn thử nhanh Trợ giảng AI.

## Cải tiến UI, Anti-flicker, 404 & Request Tracker (2026-08-26)

- **Anti-flicker & Animation**: Sửa lỗi chu kỳ shimmer 280ms thành 1.8s êm dịu, nới lỏng timing `--motion-fast` (200ms), `--motion-base` (280ms), `--motion-slow` (450ms), chuyển sang easing `cubic-bezier(0.2, 0.8, 0.2, 1)`, làm mượt `form-message` và loại bỏ gián đoạn trắng khi chuyển route trong `PublicEnter`. Bổ sung rule `@media (prefers-reduced-motion: reduce)`.
- **Nâng cấp trang 404**: Trang công khai `NotFoundPage.tsx` có huy hiệu 404 la bàn, nút quay lại trang trước, chuyển tiếp về trang chủ/workspace tùy trạng thái đăng nhập, và lưới lối tắt nhanh (Bài giảng, Hướng nghiệp, Hồ sơ, Mở trường). Bổ sung `WorkspaceNotFound` cho các route con không tồn tại trong `/app/*`.
- **Bộ chỉ báo xử lý Backend chậm/lâu**: Thêm `requestTracker.ts` hook vào `apiRequest` và component `GlobalLoadingIndicator.tsx` (Top Loading Bar mỏng nhẹ ở đỉnh màn hình + Floating Slow Request Toast khi request kéo dài >2s và cảnh báo rõ khi >6s).

## Kiểm tra đã xác nhận (2026-08-26)

- `npm run verify`: PASS — typecheck (contracts+api+web), **146 unit/API tests**, **41 web tests**, production build.
- Ghi chú lịch sử: tại thời điểm 2026-08-26 integration cần Docker; kết quả mới nhất là 31/31 test pass trên stack cô lập.

## Việc còn lại (HOÃN theo yêu cầu người dùng)

- Phase 8 (Production VPS + votuankiet.io.vn) và Phase 9 (kiểm chứng cuối + tài liệu) tạm hoãn; ưu tiên hiện tại là test được local.
- Cổng kiểm chứng lịch sử đã được thay bằng `npm run test:release:isolated` (teardown tự động trong `finally`).
