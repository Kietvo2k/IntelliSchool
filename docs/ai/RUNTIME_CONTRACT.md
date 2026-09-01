# AI runtime contract

## Phạm vi bắt buộc

AI học tập, soạn bài/đề, RAG, hướng nghiệp, chấm tự luận và Thinking job chỉ được
gọi là AI production khi request thực sự đến provider OpenAI-compatible đã cấu
hình và response có bằng chứng thực thi.

## Cấu hình và an toàn

- Key/model/base URL chỉ từ server environment/secret manager; không lưu key trong
  DB, UI, audit, prompt hoặc log.
- Tenant không được tự nhập endpoint tùy ý. Endpoint override, nếu còn, phải HTTPS
  allowlist, không redirect/private IP và được owner phê duyệt.
- Model output là untrusted data: validate Zod/schema trước khi tạo câu hỏi, chấm,
  tool call hoặc render HTML.
- RAG luôn filter school_id và quyền lớp/môn/tài liệu trước retrieval; chunk có
  citation/source metadata; prompt injection trong tài liệu không thay quyền code.
- Cost, token, timeout, retry và max tool loop là server policy; agentic tool
  allowlist tối thiểu, không có side effect không xác nhận.

## Trạng thái UI/API

Provider status không lộ secret: configured, reachable, capabilities (chat,
embeddings, structured output), model và checkedAt.

Reply chuẩn hóa: provider, usedModel, executionMode (MODEL hoặc UNAVAILABLE),
usage, citations, jobId khi async và requestId. Không hiển thị fallback
extractive/canned như kết quả model. Khi provider unavailable, UI phải nói rõ
chưa cấu hình/không reachable và không tạo kết quả giả.

## Thinking job

- Job có deadline, attempt count, claim atomically, stale reclaim và terminal error
  được che nội bộ.
- Worker dùng role từ membership/schema thật, không truy cập cột không tồn tại.
- UI poll/progress có cancellation/recovery sau reload; job success phải trả result
  cùng usedModel, usage và request ID.

## Eval gate

Duy trì 12–20 prompt/e2e cases: grounded citation, no-context, answer fishing,
prompt injection, structured compose, timeout/failover, RAG isolation, job restart,
cost cap, provider missing và mỗi capability có provider thật. Mock chỉ cho unit
failure isolation, không được chứng minh release.
