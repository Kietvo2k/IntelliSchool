import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../../src/domain/ai/chat.js';

describe('AI study system prompt', () => {
  it('requires a student-facing final answer without internal deliberation', () => {
    const prompt = buildSystemPrompt('GROUNDED', 'PERSONAL_STUDY');
    expect(prompt).toContain('Không xuất quá trình suy luận nội bộ');
    expect(prompt).toContain('Trả lời trực tiếp cho học sinh');
  });
});
