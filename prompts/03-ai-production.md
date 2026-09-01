/max

Bạn là senior AI/backend engineer của IntelliSchool. Chạy tuần tự trong agent
chính; không tạo subagent hay workflow song song.

## Đọc bắt buộc

1. `AGENTS.md`, `HANDOFF.md`, `docs/INDEX.md`.
2. `docs/ai/RUNTIME_CONTRACT.md`, ADR-003, `docs/quality/ACCEPTANCE_MATRIX.md`.
3. Mọi file AI provider, RAG, job, UI assistant và test hiện có; lập inventory
   capability → route → provider → test → trạng thái thật/mock.

## Skill và branch gate

- Xác nhận Phase 2 đã có commit/evidence; ở nhánh revamp, không force-push.
- Nạp: `senior-prompt-engineer`, `ai-security`, `rag-architect`,
  `security-and-hardening`, `senior-backend`, `source-driven-development`,
  `test-driven-development`, `verification-before-completion`.
- Tạo eval set 12–20 case trước khi sửa prompt/runtime; không tối ưu theo cảm giác.

## Phạm vi

1. OpenAI-compatible là provider production chính. Key, endpoint, model chỉ ở
   server secret/config; endpoint override phải HTTPS allowlist, chống private IP/
   redirect SSRF. Không lộ key trong DB/UI/log/prompt.
2. Loại canned/composeFallback/extractive fallback khỏi production path được gắn
   nhãn AI. Khi provider thiếu hoặc lỗi, trả UNAVAILABLE rõ ràng, không bịa câu trả lời.
3. Thêm provider status/health: configured, reachable, capabilities, model,
   checkedAt; không secret. Chuẩn hóa reply: provider, usedModel, executionMode,
   usage, citations, jobId và requestId.
4. Sửa ai_jobs claim/retry/reclaim/restart và schema membership role; Thinking
   progress/cancel/recovery phải phản ánh job thật.
5. Validate structured output bằng Zod/schema; model output là untrusted. RAG
   filter tenant/quyền trước retrieval, citation bắt buộc, chống prompt injection,
   token/cost/tool loop cap.

## Gate AI thật

- Provider test phải gọi endpoint thật bằng secret environment; không commit secret.
- Chat/RAG, teacher compose, career analysis, aptitude essay và Thinking job đều
  có `usedModel`, usage, request ID và evidence đã redaction.
- Test provider missing/timeout/failure phải fail rõ, không fallback giả.
- Unit mock chỉ cho fault isolation; release evidence dùng live integration/eval.
- Chạy prompt analyzer baseline/compare, API/unit/integration liên quan và verify.

## Bàn giao

Cập nhật runtime contract/eval evidence/HANDOFF, review secret/diff và commit:
 `feat(ai): vận hành AI production có bằng chứng`. Push nhánh revamp.

## Output Format (bắt buộc)

Kết thúc bằng Markdown với đúng các mục: `Status`, `Capability matrix`, `Provider evidence`,
`Eval results`, `Files thay đổi`, `Tests và exit code`, `Finding mở`, `Commit hash`,
`Prompt kế tiếp`.
