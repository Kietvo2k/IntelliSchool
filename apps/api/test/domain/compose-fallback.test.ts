import { describe, expect, it } from 'vitest';
import { buildTeacherComposePrompt, looksLikeComposeConfirm, parseComposeCounts } from '../../src/domain/ai/chat.js';

describe('teacher compose request contract', () => {
  it('requires confirmed counts before the provider compose call', () => {
    expect(looksLikeComposeConfirm('Soạn giúp đề đạo hàm')).toBe(false);
    expect(looksLikeComposeConfirm('Xác nhận sinh đề: 2 trắc nghiệm, 1 đúng/sai, 1 ngắn, 1 tự luận')).toBe(true);
    const counts = parseComposeCounts('Xác nhận sinh đề: 2 trắc nghiệm, 1 đúng/sai, 1 ngắn, 1 tự luận');
    expect(counts.mcq + counts.tf + counts.short + counts.essay).toBeGreaterThanOrEqual(5);
    expect(buildTeacherComposePrompt('Xác nhận sinh đề: 2 trắc nghiệm, 1 đúng/sai, 1 ngắn, 1 tự luận')).toContain('MULTIPLE_CHOICE=2');
  });
});
