import { describe, expect, it } from 'vitest';
import { composeFallback, looksLikeComposeConfirm, parseComposeCounts } from '../../src/domain/ai/chat.js';

describe('teacher compose fallback', () => {
  it('asks for counts before generating questions', () => {
    const reply = composeFallback('TEACHER_COMPOSE', [], 'Soạn giúp đề đạo hàm');
    expect(reply).toContain('Trước khi sinh đề');
    expect(reply).not.toContain('```json');
    expect(looksLikeComposeConfirm('Soạn giúp đề đạo hàm')).toBe(false);
  });

  it('fills at least five questions after the teacher confirms counts', () => {
    expect(looksLikeComposeConfirm('Xác nhận sinh đề: 2 trắc nghiệm, 1 đúng/sai, 1 ngắn, 1 tự luận')).toBe(true);
    const counts = parseComposeCounts('Xác nhận sinh đề: 2 trắc nghiệm, 1 đúng/sai, 1 ngắn, 1 tự luận');
    expect(counts.mcq + counts.tf + counts.short + counts.essay).toBeGreaterThanOrEqual(5);
    const reply = composeFallback('TEACHER_COMPOSE', [], 'Xác nhận sinh đề: 2 trắc nghiệm, 1 đúng/sai, 1 ngắn, 1 tự luận');
    expect(reply).toContain('```json');
    expect(reply).toContain('TRUE_FALSE');
    expect(reply).toContain('SHORT_ANSWER');
  });
});
