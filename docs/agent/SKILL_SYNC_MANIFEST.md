# Manifest đồng bộ skill IntelliSchool

Ngày đồng bộ: 2026-09-01. Nguồn canonical là union theo tên của
`C:\Users\Admin\.agents\skills` (ưu tiên khi trùng) và
`C:\Users\Admin\.codex\skills` (bỏ `.system`): 236 skill.

## Coverage đã kiểm

| Target | Canonical coverage | Tổng thư mục |
| --- | --- | --- |
| `C:\Users\Admin\.claude\skills` | 236/236 | 236 |
| `C:\Users\Admin\.gemini\antigravity\skills` | 236/236 | 241 |

Antigravity giữ 5 skill riêng: `all-skill-router`, `causal-reasoning`,
`mode-normal`, `project-bootstrap`, `skill-boot`.

## Junction thêm cho Claude

`addy-test-driven-development`, `api-and-interface-design`, `banner-design`,
`brand`, `browser-testing-with-devtools`, `cavecrew`, `caveman`,
`caveman-commit`, `caveman-compress`, `caveman-help`, `caveman-review`,
`caveman-stats`, `ci-cd-and-automation`, `code-review-and-quality`,
`code-simplification`, `context-engineering`, `debugging-and-error-recovery`,
`deprecation-and-migration`, `design`, `design-system`,
`documentation-and-adrs`, `doubt-driven-development`,
`frontend-ui-engineering`, `git-workflow-and-versioning`, `hatch-pet`,
`idea-refine`, `incremental-implementation`, `interview-me`,
`observability-and-instrumentation`, `performance-optimization`,
`planning-and-task-breakdown`, `security-and-hardening`,
`sensationos-ai-builder`, `sensationos-backend-db-builder`,
`sensationos-orchestrator`, `sensationos-product-planner`,
`sensationos-reviewer`, `sensationos-security-tester`,
`sensationos-ui-ux-builder`, `shipping-and-launch`, `slides`,
`source-driven-development`, `spec-driven-development`, `ui-styling`,
`ui-ux-pro-max`, `using-agent-skills`.

## Junction thêm cho Antigravity

`hatch-pet`, `sensationos-ai-builder`, `sensationos-backend-db-builder`,
`sensationos-orchestrator`, `sensationos-product-planner`,
`sensationos-reviewer`, `sensationos-security-tester`,
`sensationos-ui-ux-builder`.

## Gỡ an toàn

Chỉ xóa đúng junction trong target nêu trên sau khi xác nhận `LinkType=Junction`
và `Target` trỏ về source đúng; không xóa source dưới `.agents` hoặc `.codex`.
Khởi động lại Claude/Antigravity để chúng quét lại skill sau thay đổi.
