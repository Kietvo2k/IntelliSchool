import { describe, expect, it } from 'vitest';
import { presentAssistantText } from '../../src/domain/ai/present.js';

describe('presentAssistantText', () => {
  it('extracts question prose from interview JSON', () => {
    expect(presentAssistantText('EXTRACURRICULAR_INTERVIEW', '```json\n{"question":"Em tham gia CLB nào?","ask_followup":true}\n```')).toBe('Em tham gia CLB nào?');
  });

  it('never returns a raw object dump', () => {
    expect(presentAssistantText('CAREER_CHAT', '{"report":"Nên xem thêm ngành CNTT."}')).toBe('Nên xem thêm ngành CNTT.');
    expect(presentAssistantText('ASSISTANT', '{ "oops": true }')).toBe('Đã ghi nhận câu trả lời.');
  });
});
