# Test runbook IntelliSchool

## Thứ tự

1. `npm run verify` — lint, typecheck, unit/API, web, build và bundle.
2. `npm run test:integration:isolated` — PostgreSQL/RLS/migration/worker.
3. `npm run test:e2e:isolated` — Chromium, route matrix, axe và responsive.
4. Provider thật: inject endpoint/key test qua secret environment; chạy capability
   matrix, lưu request ID/model/usage đã redaction.
5. `npm run test:release:isolated`, `npm audit --audit-level=high`, secret scan
   và `git diff --check`.

## Browser matrix

- Roles: platform admin, school owner, teacher, student.
- Widths: 320, 375, 414, 768, 1024, 1440; reduced motion on/off.
- Journeys: login/onboarding, class/enrollment, lesson/resource, question/
  assignment/grade, CBT/proctor, AI/RAG, career, profile, export/download.
- CBT manual Chrome checklist thêm password-manager popup; automation không được
  giả định fullscreen của in-app browser tương đương Chrome thật.

## Báo cáo

Mỗi run ghi ngày, commit, môi trường, command, exit code, số test, screenshot/
trace, provider evidence đã redaction, finding mở và rollback note. Không copy
con số từ report cũ.
