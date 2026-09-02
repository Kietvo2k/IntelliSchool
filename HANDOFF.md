# HANDOFF — IntelliSchool

## Trạng thái hiện tại

- Nhánh: `revamp/intellischool-2026-09`.
- GitHub: `https://github.com/Kietvo2k/IntelliSchool`.
- Phase hoàn tất: **Phase 1 — Tái định vị giao diện IntelliSchool (UI & Design System)**.
- Release verdict: **DO NOT SHIP** (Chờ hoàn thành Phase 2, 3, 4).
- Product name công khai: **IntelliSchool**; identifier `@smart-path/*` giữ tương thích kỹ thuật.

## Bằng chứng mới nhất

| Lệnh | Kết quả | Khi chạy |
| --- | --- | --- |
| `npm run verify` | PASS: 202 API/unit, 59 web test, bundle budget check, lint exit 0, typecheck exit 0 | Phase 1 UI revamp |
| `npm run test -w @smart-path/web` | PASS: 39 test files, 59 tests | Phase 1 UI revamp |
| `npm run typecheck` | PASS: contracts, api, web exit 0 | Phase 1 UI revamp |
| `npm run lint` | PASS: exit 0, max-warnings 0 | Phase 1 UI revamp |

## Finding đã đóng trong Phase 1

- **Rebranding công khai**: Toàn bộ UI, metadata, tiêu đề, logo SVG, link, thông báo và trang tĩnh đã được chuyển sang **IntelliSchool**.
- **Design system & Tokens**: Áp dụng chuẩn Typography `Be Vietnam Pro` (tiêu đề/UI) và `Noto Sans` (nội dung), bảng màu Teal đậm (`#0F766E`, `#115E59`), Amber (`#B45309`), Canvas `#F8FAFC`, Surface `#FFFFFF`, border `#CBD5E1`. Focus ring tương phản cao và không animate.
- **Anti-slop**: Bỏ toàn bộ fake browser window dots / fake chrome trên Landing page và các thẻ trường học.
- **Async form handling & Accessibility (F-001 / F-012 / F-014)**: Lưu form reference trước await, hiển thị feedback success (`role="status"`) và error (`role="alert"`), vô hiệu hóa button khi pending trong CareerDashboardPage, AspirationsPage, ClassesPage, v.v.
- **Responsive 320px–1440px**: Đảm bảo không horizontal scroll ở các breakpoint 320, 375, 414, 768, 1024, 1440px; touch target ≥ 44px; hỗ trợ `prefers-reduced-motion`.

## Finding mở chuyển sang Phase tiếp theo

- **F-009 / F-015**: AI production provider thật, tool trace, citation và eval gate (Phase 3).
- **Browser UI regression**: full E2E còn 9 lỗi strict locator/responsive body do working tree UI Phase 1 chưa được làm sạch và commit.
- **Password-manager popup**: isolated Chromium không có password-manager extension nên chưa có evidence tái tạo trên Chrome profile thật.
- **Dependency**: `npm audit --audit-level=high` còn 3 advisory moderate transitive qua MinIO; không dùng `audit fix --force` vì sẽ đổi breaking dependency.

## Thứ tự thực thi

1. ~~`prompts/01-ui-intellischool.md`~~ (Hoàn tất)
2. Copy `prompts/02-backend-security-cbt.md` (Kế tiếp)
3. Copy `prompts/03-ai-production.md`
4. Copy `prompts/04-release-verification.md`

## Cập nhật Phase 2 backend/security — 2026-09-02

- Nhánh: `revamp/intellischool-2026-09`; không force-push. Phase 1 checkpoint/evidence vẫn giữ nguyên.
- Commit mới: `76561f3` (spec/plan), `6075ff4` (crypto snapshot), `0a86d36` (migration/keyring/backfill), `cba7ff8` (backend/security), `8fc6cc0` (regression tests), `f22d57d` (SSRF DNS pinning), `8df394d` (auth audit/F-002 regression).
- Snapshot đề thi: AES-256-GCM, AAD + metadata hash, keyring ngoài repo, backfill idempotent, rotation revision và session pinning.
- CBT: incident state machine server-authoritative, dedupe, grace 5 giây, warning đến 30 giây, lock không auto-submit, restore/close/unlock có audit và authorization.
- Backend: profile SQL/audit parameter, activation email sau commit, report/resource idempotency, binary download path, SSRF DNS/IP validation, resource audit, session revoke audit/idempotency.
- Test evidence: `npm run verify` fresh PASS; API unit `212/212`; web `59/59`; integration isolated `44/44`; exam integration `7/7`; RLS `2/2`; auth `7/7`; resource `2/2`; export `2/2`; typecheck/lint/build pass.
- Security evidence: `npm audit --audit-level=high` exit 0, còn 3 advisory moderate transitive qua MinIO; secret scan high-confidence exit 0; `git diff --check` exit 0 ngoài cảnh báo line-ending của file dirty UI.
- Browser: image/app-test healthy; full E2E `19/28` pass. `9` failure hiện tại chủ yếu do selector strict-mode trùng nav/quick-link trong working tree UI Phase 1 và responsive body hidden; CBT direct Chromium manual pass: session 5 items, không leak key/rubric/ciphertext, signal `GRACE`, restore `ACTIVE`.
- Manual Chromium proctor: owner unlock trả `200/ACTIVE/unlocked=true`; student đọc lại session trả `200`, `lockedAt=null`, `submittedAt=null`, integrity `ACTIVE`.
- Release verdict: **DO NOT SHIP**. Chưa có bằng chứng browser đầy đủ cho password-manager popup/proctor UI; provider AI thật và các finding UI còn lại vẫn mở.

## Cập nhật AI production runtime — 2026-09-02

- Nhánh: `revamp/intellischool-2026-09`; Phase 2 checkpoint/evidence được giữ nguyên;
  không force-push. Các thay đổi UI khác có sẵn trong working tree không thuộc commit này.
- OpenAI-compatible là đường chạy chính. Key/base URL/model chỉ server-side; endpoint
  DB phải trùng HTTPS allowlist, DNS private/reserved bị chặn và redirect bị từ chối.
  Không còn model fallback, canned, `composeFallback` hoặc extractive fallback trên
  production path; thiếu/lỗi provider trả `503 AI_UNAVAILABLE` rõ ràng.
- Reply AI chuẩn hóa có `provider`, `usedModel`, `executionMode`, `usage`, `citations`,
  `requestId`; Thinking có thêm `jobId`. Provider status trả configured/reachable/
  capabilities/model/checkedAt mà không lộ secret.
- Teacher compose, career analysis, aptitude essay và interview dùng Zod validation;
  malformed output retry bounded cùng provider rồi fail `AI_OUTPUT_INVALID`.
  RAG lọc tenant/membership class trước retrieval và đánh dấu context untrusted.
- `ai_jobs` có `request_id`, atomic claim, max-attempt retry, stale reclaim, cancel
  server-authoritative và không ghi đè job đã hủy; migration mới là `026_ai_request_evidence.sql`.
- Eval/evidence: 18 case `AI01–AI18`, prompt analyzer 650/95/90 PASS; live provider
  smoke 2/2; live grounded chat, teacher compose, career+aptitude và Thinking đều đã
  pass khi chạy từng capability tuần tự; browser AI journey app-test 2/2.
  Chi tiết: `docs/prompt-evals/ai-runtime-evidence-2026-09-02.md` và các JSON evidence.
- Verification mới: `npm run verify` PASS (API 226, web 59, lint/typecheck/build);
  integration isolated PASS 47/47; `npm audit --audit-level=high` exit 0 còn 3
  moderate transitive MinIO, không chạy force fix; high-confidence secret scan không có match.
- Finding mở: RAG helper benchmark hiện precision@5 0.150/recall@5 0.500 dưới floor
  tham chiếu; static threat scan vẫn báo critical trên prompt adversarial có chủ ý;
  full live batch có transient rate-limit nên release script tách từng capability process.
- Commit hash: xem hash commit hiện tại trong `git log -1 --format=%H`; giá trị được
  ghi nhận trong bàn giao sau commit để tránh tự tham chiếu hash của chính commit.

## Cập nhật vận hành local AI và log admin — 2026-09-02

- Không reset database. Persistent PostgreSQL volume đã được bổ sung migration
  `021_async_job_reliability.sql`; các cột retry/lease/provider/usage và index claim
  đã được kiểm tra lại trực tiếp.
- `.env` local dùng provider OpenAI-compatible VietAPI, model `deepseek-v4-flash`,
  HTTPS allowlist và timeout 60 giây; API key test chỉ nằm ở server environment.
  Keyring snapshot local dùng file `/data/exam-keyring.json` với version đang tồn tại.
- Backend phát JSON log cho request AI với event, route, status, duration và requestId;
  không ghi prompt, output đầy đủ hay secret. Admin có thể xem bằng chứng AI trong
  `/app/audit-log`, gồm chat, career, aptitude và Thinking job với provider/model/token.
- Bằng chứng thực tế: UI chat grounded thành công có citation; Thinking hoàn tất 100%;
  live backend pass 4/4 capability; `npm run verify` pass với API 227 test và web 60 test.
- Container hiện chạy tại `http://127.0.0.1:5176/`; không dùng `--remove-orphans` và
  không xóa container volume `smartclass-platform_app-data` để bảo toàn dữ liệu local.
