import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, hasGroundedCitationReference } from '../../src/domain/ai/chat.js';

describe('AI study system prompt', () => {
  it('requires a student-facing final answer without internal deliberation', () => {
    const prompt = buildSystemPrompt('GROUNDED', 'PERSONAL_STUDY');
    expect(prompt).toContain('Không xuất quá trình suy luận nội bộ');
    expect(prompt).toContain('Trả lời trực tiếp cho học sinh');
  });

  it('recognizes only references that point to retrieved citations', () => {
    expect(hasGroundedCitationReference('Áp dụng công thức [1].', 1)).toBe(true);
    expect(hasGroundedCitationReference('Áp dụng công thức [2].', 1)).toBe(false);
    expect(hasGroundedCitationReference('Áp dụng công thức.', 1)).toBe(false);
  });
});
