import { describe, expect, it } from 'vitest';
import { renderMarkup } from '../lib/test-render.js';
import { MyGradesPage } from './MyGradesPage.js';

describe('MyGradesPage', () => {
  it('renders student grades header and loading or empty state', () => {
    const markup = renderMarkup(<MyGradesPage />, {
      user: { userId: 'student-1', displayName: 'Em Nam', email: 'nam@test.local', role: 'STUDENT', schoolId: 'school-1' },
      route: '/app/grades',
    });
    expect(markup).toContain('Tiến độ học tập');
    expect(markup).toContain('Điểm của em');
  });
});
