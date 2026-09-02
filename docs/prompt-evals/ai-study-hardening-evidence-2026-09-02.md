# AI study hardening evidence — 2026-09-02

## Baseline

Live câu hỏi về đạo hàm từng nhận thêm citation `LEARNER_PROFILE / Hồ sơ học tập`.
Nguyên nhân là retrieval `AUTO` cho phép mọi document cùng `user_id` tham gia ranking.

## Thay đổi

- Citation học tập chỉ nhận `RESOURCE`, `LESSON`, `TEXT`.
- Nếu grounded response thiếu citation `[n]`, cùng provider được retry tối đa một lần;
  budget reserve hai lần gọi.
- Prompt yêu cầu final answer only và API/UI loại block `<think>…</think>`.

## Kết quả

- RAG integration isolated: 7/7 pass, bao gồm profile exclusion regression.
- Playwright viewport 320px: pass, không toolbar mode/source và không horizontal overflow.
- Live request `cf79bd6d-eff0-4891-9140-dba02be9219b`:
  `OPENAI_COMPATIBLE / deepseek-v4-flash`, 2774 input token, 280 output token,
  citation `[1] TEXT / Ôn tập đạo hàm cơ bản`.
- Không có `LEARNER_PROFILE` trong citation hoặc output deliberation.
