# Prompt chạy IntelliSchool

Chạy **một prompt mỗi lần**, đúng thứ tự. Mỗi prompt tự đọc `AGENTS.md`,
`HANDOFF.md` và nguồn tài liệu nên có thể copy nguyên file vào Codex, Claude hoặc
Antigravity sau khi chúng khởi động lại để nhận skill mới.

1. `01-ui-intellischool.md` — UI/UX và rebrand.
2. `02-backend-security-cbt.md` — backend, security, CBT.
3. `03-ai-production.md` — AI provider thật/RAG/jobs.
4. `04-release-verification.md` — test, retest findings và release gate.

Không chạy Phase 2–4 khi phase trước chưa có commit, test evidence và update
`HANDOFF.md`. Mọi prompt dùng `/max`, chạy tuần tự trong agent chính; skill có thể
được cài nhưng không được dùng để mở subagent/parallel workflow.
