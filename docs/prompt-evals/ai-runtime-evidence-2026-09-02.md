# Bằng chứng AI production — 2026-09-02

## Baseline và eval

- Eval set: `ai-runtime-production-2026-09-02.json`, 18 case `AI01–AI18`.
- Prompt analyzer baseline/R1: 650 token, clarity 95, structure 90; compare gate PASS,
  không tăng token và không giảm clarity.
- AI threat scanner: 8 prompt adversarial, static overall `critical` đúng kỳ vọng vì
  các mẫu injection/tool abuse cố ý được phát hiện; coverage có LLM Prompt Injection,
  Indirect Prompt Injection, Agent Tool Abuse và LLM Data Extraction.
- RAG corpus: 25 tài liệu thật; chunking recommendation `paragraph_based`, score 0.561.
  Retrieval evaluator baseline: precision@1 0.500, precision@5 0.150, recall@5
  0.500. Đây là finding chất lượng còn mở, không dùng để tuyên bố RAG đã đạt floor.

## Live provider evidence

Các lệnh live đều dùng `.env` server-side; output chỉ giữ metadata, không ghi key/body
vào repo hoặc log:

- `node --env-file=.env node_modules/vitest/vitest.mjs run apps/api/test/ai-provider.live.test.ts` — PASS 2/2.
- Live grounded chat — PASS; `OPENAI_COMPATIBLE`, `usedModel`, usage, citations và
  requestId đều được assert.
- Live teacher compose — PASS; provider trả structured JSON, runtime normalize sau
  Zod validation, có usedModel/usage/requestId.
- Live career analysis + aptitude essay — PASS; có usedModel/usage/requestId.
- Live Thinking job — PASS; ai_jobs claim thật, progress terminal, usedModel/usage,
  jobId và requestId được assert.
- Release script chạy từng live capability tuần tự ở process riêng để tránh batch
  rate-limit; không có model fallback.

## Failure isolation evidence

- Provider missing/5xx/abort: lỗi `AI_UNAVAILABLE`/`AI_PROVIDER_UNAVAILABLE`, retry hữu
  hạn cùng provider; không canned, `composeFallback` hoặc extractive fallback.
- Structured output malformed: retry bounded cùng provider rồi `AI_OUTPUT_INVALID`,
  không lưu kết quả sai schema.
- Endpoint: chỉ HTTPS allowlist, private/reserved IP bị chặn sau DNS lookup, fetch đặt
  `redirect: 'error'`.
- RAG: school/class/subject và quyền membership được lọc trước retrieval; context có
  nhãn untrusted, citation grounded phải tham chiếu số thực.
- ai_jobs: claim atomically, lease/reclaim, max attempts, request_id, cancel server-
  authoritative và không ghi đè job đã CANCELLED.
- Browser AI journey trên app-test không có secret: PASS 2/2; UI hiển thị unavailable
  rõ ràng và không render fallback.
