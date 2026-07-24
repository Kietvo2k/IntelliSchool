import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RoleWorkspace } from './RoleWorkspace.js';

describe('role workspace shell', () => {
  it('shows a teacher the learning, assessment, and career-assistance areas without exposing platform controls', () => {
    const markup = renderToStaticMarkup(<RoleWorkspace user={{ userId: 'teacher-1', role: 'TEACHER', email: 'teacher@example.test', displayName: 'Cô An', schoolId: 'school-a' }} onLogout={() => undefined} />);
    expect(markup).toContain('Không gian giảng dạy');
    expect(markup).toContain('Bài giảng');
    expect(markup).toContain('Bài tập');
    expect(markup).toContain('Trợ lý định hướng');
    expect(markup).not.toContain('Duyệt trường');
  });
});
