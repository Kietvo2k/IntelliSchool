/max

Bạn là release/QA/security lead IntelliSchool. Chạy tuần tự, không subagent.
Chỉ sửa finding cần thiết cho release.

## Đọc bắt buộc

1. `AGENTS.md`, `HANDOFF.md`, `docs/INDEX.md`.
2. `docs/quality/ACCEPTANCE_MATRIX.md`, `docs/quality/TEST_RUNBOOK.md`.
3. Historical audits 29/08 và 31/08, toàn bộ evidence của Phase 1–3.

## Gate trước khi chạy

- Xác nhận mỗi phase trước có commit, diff review, test evidence và finding rõ.
- Nạp: `senior-qa`, `browser-testing-with-devtools`, `web-perf`,
  `security-and-hardening`, `ship-gate`, `verification-before-completion`.
- Dừng và báo BLOCKED nếu không có Docker, Chrome/Playwright, provider test secret
  hoặc môi trường cần thiết; không thay bằng mock và không tự gắn READY.

## Thực thi

1. Chạy verify, integration isolated, E2E isolated, production-like release check,
   audit dependency, secret scan và diff check.
2. Đi toàn bộ journey platform admin, owner, teacher, student tại 320/375/414/768/
   1024/1440, keyboard, reduced-motion, axe, console và visual regression.
3. Retest F-001–F-015 bằng reproduction gốc; mỗi finding Closed/Deferred phải có
   test, screenshot/trace, API/DB evidence và commit hash.
4. Chạy CBT timing matrix 4,9/5/29,9/30 giây, restore/dedupe/network/file picker/
   password-manager popup/proctor unlock.
5. Chạy AI live capability/eval matrix; redaction key, giữ usedModel/usage/request
   ID/provider status làm evidence.

## Quyết định release

READY chỉ khi mọi P0/P1 đóng, release command pass, live AI pass và security gate
không có finding chặn. Nếu không, ghi **DO NOT SHIP** cùng blocker, owner, cách
reproduce và lệnh tiếp theo.

## Bàn giao

Chỉ cập nhật `HANDOFF.md` và report mới bằng output vừa chạy. Commit report/docs
riêng: `test: ghi bằng chứng release IntelliSchool`; push nhánh revamp. Không merge
hoặc deploy nếu người dùng chưa xác nhận.

## Output Format (bắt buộc)

Kết thúc bằng Markdown với đúng các mục: `Release verdict`, `Commands và exit code`,
`Role/viewport matrix`, `AI live evidence`, `Security findings`, `F-001…F-015`,
`Rollback note`, `Commit hash`.
