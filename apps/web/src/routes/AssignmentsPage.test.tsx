import { describe, expect, it } from 'vitest';
import { renderMarkup } from '../lib/test-render.js';
import { AssignmentDetailPage } from './AssignmentDetailPage.js';

describe('AssignmentDetailPage', () => {
  it('offers attempt-limit and grading-policy controls to an educator', () => {
    const markup = renderMarkup(<AssignmentDetailPage />, {
      user: { userId: 'teacher-1', displayName: 'Cô An', email: 'teacher@example.test', role: 'TEACHER', schoolId: 'school-1' },
      route: '/app/assignments/new',
    });
    expect(markup).toContain('Số lượt làm tối đa');
    expect(markup).toContain('Cách lấy điểm chính thức');
    expect(markup).toContain('Danh sách câu hỏi');
    expect(markup).toContain('Thêm vào bài tập');
    expect(markup).toContain('Hạn nộp');
  });
});
