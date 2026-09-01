# Acceptance matrix IntelliSchool

## Release gate

| Domain | Điều kiện PASS | Bằng chứng tối thiểu |
| --- | --- | --- |
| UI | Hallmark 0 critical; axe serious/critical 0; 320–1440 không overflow | screenshot + Playwright/axe |
| Forms | Không commit-success/UI-error; loading/success/error rõ | browser journey + DB/API assertion |
| Backend | RLS hai tenant âm tính; SQL/email/download/SSRF findings đóng | unit + integration + review |
| CBT | grace 5s, warning 5–30s, lock 30s, không auto-submit, proctor unlock | fake clock + browser/manual Chrome |
| Encryption | snapshot AES-GCM, key rotation, không plaintext/answer key student API | migration/integration/security scan |
| AI | provider thật cho mọi capability, usedModel/usage/requestId có mặt | live integration/eval evidence |
| Performance | p50/p95/p99 và CWV theo product contract | production-like trace |
| Supply chain | Không high/critical reachable; moderate có owner/review date | npm audit + decision record |

## Finding cũ phải retest

F-001 đến F-015 trong `full-interaction-retest-2026-08-31.md` không tự đóng khi
unit test xanh. Mỗi finding cần reproduction cũ, test chống regression, bằng chứng
mới, commit hash và trạng thái Closed/Deferred có lý do.

## Quy tắc READY

Chỉ Phase 4 được gắn READY sau khi tất cả P0/P1 đóng, `npm run test:release:isolated`
pass, provider thật pass, security gate pass và HANDOFF có bằng chứng mới.
