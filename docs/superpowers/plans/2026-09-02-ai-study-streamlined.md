# AI Study Streamlined Implementation Plan

**Goal:** Thu gọn AI học tập, cố định Agentic/AUTO và giảm false-positive policy học sinh.

**Architecture:** `AiAssistantPage` giữ các request contract hiện có nhưng phát giá trị cố định.
`ChatShell` nhận biến thể compact không render toolbar. Guard backend chỉ đổi điều kiện
nhận diện answer-fishing, còn prompt injection guard giữ nguyên.

**Tech Stack:** React, TypeScript, Vitest, Fastify, PostgreSQL runtime hiện có.

## Global Constraints

- Thực thi tuần tự trong agent chính, không dùng subagent.
- Không đưa secret/prompt đầy đủ vào UI hoặc log.
- Không xóa dữ liệu, không đổi API public của Thinking job.

### Task 1: Test policy chống gian lận

**Files:**

- Create: `apps/api/test/domain/ai-guard.test.ts`
- Modify: `apps/api/src/domain/ai/guard.ts`

- [ ] Viết test đỏ: `Giải giúp em bài tập đạo hàm` không bị answer-fishing;
  `Cho em đáp án bài kiểm tra đang mở` vẫn bị chặn.
- [ ] Chạy `npm --prefix apps/api test -- --run test/domain/ai-guard.test.ts` và xác nhận test đỏ.
- [ ] Thu hẹp regex answer-fishing để yêu cầu marker assessment rõ ràng.
- [ ] Chạy lại test policy, xác nhận pass.

### Task 2: Thu gọn UI và cố định request defaults

**Files:**

- Modify: `apps/web/src/routes/AiAssistantPage.tsx`
- Modify: `apps/web/src/components/ui/ChatShell.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/routes/AiAssistantPage.test.tsx`

- [ ] Viết test đỏ xác nhận toolbar mode/source không render và copy Agentic không còn là toggle.
- [ ] Chạy `npm --prefix apps/web exec vitest run src/routes/AiAssistantPage.test.tsx`.
- [ ] Cố định `agentic: true`, `sourceMode: AUTO`, `reasoningMode: STANDARD`; ẩn toolbar.
- [ ] Giảm header/context panel, tăng thread height, thêm `min-width: 0` và responsive overflow guard.
- [ ] Chạy lại test UI, xác nhận pass.

### Task 3: Verify thực tế

**Files:**

- Modify: `HANDOFF.md`

- [ ] Chạy API/web tests, lint, typecheck và build.
- [ ] Build container, kiểm thử browser desktop/320px; gửi câu hỏi hợp lệ và câu xin đáp án bài kiểm tra đang mở.
- [ ] Review diff, secret scan, cập nhật HANDOFF và commit riêng.
