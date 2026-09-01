import { describe, expect, it } from 'vitest';
import { renderMarkup } from '../lib/test-render.js';
import { GradebookPage } from './GradebookPage.js';

describe('GradebookPage', () => {
  it('renders filters for class, subject and student with score headers', () => {
    const markup = renderMarkup(<GradebookPage />, {
      user: { userId: 'teacher-1', displayName: 'Thầy Hùng', email: 'hung@test.local', role: 'TEACHER', schoolId: 'school-1' },
      route: '/app/gradebook',
    });
    expect(markup).toContain('Sổ điểm');
    expect(markup).toContain('Tra cứu điểm theo lớp');
    expect(markup).toContain('Lớp học');
    expect(markup).toContain('Môn học');
    expect(markup).toContain('Học sinh');
  });
});
