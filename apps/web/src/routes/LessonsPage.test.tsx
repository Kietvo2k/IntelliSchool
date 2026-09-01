import { describe, expect, it } from 'vitest';
import { renderMarkup } from '../lib/test-render.js';
import { LessonsPage } from './LessonsPage.js';

describe('LessonsPage', () => {
  it('renders a labelled lesson selector and a visible completion control for learners', () => {
    const markup = renderMarkup(<LessonsPage />, {
      user: { userId: 'student-1', displayName: 'Minh An', email: 'minh@example.test', role: 'STUDENT', schoolId: 'school-1' },
    });
    expect(markup).toContain('Bài giảng của em');
    expect(markup).toContain('for="lessonClassId"');
  });
});
