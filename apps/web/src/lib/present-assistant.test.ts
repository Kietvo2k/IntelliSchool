import { describe, expect, it } from 'vitest';
import { presentAssistantText } from '../lib/present-assistant.js';

describe('presentAssistantText', () => {
  it('shows the interview question instead of raw JSON', () => {
    expect(presentAssistantText('EXTRACURRICULAR_INTERVIEW', '{"question":"Em kể thêm về CLB?","extracted_fields":{}}')).toBe('Em kể thêm về CLB?');
  });

  it('strips compose fences for the chat log', () => {
    const raw = 'Đã điền khung.\n\n```json\n{"questions":[{"type":"ESSAY"}]}\n```';
    expect(presentAssistantText('TEACHER_COMPOSE', raw)).not.toContain('```json');
    expect(presentAssistantText('TEACHER_COMPOSE', raw)).toContain('Đã điền khung');
  });

  it('does not render provider reasoning blocks in the chat log', () => {
    expect(presentAssistantText('PERSONAL_STUDY', '<think>internal reasoning</think>\n\nLời giải cuối cùng.')).toBe('Lời giải cuối cùng.');
  });
});
