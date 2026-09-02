# AI runtime contract

## Phạm vi bắt buộc

AI học tập, soạn bài/đề, RAG, hướng nghiệp, chấm tự luận và Thinking job chỉ được
gọi là AI production khi request thực sự đến provider OpenAI-compatible đã cấu
hình và response có bằng chứng thực thi.

## Cấu hình và an toàn

- Key/model/base URL chỉ từ server environment/secret manager; không lưu key trong
  DB, UI, audit, prompt hoặc log.
- Tenant không được tự nhập endpoint tùy ý. Endpoint override, nếu còn, phải HTTPS
  allowlist, DNS không được trả private/reserved IP, không redirect và được owner phê duyệt.
- OpenAI-compatible là provider production chính. `AI_OPENAI_API_KEY`, base URL,
  model và allowlist chỉ đọc từ server environment/secret; endpoint trong DB chỉ được
  dùng khi trùng allowlist. Request gửi provider có `x-client-request-id` để đối soát.
- Model output là untrusted data: validate Zod/schema trước khi tạo câu hỏi, chấm,
  tool call hoặc render HTML.
- RAG luôn filter school_id và quyền lớp/môn/tài liệu trước retrieval; chunk có
  citation/source metadata; prompt injection trong tài liệu không thay quyền code.
- Cost, token, timeout, retry và max tool loop là server policy; agentic tool
  allowlist tối thiểu, không có side effect không xác nhận.

## Trạng thái UI/API

Provider status không lộ secret: configured, reachable, capabilities (chat,
embeddings, structured output), provider, model, checkedAt và requestId. `reachable`
chỉ là true sau probe thật tới provider; thiếu key/endpoint là `configured=false`.

Reply chuẩn hóa: provider, usedModel, executionMode (MODEL hoặc UNAVAILABLE),
usage, citations, jobId khi async và requestId. Không có canned, `composeFallback` hoặc
extractive fallback trên production path. Khi provider unavailable, API trả
`503 AI_UNAVAILABLE` (policy refusal là trường hợp không tạo nội dung model) và UI
phải nói rõ chưa cấu hình/không reachable, không tạo kết quả giả.

Mọi request AI có log JSON backend gồm event, route, status, duration và requestId.
Các capability đã hoàn tất và Thinking job ghi audit event để Platform Admin xem trong
`/app/audit-log`; metadata chỉ gồm provider/model/usage/trạng thái/requestId, không gồm
prompt, nội dung trả lời đầy đủ, API key hoặc secret.

AI học tập dành cho học sinh dùng request mặc định `STANDARD`, `agentic: true` và
`sourceMode: AUTO`; UI không dùng selector mode/source. System prompt phải yêu cầu
final answer cho học sinh, không xuất deliberation, kế hoạch trả lời hoặc tự bàn luận
về policy. Chống gian lận chỉ từ chối khi yêu cầu đáp án gắn rõ với assessment đang mở;
hỏi bài hoặc xin hướng dẫn thông thường được phép đi tới model.

Structured output của teacher compose, career analysis, aptitude essay và interview
được parse rồi validate bằng Zod; JSON/schema lỗi là `502 AI_OUTPUT_INVALID` và không
được lưu như kết quả hợp lệ. RAG citation phải tham chiếu số citation thực tế; thiếu
citation hợp lệ là lỗi, không tự bổ sung citation.

## Thinking job

- Job có deadline, attempt count, claim atomically, stale reclaim và terminal error
  được che nội bộ.
- Job có `request_id`; cancel dùng endpoint server-authoritative, abort provider call
  trong cùng process và ngăn worker ghi đè job đã `CANCELLED`.
- Worker dùng role từ membership/schema thật, không truy cập cột không tồn tại.
- UI poll/progress có cancellation/recovery sau reload; job success phải trả result
  cùng usedModel, usage và request ID.

## Eval gate

Duy trì 12–20 prompt/e2e cases: grounded citation, no-context, answer fishing,
prompt injection, structured compose, timeout/failure (không failover giả), RAG isolation,
job restart/cancel, cost cap, provider missing và mỗi capability có provider thật.
Mock chỉ cho unit failure isolation, không được chứng minh release. Bộ 18 case hiện tại
và evidence nằm trong `docs/prompt-evals/ai-runtime-production-2026-09-02.json`.
