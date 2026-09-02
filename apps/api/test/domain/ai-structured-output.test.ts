import { describe, expect, it } from 'vitest';
import {
  AptitudeEssayOutputSchema,
  CareerAgentOutputSchema,
  CareerSynthesisOutputSchema,
  InterviewTurnOutputSchema,
  TeacherComposeOutputSchema,
  parseStructuredOutput,
} from '../../src/domain/ai/structured.js';
import { chatWithStructured } from '../../src/services/ai/structured-call.js';

describe('AI structured output boundary', () => {
  it('accepts a teacher compose payload only when the question contract is valid', () => {
    const question = { type: 'MULTIPLE_CHOICE', prompt: { text: '2+2?', choices: ['3', '4'] }, answerKey: { choice: '4' }, rubric: {}, maxScore: 1 };
    const parsed = parseStructuredOutput(
      JSON.stringify({ questions: Array.from({ length: 5 }, () => question), note: 'Kiểm tra trước khi lưu.' }),
      TeacherComposeOutputSchema,
    );
    expect(parsed.success).toBe(true);
    expect(parseStructuredOutput('{"questions":[]}', TeacherComposeOutputSchema).success).toBe(false);
  });

  it('rejects model output that asks for executable side effects', () => {
    const result = parseStructuredOutput('{"action":"DROP TABLE users"}', TeacherComposeOutputSchema);
    expect(result.success).toBe(false);
  });

  it('validates aptitude, interview and career result shapes', () => {
    expect(parseStructuredOutput('{"score":0.8,"rationale":"Có lập luận đúng."}', AptitudeEssayOutputSchema).success).toBe(true);
    expect(parseStructuredOutput('{"ask_followup":true,"question":"Em giữ vai trò gì?","extracted_fields":{"role":"trưởng nhóm"}}', InterviewTurnOutputSchema).success).toBe(true);
    expect(parseStructuredOutput('{"summary":"Phân tích có dữ liệu.","recommendations":[]}', CareerAgentOutputSchema).success).toBe(true);
    expect(parseStructuredOutput('{"report":"Báo cáo.","findings":[]}', CareerSynthesisOutputSchema).success).toBe(true);
    expect(parseStructuredOutput('{"report":123,"findings":[]}', CareerSynthesisOutputSchema).success).toBe(false);
  });

  it('retries bounded malformed structured output with the same provider', async () => {
    let attempts = 0;
    const provider = {
      kind: 'OPENAI_COMPATIBLE' as const,
      chat: async () => ({ text: attempts++ === 0 ? 'not-json' : '{"score":0.5,"rationale":"Đạt."}', usage: { inputTokens: 2, outputTokens: 2 } }),
      embed: async () => [],
    };
    const result = await chatWithStructured({ provider, messages: [{ role: 'user', content: 'Chấm.' }], schema: AptitudeEssayOutputSchema, requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(result.data.score).toBe(0.5);
    expect(attempts).toBe(2);
  });
});
