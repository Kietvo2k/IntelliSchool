# Báo cáo kiểm thử tương tác toàn bộ Smart Path Platform — 2026-08-31

## Kết luận ngắn

Đã kiểm thử theo hành trình người dùng trên production image chạy trong Docker test stack và Browser thật, không chỉ mở route. Phần lớn chức năng lõi có thể đi qua; tuy nhiên còn nhiều lỗi làm sai phản hồi người dùng hoặc làm hỏng handoff giữa các vai trò.

**Verdict chức năng hiện tại: PARTIAL — chưa sẵn sàng sử dụng production.**

Lỗi nghiêm trọng nhất là nhóm form bất đồng bộ: server đã commit dữ liệu nhưng UI báo thất bại. Người dùng có thể bấm lại và tạo bản ghi trùng hoặc tưởng thao tác không thành công. CBT cũng có thể tự nộp bài khi Browser không giữ được fullscreen, còn AI worker có lỗi SQL trong hàng đợi nền.

Trong vòng retest này không sửa logic sản phẩm, schema hoặc config. Kết quả được lưu trong chính file Markdown này.

## Môi trường và bằng chứng

- App test image được build từ working tree hiện tại bằng Docker.
- Browser thật: Codex in-app Chromium, app tại `http://127.0.0.1:18080`.
- Dependency Docker: PostgreSQL, MinIO, ClamAV, Mailpit; app-test healthy.
- Main stack `http://127.0.0.1:5176` không bị thay đổi dữ liệu bởi các thao tác ghi của vòng này.
- `/healthz`: HTTP 200, `status=ok`.
- Snapshot sau retest: 16 users, 5 classes, 11 assignments, 83 audit events trên stack test.
- Các suite đã có trước vòng này: API/unit 202/202, web 57/57, integration 36/36, Browser E2E 28/28, production build 2.324 modules pass. Các suite đó không thay thế các thao tác Browser trong báo cáo này.

## Ma trận kết quả theo nhóm chức năng

| Nhóm | Kết quả | Điều đã thực hiện | Thiếu sót/finding chính |
|---|---|---|---|
| Landing/public | PASS | Điều hướng, form mở trường, validation rỗng, gửi hai yêu cầu | Cần kiểm thêm metadata/production domain thật |
| Auth/onboarding | PASS/PARTIAL | Registration bằng mã trường, duyệt/reject, Mailpit, activation, login bằng mật khẩu mới, forgot/reset password | Duyệt school request tạo invitation nhưng không gửi activation email |
| Platform admin — trường | PASS/PARTIAL | Duyệt/reject, danh sách, detail, lọc | Nút “Tải danh sách trường” chỉ reload, không tải file |
| Platform admin — users | PASS | Lọc role, khóa/mở khóa, revoke sessions | Invite admin chưa hoàn tất vì cần thêm luồng email riêng |
| Platform admin — billing/audit | PASS | Đổi subscription, quota, giá, ghi payment event, lọc audit | Lọc action là exact match nhưng UI không giải thích điều này |
| Catalog hướng nghiệp | PASS/PARTIAL | Lọc tỉnh, detail, tạo nghề/trường, crawl URL sai | URL HTTP trả generic error thay vì thông báo validation cụ thể |
| Owner — lớp | FAIL | Tạo lớp, phân công GV, ghi danh HS | Cả ba POST trả 201/commit nhưng UI báo “Chưa thể…” |
| Owner/teacher — bài giảng | PASS/PARTIAL | Tạo draft rich content, công thức, publish, archive, học sinh xem/complete | Video YouTube hiển thị Error 153 |
| Thư viện tài nguyên | PASS/PARTIAL | Upload TXT, quarantine, ClamAV → READY | Download bị Browser chuyển sang trang không truy cập được |
| Question bank | FAIL/PASS | Tạo bank, tạo 4-eyes question, approve đúng người, import CSV preview/commit | Tạo bank/question commit thành công nhưng UI báo fail |
| Assignment | PASS | Tạo 5 câu đủ dạng, sửa điểm/thứ tự, publish/close, học sinh làm/nộp | Một số save không có feedback rõ |
| Chấm/gradebook | PASS/PARTIAL | Chấm essay, return, exact score 6/6, override 5.5/6, report | Filter học sinh có tên trùng khi cùng user ở nhiều lớp |
| Export | PASS/PARTIAL | Tạo export, worker đưa DB thành READY | UI giữ QUEUED hơn 15 giây và chỉ hiện READY sau refresh; download bị Browser chặn |
| CBT/proctor | PARTIAL/FAIL | Sai mã, sai PIN, đúng PIN, resume, trả lời, heartbeat, integrity, auto-submit | Browser không fullscreen → 3 strike → auto-submit khi mới trả lời 1/5 |
| Adaptive/skill graph | PASS/PARTIAL | Tạo draft, gửi duyệt, GV đúng môn approve, diagnosis | GV không có menu skill graph/adaptive/skill drafts; phải biết direct URL |
| AI học tập/RAG | PASS/PARTIAL/FAIL | Chat grounded, citation, fallback label, toggle Agentic, ingest/remove RAG | Fallback thay model thật; Agentic không tạo `ai_jobs`; worker lỗi `u.role` |
| Career quiz/results | PASS/PARTIAL | 20 câu SCDP, essay, RIASEC 30 nhóm, điểm học, profile, kết quả, search/compare | Career AI không chạy khi provider thiếu cấu hình; dữ liệu admission chưa đủ để estimate |
| Aspirations/scholarship | PASS/PARTIAL | Thêm 2 nguyện vọng, reorder, estimate, học bổng | Estimate báo thiếu dữ liệu dù đã có nhiều điểm; cần UX giải thích rõ hơn |
| Messaging | PASS | Teacher gửi → student nhận → student trả lời, channel lớp/1-1 | Không có trạng thái gửi thành công riêng ngoài log tin nhắn |
| Profile/session | PASS/PARTIAL/FAIL | Career profile, transcript, knowledge card, session view | Email hiển thị rỗng; profile PATCH SQL lỗi, tên không lưu dù UI đã nhập |
| Mobile/accessibility/performance | PARTIAL | Desktop/mobile route inspection, touch target, drawer, LCP/FMP | Header truncation, control nhỏ, CBT 320px overflow, route transition stale |

## Findings cần ưu tiên

### F-001 — S4 Critical: form báo thất bại sau khi server đã commit

**Affected:** tạo lớp, phân công giáo viên, ghi danh học sinh, tạo question bank, tạo question, tạo skill graph, thêm AI model và các form dùng pattern tương tự.

**Bằng chứng thực tế:**

- POST `/api/v1/classes` trả HTTP 201 với object lớp hợp lệ; UI hiển thị `Chưa thể tạo lớp. Vui lòng thử lại.`; database vẫn có lớp `E2E12A2`, `E2E12A3`, `E2E12A4`.
- POST phân công giáo viên trả thành công; UI hiển thị `Chưa thể phân công giáo viên`; database có assignment.
- POST ghi danh trả thành công; UI hiển thị `Chưa thể ghi danh học sinh`; database có enrollment.
- Tạo question bank/question/skill graph/model cũng lặp cùng hành vi.

**Expected:** sau commit hiển thị success, reset form và refresh danh sách.

**Actual:** catch chạy sau commit, form không reset, danh sách không refresh; người dùng có thể retry và tạo dữ liệu lặp.

**Nguyên nhân quan sát được:** handler gọi `event.currentTarget.reset()` sau `await`; khi event target không còn hợp lệ, exception xảy ra sau request đã commit. Pattern xuất hiện ở `apps/web/src/routes/ClassesPage.tsx`, `QuestionBanksPage.tsx`, `SkillGraphsPage.tsx` và `AiSettingsPage.tsx`.

**Tái hiện:** đăng nhập owner → `Lớp & giáo viên` → tạo mã lớp mới → kiểm thông báo fail → reload trang → lớp đã tồn tại.

### F-002 — S4 Critical: cập nhật profile thất bại do SQL parameter type mismatch

**Expected:** đổi tên/email hợp lệ trả success và database đổi đúng.

**Actual:** UI trả `Hệ thống gặp lỗi không mong muốn. Vui lòng thử lại.`; tên đã nhập không được lưu. PostgreSQL ghi lỗi `42P08 inconsistent types deduced for parameter $2`, truy vấn audit dùng cùng `$2` cho uuid và text.

**Bằng chứng:** xảy ra với profile admin và học sinh; database vẫn giữ tên cũ. Log nằm trong app-test/PostgreSQL trong thời gian retest.

**Impact:** người dùng không thể tin trạng thái hồ sơ; retry có thể tạo lỗi duplicate email; audit profile update không hoàn tất.

### F-003 — S3 Major: duyệt school request không gửi email activation

**Expected:** admin duyệt yêu cầu mở trường → owner nhận email activation.

**Actual:** UI tạo school, owner, membership và invitation pending; Mailpit vẫn `0 messages` sau thao tác approve school request. Registration thành viên thì có email, nhưng school onboarding không có.

**Impact:** hiệu trưởng mới không có đường dẫn kích hoạt nếu không có cách lấy token khác; onboarding bị kẹt.

### F-004 — S3 Major: AI background worker dùng cột không tồn tại

**Expected:** job AI `QUEUED/RUNNING` được worker claim và xử lý.

**Actual:** PostgreSQL ghi `ERROR: column u.role does not exist` tại `apps/api/src/repositories/postgres-platform.ts:3153-3154`, trong query `SELECT ... u.role FROM ai_jobs ...`. Schema `users` không có cột `role`.

**Impact:** AI async job có thể không được xử lý dù app/healthcheck vẫn xanh.

### F-005 — S3 Major: CBT tự nộp bài vì integrity lock trong Browser thật

**Scenario:** học sinh vào đúng ca Hóa, resume session, trả lời câu 1, tiếp tục câu 2.

**Expected:** Browser test surface vẫn cho làm bài hoặc hiển thị lỗi fullscreen trước khi bắt đầu.

**Actual:** Browser in-app không giữ `document.fullscreenElement`; thao tác bị tính là rời trang. Sau 3 strike, hệ thống khóa và tự nộp khi mới trả lời 1/5; dialog hiển thị `0.25/1.75 (tạm tính)` và `INTEGRITY_STRIKES`. Database ghi `lock_reason=INTEGRITY_STRIKES`, `finalization_reason=INTEGRITY_LOCK`.

**Phân loại:** lỗi chức năng nghiêm trọng trong bề mặt Browser yêu cầu kiểm thử; có thể cần xử lý riêng nếu sản phẩm chủ đích chỉ hỗ trợ browser fullscreen thực sự.

### F-006 — S3 Major: export không tự cập nhật trạng thái

**Expected:** sau khi job READY, UI tự chuyển từ QUEUED sang READY hoặc có nút refresh/poll rõ.

**Actual:** DB đã READY nhưng UI vẫn hiển thị QUEUED sau hơn 15 giây; reload mới hiện `READY` và `Tải file`.

**Impact:** người dùng tưởng worker bị treo và có thể bấm export lặp.

### F-007 — S3 Major: feature adaptive có route nhưng không có đường đi trong nav giáo viên

**Expected:** giáo viên có thể tìm và duyệt skill graph/draft từ menu nếu role được phép.

**Actual:** role teacher được backend/route cho phép nhưng menu chỉ có lớp, lesson, assignment, gradebook… Không có `Đồ thị kỹ năng`, `Lớp theo nhu cầu` hay `Skill nháp`. Tôi phải dùng direct URL để hoàn tất 4-eyes approval.

**Phân loại:** `MISSING UI` và lỗi discoverability; người dùng bình thường không thể hoàn tất workflow.

### F-008 — S3 Major: lesson video không chạy

**Expected:** video lesson hiển thị player hoặc fallback link rõ ràng.

**Actual:** iframe YouTube hiển thị `Error 153 — Video player configuration error` trong lesson đã publish. Nội dung text vẫn đọc được.

### F-009 — S3 Major: career analysis không hoàn tất khi thiếu AI provider

**Expected:** nếu fallback được thiết kế, hiển thị fallback rõ; nếu cần provider, hiển thị trạng thái cấu hình và hướng dẫn.

**Actual:** `Chạy phân tích` trả `Nhà trường chưa cấu hình AI. Không chạy phân tích giả.`; người dùng không nhận được analysis dù đã hoàn thành quiz/profile/điểm.

**Phân loại:** `PARTIAL` do môi trường thiếu provider, nhưng UX chưa dẫn người dùng tới cách khắc phục.

### F-010 — S2 Minor/Major: các nút tải file không nhất quán

- `Tải danh sách trường` là button gọi lại `load()`, không tạo download.
- `Tải xuống` tài nguyên và `Tải file` export bị Browser chuyển sang trang `This site can’t be reached`; chưa có đường fallback hoặc thông báo.
- Template CSV cũng cần được kiểm trên Browser download surface riêng.

### F-011 — S2 Minor: crawl URL sai trả generic error

**Scenario:** admin nhập `http://example.com` vào ô `URL HTTPS`.

**Expected:** lỗi validation cụ thể “HTTPS required”.

**Actual:** UI chỉ hiện `Hệ thống gặp lỗi không mong muốn. Vui lòng thử lại.`; app log ghi `Error: HTTPS is required`.

### F-012 — S2 Minor: các form async thiếu feedback hoặc refresh

- Career Dashboard thêm goal đã ghi database nhưng không hiện ngay; chỉ thấy sau đổi tab.
- Một số route không có loading riêng, vùng rỗng không phân biệt đang tải với không có dữ liệu.
- Lỗi `is-error` ở nhiều route dùng `role=status` thay vì `role=alert`.

## Bổ sung bằng chứng từ vòng kiểm thử tiếp theo

### F-013 — S4 Critical: cả bốn loại câu hỏi đều commit nhưng hiển thị thất bại

**Scenario:** owner mở `Ngân hàng Toán 12` và lần lượt tạo `TRUE_FALSE`, `SHORT_ANSWER` và `ESSAY` có rubric; câu `MULTIPLE_CHOICE` seed đã có sẵn.

**Expected:** mỗi loại câu hỏi được tạo một lần, thông báo success và xuất hiện ngay trong danh sách.

**Actual:** cả thao tác tạo mới đều hiện `Chưa thể tạo câu hỏi.` dù POST đã commit. Đối chiếu database sau thao tác cho thấy ngân hàng có đúng 2 bản ghi của mỗi loại `MULTIPLE_CHOICE`, `TRUE_FALSE`, `SHORT_ANSWER`, `ESSAY`. Đây là bằng chứng độc lập củng cố F-001, không phải lỗi riêng của một loại câu hỏi.

**Impact:** giáo viên có thể retry và tạo bản ghi trùng, hoặc bỏ cuộc vì nghĩ dữ liệu không được lưu; workflow assignment sau đó vẫn nhìn thấy câu hỏi đã commit.

### F-014 — S2 Minor: Career Dashboard ghi goal bất đồng bộ nhưng không phản hồi tức thời

**Scenario:** học sinh mở trực tiếp `/app/career-dashboard`, thêm goal `Hoàn thành đề cương E2E`, sau đó chuyển tab.

**Expected:** goal xuất hiện ngay sau success response hoặc có trạng thái pending rõ ràng.

**Actual:** database đã có row `ACTIVE`, nhưng UI không đổi và không có success message; goal chỉ xuất hiện sau khi chuyển tab. Các tab `Nguyện vọng`, `Tiến độ`, `Lộ trình`, `Trắc nghiệm` vẫn render được. Đây là một trường hợp tái hiện rõ của F-012 và cho thấy route ẩn khỏi nav student vẫn hoạt động nếu người dùng biết URL.

### F-015 — S2 Minor: AI Thinking/source/refusal hoạt động, nhưng vẫn là fallback cục bộ

**Scenario:** học sinh bật `Thinking`, chọn `Nguồn thư viện`, hỏi công thức đạo hàm rồi hỏi xin đáp án trực tiếp.

**Expected:** trạng thái model/agent được phản ánh đúng; câu hỏi ngoài chính sách học tập bị từ chối; câu hỏi có nguồn có citation.

**Actual:** toggle hiển thị `Thinking=true`, `Tiêu chuẩn=false`; câu trả lời có citation `[1] Ôn tập đạo hàm cơ bản`, trace `retrieve_school_material · Đã hoàn tất` và ghi rõ đang dùng trả lời trích xuất cục bộ vì thiếu API key. Câu hỏi xin đáp án bị từ chối đúng với thông điệp hướng dẫn học. Chức năng grounded/refusal đạt, nhưng đây chưa phải bằng chứng model Thinking thật; phân loại `PARTIAL` và phải giữ nhãn fallback.

### PASS-016 — Assignment exam mode: tạo và vào đúng kỳ thi

Owner tạo `E2E Exam Mode Full` gồm 5 câu đủ dạng, chọn `Thi thử trên máy`, thời lượng 20 phút, PIN và kỳ `Thi thử tốt nghiệp`; publish chuyển sang `Đang mở`. Học sinh chọn đúng exam, nhập mã/PIN hợp lệ và vào phòng có đúng tiêu đề, môn Toán, timer 19:59 và integrity `0/3`. Đây là PASS cho setup/entry exam mode; không thay đổi kết luận F-005 về strict fullscreen/integrity auto-submit.

## Kết quả user journey

### Người mới/public

- Có thể hiểu landing và tìm “Mở trường”.
- Validation bắt buộc hoạt động.
- Yêu cầu mở trường được ghi nhận, admin thấy và approve/reject được.
- Registration thành viên có email activation; activation và reset password hoạt động.
- School approval chưa hoàn chỉnh vì không có email activation cho owner.

### Hiệu trưởng

- Dashboard, billing, registration, lesson, resource, question, assignment, AI settings, knowledge, adaptive và proctor đều mở được.
- Tạo lớp/phân công/ghi danh thực sự ghi dữ liệu nhưng phản hồi sai là failure.
- Tạo question bank, model, skill graph cũng mắc cùng pattern.
- Có thể thay đổi subscription và ghi payment/audit event.

### Giáo viên bộ môn/chủ nhiệm

- Lesson, resource, question import, assignment, grading, gradebook, progress, messages và proctor hoạt động ở mức lõi.
- Giáo viên chủ nhiệm xem được học sinh đã chia sẻ profile.
- Adaptive/skill graph backend hoạt động khi vào direct URL, nhưng không discoverable từ nav teacher.
- Chấm essay và trả điểm cuối đã xác minh qua học sinh.

### Học sinh

- Xem lesson và đánh dấu hoàn thành; điểm lesson lưu được.
- Assignment đủ bốn dạng câu có thể trả lời, nộp, chấm và nhận exact final score 6/6.
- CBT đúng mã/PIN vào được; sai mã/PIN bị chặn; resume answer hoạt động.
- CBT strict integrity trong Browser test surface có thể auto-submit ngoài ý muốn.
- Career quiz/RIASEC/profile/results/compare/aspiration hoạt động; career AI bị chặn khi thiếu provider.
- AI học tập trả lời grounded và hiển thị rõ đang dùng extractive fallback.
- Messaging hai chiều teacher–student hoạt động.

## UI/UX và cảm nhận người dùng

- Không có lag toàn app sau khi tải, nhưng route transition thường giữ màn cũ trong 1–2 giây rồi mới hiện màn mới.
- Người dùng mới gặp nav dài và các route quan trọng bị ẩn khỏi menu.
- Nút hành động nhỏ ở nhiều màn; header mobile cắt brand/tên người dùng.
- Empty state thường có nội dung tốt, nhưng loading/error chưa đồng nhất.
- Một số thông báo thành công chỉ xuất hiện sau reload hoặc đổi tab.
- Landing vẫn có visual hierarchy tốt nhưng còn các pattern template: fake browser chrome, feature cards đồng trọng số và icon/card lồng.

## Đối chiếu backend/database

Các thao tác sau đã được đối chiếu bằng database:

- School request approve/reject và audit events.
- Class create/teacher assignment/student enrollment.
- Lesson create/publish/archive và progress.
- Resource upload → READY.
- Question bank/question/version/import/approval.
- Assignment items, attempt, answer, essay grading, grade override.
- Billing subscription/payment event.
- Transcript, career profile, knowledge card, goals, aspirations, messages.
- Export queue chuyển READY.
- CBT session lock/finalization/answer rows.

Những log sản phẩm cần xử lý: profile SQL `42P08`, AI worker `u.role`, duplicate email sau profile submit và crawl HTTP generic error. Các query chẩn đoán thủ công sai tên cột trong quá trình audit không được tính là lỗi sản phẩm.

## Điểm đánh giá vòng retest

| Trục | Điểm |
|---|---:|
| Core functional execution | 7,8/10 |
| User journey completion | 6,8/10 |
| Data/result integrity | 6,2/10 |
| Loading/error/recovery | 5,8/10 |
| UI/accessibility/responsive | 7,2/10 |
| Performance after load | 8,0/10 |
| Feature discoverability/completeness | 6,4/10 |
| **Tổng chức năng + UX** | **6,8/10** |

## Verdict

- **Docker:** chạy được và healthy.
- **Website:** phần lớn màn và workflow lõi chạy được.
- **Dữ liệu:** có nhiều bằng chứng commit thành công nhưng UI báo fail; đây là lỗi cần ưu tiên cao.
- **CBT:** có thể làm bài nhưng strict integrity chưa tương thích ổn định với Browser test surface.
- **AI:** fallback học tập chạy được và được gắn nhãn; career analysis/provider và background worker chưa hoàn chỉnh.
- **Production readiness:** **DO NOT SHIP** cho đến khi xử lý F-001, F-002, F-003, F-004, F-005 và F-006.

## Bằng chứng runtime lưu ở đâu

- Báo cáo duy nhất của vòng này: `docs/quality/full-interaction-retest-2026-08-31.md`.
- Docker test data nằm trong các volume disposable của compose test và sẽ được teardown sau khi hoàn tất verify.
- Không lưu token activation, mật khẩu hoặc dữ liệu người thật vào báo cáo.

## Verification cuối sau toàn bộ retest

- Vòng kiểm thử tiếp theo đã chạy lại `npm run test:e2e:stack:build` thành công; app-test và các dependency đều healthy trước khi teardown.
- `npm run test:release:isolated`: **exit 0**.
- API/unit: **202/202 pass**; web unit/component: **57/57 pass**.
- Integration: **36/36 pass**.
- Browser Chromium E2E: **28/28 pass**.
- Production build: **2.324 modules**, bundle budget pass.
- Stack test đã teardown toàn bộ container/network/volume disposable; `docker compose -f docker-compose.test.yml ps` không còn service.
- Main stack vẫn healthy (`smartclass-platform-app-1`, `smartclass-platform-postgres-1`); `/healthz` trả HTTP **200**.
- Các finding trong báo cáo này đến từ thao tác Browser tương tác đầy đủ; suite xanh không phủ định các lỗi commit/UI feedback đã tái hiện.
## Vòng khắc phục 2026-08-31

Đã bổ sung bằng chứng runtime sau khi sửa lỗi: typecheck PASS; unit 202/202; web 59/59; integration 36/36; Browser E2E 28/28; release check PASS; production build 2.325 modules và bundle budget PASS.

- F-001/F-013: form capture trước `await`, single-flight/idempotency chống duplicate.
- F-002: profile PATCH và audit `target_id` text đã đối chiếu PostgreSQL.
- F-003: approval gửi Mailpit, activation một lần và lỗi `INVITATION_ALREADY_USED`.
- F-004/F-015: AI recovery dùng `school_memberships.role`, job hoàn tất và ghi fallback.
- F-005: fullscreen/blur không tự submit; strike lock giữ bài; timeout finalizer đã thêm.
- F-006/F-010: export poll/retry, binary download cùng origin và CSV trường thật.
- F-007/F-008/F-011: navigation adaptive, video referer/origin/fallback và crawler 422 cụ thể.

F-012/F-014 còn thiếu regression Browser riêng cho mọi form/career draft/focus; repository chưa có `npm run lint`. Release readiness: PARTIAL, chưa READY production.
## Review follow-up — 2026-08-31

- Review xác nhận và sửa: approval giữ commit khi SMTP unavailable (`activationEmailQueued=false`), approval replay cùng idempotency key trả cùng school, resend activation gửi thành công sau khi Mailpit sẵn sàng.
- Review xác nhận và sửa: finalizer hết giờ ghi `TIME_LIMIT` kể cả session đã lock; export chỉ polling khi có job active và không xóa list khi refresh lỗi; profile dùng stable idempotency action.
- Runtime disposable: approval không SMTP `200/false`, replay `200` cùng school; resend với Mailpit `200/true`; timeout finalizer ghi `submitted=true`, `finalization_reason=TIME_LIMIT`.
- Regression sau review: typecheck PASS; API unit 202/202; web 59/59; integration 36/36 khi không chạy app worker đồng thời với database reset.

## Release blocker regression contract — 2026-08-31

Phần này được ghi trước khi bổ sung helper hoặc test regression. Các finding F-001 đến F-014 là bằng chứng RED lịch sử cho các bản sửa đã có runtime evidence nhưng chưa có Browser regression độc lập. Mọi finding correctness mới phải có test RED quan sát được trước khi sửa production code.

| Case | Given – When – Then | UI | API/database |
|---|---|---|---|
| F-001/F-013 form | Owner tạo lớp hoặc question bank/question duy nhất rồi submit nhanh hai lần; sau POST 201 danh sách refresh lỗi | Success, reset form, không báo tạo thất bại | Một mutation và một row |
| F-001 AI/graph | Owner tạo model/skill graph hợp lệ, rồi gửi endpoint sai hoặc graph cycle | Success là status; lỗi là alert | Dữ liệu hợp lệ persisted, input sai không commit |
| F-002 profile | User cập nhật tên/email, reload, rồi thử email đã tồn tại | Header đổi ngay; duplicate là alert và focus error summary | Một audit `PROFILE_UPDATED`, `target_id` text; không ghi duplicate |
| F-003 onboarding | Public request được admin duyệt; SMTP unavailable rồi resend | Có trạng thái resend rõ | Mailpit recipient đúng; activation một lần; replay không duplicate |
| F-004 AI job | Thinking job reload khi active và recovery queued/stale/deadline | Progress khôi phục đến terminal, fallback được gắn nhãn | Lease/retry/timeout và metadata persisted |
| F-005 CBT | Strict exam ở 375/768, desktop blur/fullscreen/visibility, reload và submit nhanh | Chặn trước session ở mobile; lock không tự nộp | Autosave, `TIME_LIMIT`, một attempt và proctor event đúng |
| F-006/F-010 export/download | Resource/export/CSV trường được tải; MinIO fail rồi retry | Poll trạng thái và retry rõ | Binary, MIME, filename, nội dung đúng |
| F-007/F-008/F-012/F-014 | Teacher/student nav adaptive, video fallback, goal và Career AI thiếu provider | Quyền/nav/fallback/loading/error/retry có semantic role đúng | Goal persisted và route trái quyền bị chặn |

## Release gate thực thi lại — 2026-09-01

| Hạng mục | Kết quả | Bằng chứng mới |
|---|---|---|
| Lint gate | PASS | `npm run lint` exit 0, warning cũng fail qua `--max-warnings 0`. |
| Typecheck | PASS | `npm run typecheck` exit 0. |
| API unit | PASS | 202/202. |
| Web unit/component | PASS | 59/59. |
| Integration isolated | PASS | 19 file, 36 test; gồm RAG/AI job metadata, CBT, export và adaptive. |
| Browser E2E Docker | PASS | 28/28 Chromium trên `http://127.0.0.1:18080`, image production được rebuild từ working tree. |
| Production build/bundle | PASS | Contracts, API, Vite build và bundle budget pass. |
| Docker cleanup | PASS | `docker compose -f docker-compose.test.yml ps` rỗng sau release workflow. |
| Diff hygiene | PASS | `git diff --check` exit 0. |

### Khắc phục trong lượt này

- Bổ sung ESLint flat config và đưa lint vào `verify`/release gate.
- Sửa hook order của loading indicators; test SSR dùng `AppQueryProvider` như composition production.
- Sửa focus/error semantics của Profile, AI settings và skill graph.
- Persist và trả metadata AI job (provider/model/fallback/token/cost/tool trace); claim/recovery tôn trọng lease, retry time và attempt limit.
- Docker Desktop host được phục hồi bằng cách tách các runtime socket stale sang thư mục `*.stale-*`, backup settings store và tắt Docker AI. Không factory reset hay xóa data Docker chính.

### Lưu ý release

`npm audit --audit-level=high` không fail. Log vẫn có 3 advisory `moderate` transitive qua MinIO; không được xử lý trong lượt functional/release gate này.

**Verdict hiện tại: PARTIAL.** Các gate hiện có đều pass và Docker test stack đã sạch, nhưng các Browser regression mới được định nghĩa trong contract chưa được tạo đầy đủ thành bốn suite 09–12; do đó chưa đủ bằng chứng để nâng verdict lên READY.
