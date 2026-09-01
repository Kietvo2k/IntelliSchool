import { describe, expect, it } from 'vitest';
import { renderMarkup } from '../lib/test-render.js';
import { QuestionBanksPage } from './QuestionBanksPage.js';

describe('QuestionBanksPage', () => {
  it('renders a type-specific question authoring form for educators', () => {
    const markup = renderMarkup(<QuestionBanksPage />, {
      user: { userId: 'teacher-1', displayName: 'Cô An', email: 'teacher@example.test', role: 'TEACHER', schoolId: 'school-1' },
    });
    expect(markup).toContain('Lựa chọn A');
    expect(markup).toContain('Lựa chọn B');
    expect(markup).toContain('Đáp án đúng');
    expect(markup).toContain('Trắc nghiệm');
  });
});
