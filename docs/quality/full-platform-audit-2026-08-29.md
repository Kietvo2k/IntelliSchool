# Audit toàn diện Smart Path Platform — 2026-08-29
> **Bằng chứng lịch sử:** không suy ra trạng thái release hiện tại từ báo cáo này. Retest theo `ACCEPTANCE_MATRIX.md`.

## Kết luận điều hành

**Điểm tổng cập nhật: 7,0/10 (B-) — chưa đủ điều kiện triển khai production công khai.**

Hệ thống có độ phủ chức năng rộng, UI nhất quán, dữ liệu demo tốt và bộ test tự động mạnh. Các unit/integration/browser release gate đều xanh, nhưng production stack vẫn ghi nhận lỗi SQL trong AI background worker và một số lỗi UX P1. Audit độc lập cũng phát hiện một lỗ hổng mức **Critical/P0** trong tính năng chạy JavaScript của AI: mã do người dùng gửi có thể truy cập `process` và `process.getBuiltinModule` của Node. Đây là khả năng thoát sandbox và có thể dẫn tới đọc secret/file, truy cập mạng nội bộ hoặc thực thi mã trên máy chủ.

**Ship Gate: DO NOT SHIP** cho đến khi tắt hoặc cô lập đúng nghĩa tính năng chạy mã, bổ sung regression test, rồi chạy lại toàn bộ cổng release.

### Bổ sung kiểm chứng runtime — 2026-08-30

- Đã rebuild Docker production image từ working tree và xác nhận app + PostgreSQL healthy.
- Sửa bootstrap local: `docker/entrypoint.sh` chạy pilot seed bằng `NODE_ENV=development` riêng cho tiến trình seed; API server vẫn chạy `NODE_ENV=production`. Trước sửa, app restart loop vì seed từ chối chạy trong production; sau sửa, healthcheck container pass.
- Browser smoke trên `http://127.0.0.1:5176/`: landing render đầy đủ, console/network/runtime không lỗi; DOMContentLoaded khoảng 0,57 giây, First Meaningful Paint khoảng 0,75 giây.
- Cổng `8080` hiện bị Apache khác trên host chiếm và trả HTTP 404. Container Smart Path vẫn publish đúng tại `5176`; biến `APP_BASE_URL`/hướng dẫn chạy local cần đổi sang cổng không xung đột trước khi dùng flow email ngoài môi trường test.

## Phạm vi và môi trường

- Repo chính: `smartclass-platform`.
- Hai repo Neko/SCDP chỉ được dùng đối chiếu, không sửa.
- Production-mode local: `http://127.0.0.1:5176`, Docker app + PostgreSQL. Cổng `8080` được giữ nguyên cho Apache đang chạy trên host.
- Trình duyệt thật: Codex in-app Chromium, kiểm tra DOM, screenshot, console, network và responsive.
- Stack test cô lập: PostgreSQL, MinIO, ClamAV, Mailpit, app production image và Playwright Chromium.
- Chưa có URL production công khai trong tài liệu; deploy VPS/domain đang hoãn.

## Bằng chứng kiểm thử mới

| Cổng | Kết quả mới |
|---|---|
| Typecheck + API/unit | 50 file, **202/202 test pass** |
| Web unit/component | 38 file, **57/57 test pass** |
| Integration cô lập | 19 file, **36/36 test pass** |
| Browser E2E cô lập | **28/28 test pass** |
| Browser production-mode | 56 màn theo 4 vai trò render được; không HTTP ≥400 ngoài 403 đúng quyền, runtime exception hoặc console warning/error trong route matrix thủ công; kiểm tra timing/async phát hiện các lỗi UX P1 bên dưới |
| Responsive | 7 màn đại diện × 320/375/768/1024/1440 px; các màn chính không tràn ngang, nhưng CBT ở 320 px tràn 26 px (đã ghi nhận PARTIAL vì màn thi yêu cầu desktop) |
| Accessibility | Axe WCAG 2A/2AA không có violation serious/critical tại 4 breakpoint; touch target hiển thị trên dashboard mobile đều ≥44 px |
| Phân quyền | Học sinh mở trực tiếp route quản trị nhận trang 403 đúng vai trò |
| Production build | Pass; 2.324 module; bundle budget pass |
| Dependency audit | 0 vulnerability; 443 package có chữ ký registry, 95 package có attestation |
| Diff hygiene | `git diff --check` pass |
| Production rebuild + smoke | Container app/PostgreSQL healthy; landing Browser pass tại `5176`; `8080` xung đột Apache host |

### Bundle

| Chunk | Gzip |
|---|---:|
| Initial JS | 142,61 KiB |
| Workspace routes | 82,76 KiB |
| Markdown/KaTeX lazy | 119,44 KiB |
| CSS chính | 16,48 KiB |

## Retest mở rộng UI/UX và hành vi bất đồng bộ — 2026-08-30

Browser thật đã đi qua **56 route theo menu hiển thị** trên bốn vai trò: platform admin (8), hiệu trưởng (20), giáo viên (13) và học sinh (15). Các route đều render được, không phát sinh HTTP 4xx/5xx ngoài trạng thái 403 đúng quyền và không có console error trong ma trận. Tuy nhiên, kiểm tra timing, trạng thái rỗng/lỗi, responsive và touch target phát hiện các vấn đề sau:

| Mức | Khu vực | Expected | Actual/bằng chứng | Đánh giá |
|---|---|---|---|---|
| **P1** | Chuyển route trong workspace | URL đổi cùng lúc nội dung mới hiện hoặc có loading ngắn, không để màn cũ gây hiểu nhầm | Khi chọn `Duyệt trường`, URL và nav đổi trước nhưng h1/dashboard cũ vẫn hiển thị; route mới còn opacity 0 sau khoảng 800 ms và chỉ hiện sau khoảng 1,4–2,0 giây | **FAIL** — cảm giác click không có tác dụng, dễ thao tác nhầm trên dữ liệu cũ |
| **P1** | Billing | Có skeleton/spinner; lỗi có thông báo và Retry | `overview` bắt đầu `null`, trong lúc `apiRequest` chờ chỉ hiện PageHeader và vùng trống; lỗi không có nút Retry | **FAIL** — blank state không phân biệt loading với không có dữ liệu |
| **P1** | Career dashboard | Loading, lỗi có ngữ nghĩa lỗi, thao tác lưu có busy/disable và bắt lỗi | `reload()` không có loading rõ; lỗi ban đầu dùng `is-success`; `addGoal()`/`saveScores()` không bắt rejection, không disable nút nên có thể submit trùng | **FAIL** — lỗi có thể thành unhandled rejection và người dùng không biết thao tác đã thất bại |
| **P1** | Skill drafts | Loading/error/retry và chống double-submit | Không có loading riêng; catch roster bị nuốt; tạo/review không có busy flag | **FAIL** — danh sách rỗng có thể bị hiểu là không có dữ liệu, thao tác lặp có nguy cơ tạo bản ghi trùng |
| **P1** | AI background worker | Worker phải đọc được hàng đợi `ai_jobs` và xử lý job bất đồng bộ | PostgreSQL log ghi `ERROR: column u.role does not exist` khi query tại `apps/api/src/repositories/postgres-platform.ts:3153-3154` (`SELECT ... u.role FROM ai_jobs ...`); schema `users` không có cột `role` | **FAIL** — worker không thể claim/tiến hành job AI trong production stack dù app và healthcheck vẫn xanh |
| **P2** | Thông báo lỗi toàn ứng dụng | Lỗi cần được screen reader thông báo ngay (`role=alert`) | Nhiều route dùng `role=status` cho `is-error` (AI, billing, assignments, gradebook, resources, profile và các route liên quan) | **PARTIAL** — nội dung nhìn thấy nhưng ưu tiên accessibility chưa đúng |
| **P2** | CBT tại 320 px | Không tràn ngang hoặc có layout mobile rõ ràng | `/app/exam` có `scrollWidth=346` so với viewport 320, tràn 26 px; card đăng nhập 330 px và tiêu đề bị cắt | **PARTIAL** — tài liệu yêu cầu desktop ≥1024, nhưng breakpoint nhỏ vẫn nên có thông báo/khung không vỡ |
| **P2** | Touch target và controls | Control chạm nên khoảng ≥44×44 px | Browser desktop audit ghi nhận `Nguồn` ~51×22, `Xem chi tiết` ~109×33, select ~108×25, summary ~250×22 và một số nút mode 36 px | **PARTIAL** — dùng chuột được nhưng không tối ưu cho touch/zoom |
| **P2** | Header mobile | Logo/tài khoản vẫn đọc được ở 375 px | Brand và tên người dùng bị cắt (`Smart Path Platfo…`, `Nguy…`) | **PARTIAL** — không mất chức năng nhưng giảm nhận diện và tin cậy |
| **P2** | Owner registrations | Production-like UI không lộ liên kết môi trường local | Trang hiển thị link Mailpit `http://127.0.0.1:8025` với dòng “Môi trường local…” | **PARTIAL** — hữu ích khi dev nhưng không nên xuất hiện trong môi trường mô phỏng production |
| **P2** | E2E documentation | README chỉ mô tả những assertion thực sự được chạy | README nói reduced-motion được kiểm, nhưng không có test reduced-motion trong `apps/web/e2e` | **FAIL (docs)** — cần sửa mô tả hoặc bổ sung test để tránh false confidence |

### Hallmark UI audit thủ công

Đối chiếu source và screenshot landing với các nguyên tắc Hallmark, không thay thế kiểm thử chức năng:

| Tell | Where | Severity | Fix đề xuất |
|---|---|---|---|
| Re-drawn browser/window chrome | `apps/web/src/routes/LandingPage.tsx` (`panel-chrome`, `window-dots`) | **Critical** | Thay bằng preview sản phẩm thật hoặc một composition nội dung, không vẽ lại chrome của hệ điều hành/trình duyệt |
| Ba card tính năng cùng trọng số | Landing hero/feature section | **Critical** | Chọn một narrative chính, dùng hierarchy/asymmetry; giảm cảm giác template “3-column feature grid” |
| Eyebrow lặp ở hầu hết section | Các section landing (`Nền tảng…`, `Ba việc…`, `Ranh giới…`) | **Major** | Chỉ giữ eyebrow nơi thực sự định hướng nội dung; để heading và khoảng trắng dẫn nhịp |
| Header wordmark + nhiều link + CTA kiểu “AI nav” | Header landing | **Major** | Ưu tiên một hành động chính và nav theo ngữ cảnh người dùng |
| Icon tile/card-in-card | Các feature card landing | **Major** | Dùng icon như phụ trợ, bỏ lớp card lồng và tăng khác biệt giữa các khối |
| Animation layout property | `styles.css` (transition `top`, `width`, `grid-template-columns`) | **Major** | Animate `transform`/`opacity`, tránh layout thrash và kiểm tra reduced-motion |
| Control nhỏ hơn vùng chạm khuyến nghị | Nguồn, select, summary, detail/mode buttons | **Minor** | Tăng hit area/padding mà không làm đổi visual density |
| Mobile header truncation | App topbar 375 px | **Minor** | Dùng mark ngắn, tooltip/tên đầy đủ trong menu tài khoản |
| Transition/ease không đồng nhất token | `app.css`, `styles.css` | **Minor** | Chuẩn hóa duration/easing thành design tokens và đo lại route transition |

**Tổng Hallmark: 2 Critical · 4 Major · 3 Minor.**

### Điểm cập nhật theo mục tiêu retest

| Trục | Điểm hiện tại |
|---|---:|
| Độ đầy đủ & đúng chức năng | 8,6/10 |
| Thẩm mỹ UI | 7,6/10 |
| UX, loading/error và khả năng học dùng | 6,8/10 |
| Accessibility & responsive | 7,5/10 |
| Backend, dữ liệu & tenant isolation | 8,4/10 |
| Hiệu năng & bundle | 8,3/10 |
| Vận hành & tài liệu | 6,2/10 |
| **Điểm chức năng/UI/UX dùng cho vòng retest** | **7,0/10** |

Các điểm trên đánh giá khả năng chạy và hành vi sản phẩm; không coi trạng thái Docker healthy là bằng chứng rằng UX đã hoàn thiện. Những lỗi P1 về transition/loading/error cần xử lý trước khi gọi là production-ready.

## Ma trận chức năng đã chạy

| Nhóm | Bề mặt đã kiểm tra |
|---|---|
| Công khai & auth | Landing, đăng nhập/đăng xuất, yêu cầu mở trường, đăng ký/kích hoạt, session, 404/redirect |
| Platform admin | Tổng quan, duyệt trường, trường học, người dùng, billing, audit log, catalog, hồ sơ/bảo mật |
| Hiệu trưởng | Lớp/giáo viên, duyệt đăng ký, billing, bài giảng, thư viện, câu hỏi, assignment, gradebook, chấm tự luận, báo cáo, skill graph/adaptive, AI settings/chat/knowledge, catalog, proctor, hồ sơ |
| Giáo viên | Lớp, bài giảng, thư viện, câu hỏi, assignment, thi, gradebook, chấm tự luận, báo cáo, tin nhắn, soạn bài AI, hồ sơ |
| Học sinh | Bài giảng, thư viện, assignment, CBT, điểm, lộ trình, tin nhắn, AI học tập, quiz/kết quả/trường/nguyện vọng/phân tích hướng nghiệp, hồ sơ |
| Backend/data | RLS hai tenant, auth, idempotency, upload/scan/download, import, lifecycle bài học/assignment, CBT, dashboard, export, adaptive, RAG/AI, billing |
| Cross-cutting | Responsive, keyboard, source-level reduced-motion support (chưa có assertion E2E riêng), axe, console/network, bundle, dependency audit |

## Phát hiện cần xử lý

### P0 — Critical: AI JavaScript sandbox có thể thoát ra Node process

- Vị trí: `apps/api/src/domain/ai/sandbox.ts:21`, `apps/api/src/repositories/postgres-platform.ts:2942`, `apps/api/src/app.ts:202`, `apps/api/src/app.ts:1167`.
- Endpoint chat/job cho phép `SCHOOL_OWNER`, `TEACHER` và `STUDENT` gửi `agentic` + `runCode` hoặc code fence.
- Probe vô hại: `return typeof process + ':' + typeof process.getBuiltinModule`.
- Kết quả thực tế: `object:function`.
- `worker_threads`, timeout và `resourceLimits` chỉ giới hạn tài nguyên; chúng không cô lập quyền hệ điều hành, filesystem, env hoặc network.

Khuyến nghị:

1. Tắt `runCode`/agentic execution ở production ngay.
2. Chuyển chạy mã sang tiến trình/container/microVM riêng, user không đặc quyền, filesystem read-only hoặc trống, không mount secret/socket, chặn network mặc định, seccomp/AppArmor, CPU/RAM/time/output quota.
3. Không dùng `new Function`, `eval`, `vm` hoặc `worker_threads` làm security boundary.
4. Thêm test phủ định: không tồn tại `process`, `require`, `fetch`, `WebSocket`, loader module, filesystem, child process và network egress.

### P1 — High: drawer mobile đóng nhưng nav off-screen vẫn nằm trong cây accessibility/focus

- Vị trí: `apps/web/src/routes/AppLayout.tsx:242`, `apps/web/src/styles.css:1871`.
- Browser production cho thấy khi `aria-expanded="false"`, `<aside>` vẫn render, không `aria-hidden`, không `inert`, các link vẫn có `tabIndex` mặc định.
- CSS chỉ `transform: translateX(-105%)`; phần tử off-screen vẫn có thể nhận focus bàn phím/screen reader.
- E2E hiện chỉ kiểm Escape trả focus về nút mở, chưa kiểm Tab tiếp theo không đi vào menu đóng.

Khuyến nghị: khi đóng, dùng `inert`, `aria-hidden="true"` và loại khỏi tab order, hoặc conditional render; thêm E2E tab-sequence/AX-tree.

### P1 — High: production response không có Content-Security-Policy

- Vị trí: `apps/api/src/app.ts:293` đặt `helmet({ contentSecurityPolicy: false })`.
- Network response production có HSTS, X-Frame-Options, nosniff, COOP/CORP và Referrer-Policy nhưng không có `Content-Security-Policy`.
- Rủi ro tăng do hệ thống có nội dung bài giảng HTML và AI-rich text, dù sanitizer hiện có test tốt.

Khuyến nghị: bật CSP theo nonce/hash, giới hạn `default-src 'self'`, `script-src`, `connect-src`, `img-src`, `font-src`, `frame-ancestors`; test header ở production build.

### P1 — High: vận hành production chưa có quan sát và kiểm chứng phục hồi

- `Fastify({ logger: false })`; chưa có structured request/error logging, error monitoring hoặc alerting.
- `/healthz` trả trạng thái tĩnh, chưa chứng minh database/storage/worker readiness.
- Chưa có bằng chứng backup restore, rollback, staging, HTTPS/domain/firewall/uptime monitoring vì production công khai chưa triển khai.

Khuyến nghị: tách liveness/readiness, bật log JSON có request ID và redaction, thêm error monitoring + uptime/SLO, diễn tập backup restore và rollback trước deploy.

### P2 — Medium: module quá lớn, rủi ro review và thay đổi

- `apps/api/src/app.ts`: 2.110 dòng, 176 route.
- `apps/api/src/repositories/postgres-platform.ts`: 4.460 dòng.
- `apps/web/src/styles.css`: 2.759 dòng.

Khuyến nghị: tách theo domain vertical slice (auth/admin/LMS/exam/career/AI/billing), giữ route orchestration mỏng, repository theo bounded context và CSS theo layer/component. Không trộn việc tách module với sửa hành vi.

### P2 — Medium: UX mobile/header và mật độ nav

- Dashboard mobile 375 px không tràn ngang, touch target đạt chuẩn và bố cục card rõ.
- Tên sản phẩm và tên người dùng ở topbar bị cắt mạnh (`Smart Path Platfo…`, `Nguy…`).
- Hiệu trưởng có 20 mục nav, học sinh 15 mục; tìm chức năng được nhưng tải nhận thức cao cho người mới.

Khuyến nghị: ưu tiên logo mark + tên ngắn trên mobile; cho tài khoản vào menu; nhóm nav theo công việc/ngữ cảnh, thêm tìm nhanh hoặc recent tasks.

### P2 — Medium: supply-chain policy chưa khóa install script

- Docker `npm ci` cảnh báo hai postinstall chưa được policy phê duyệt: `esbuild@0.28.1` và `esbuild@0.25.12`.
- Hai package có mục đích hợp lệ, audit/signature đều pass, nhưng policy fail-closed chưa được commit.

Khuyến nghị: review source/checksum rồi khai báo allowlist tối thiểu, pin npm version đồng nhất host/container/CI.

### P3 — Advisory: metadata public còn thiếu

- Có title, description và viewport.
- Chưa có favicon, Open Graph metadata hoặc `robots.txt`.
- Không chặn app nội bộ, nhưng làm landing public kém hoàn chỉnh khi chia sẻ hoặc index.

## Đánh giá theo nhóm người dùng

| Nhóm | Điểm | Nhận xét |
|---|---:|---|
| Học sinh | 8,2/10 | Copy tiếng Việt rõ, việc hôm nay nổi bật, CBT/hướng nghiệp/AI có luồng riêng; nav dài và nhiều chế độ AI tạo tải học ban đầu |
| Giáo viên | 8,0/10 | Bao phủ trọn chu trình nội dung → giao bài → chấm → báo cáo; cần ưu tiên công việc gần đây để giảm tìm kiếm trong 13 mục |
| Hiệu trưởng | 7,4/10 | Chức năng quản trị rất đầy đủ nhưng 20 mục nav và nhiều khái niệm kỹ thuật/AI làm onboarding nặng |
| Platform admin | 8,1/10 | IA gọn nhất, dashboard và audit/billing/catalog tách rõ; vẫn cần observability và runbook production |

## Chấm điểm đa chiều

| Trục | Điểm |
|---|---:|
| Độ đầy đủ & đúng chức năng | 8,6/10 |
| Thẩm mỹ UI | 7,6/10 |
| UX/khả năng học dùng | 6,8/10 |
| Accessibility & responsive | 7,5/10 |
| Backend, dữ liệu & tenant isolation | 8,4/10 |
| Security | 4,0/10 |
| Hiệu năng & bundle | 8,3/10 |
| Vận hành & tài liệu | 6,2/10 |
| **Tổng có trọng số cập nhật** | **7,0/10** |

## Test case bắt buộc bổ sung

1. `runSandboxedJs_processGlobal_rejected` — code không được thấy `process`.
2. `runSandboxedJs_builtinModuleLoader_rejected` — không được nạp `fs`, `child_process`, `net`, `http`.
3. `runSandboxedJs_networkApis_rejected` — không có network egress.
4. `mobileDrawer_closed_removesLinksFromTabOrderAndAxTree` — menu đóng không focus/announce.
5. `productionHeaders_documentResponse_containsCsp` — CSP tồn tại và không quá rộng.
6. `readiness_databaseUnavailable_returnsNon200` — readiness phản ánh dependency thật.

## Dọn dẹp đã thực hiện

- Xóa ba tài liệu tạm không còn tham chiếu và đã được spec/HANDOFF/E2E thay thế:
  - `docs/phase5-regression-nav.md`
  - `docs/antigravity-workspace-ui-phase1.md`
  - `docs/antigravity-exam-ui-phase3.md`
- Thêm `.env.test` và `.env.*.local` vào `.gitignore`; không đọc hoặc xóa file env.
- Giữ lại spec, kế hoạch Superpowers và visual spec vì còn giá trị lịch sử/quyết định.

## Điều kiện để đổi verdict

1. P0 sandbox được tắt hoặc cô lập đúng nghĩa, có regression test phủ định.
2. Drawer đóng không còn trong tab/AX tree.
3. CSP production được bật và kiểm bằng browser/network test.
4. Có readiness thật, structured logging, monitoring, backup-restore và rollback evidence.
5. Chạy lại `npm run test:release:isolated`, dependency audit/signatures, Browser production smoke và `git diff --check`.
