import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionContext } from '../lib/SessionContext.js';
import { ClassesPage } from './ClassesPage.js';

function render(role: 'SCHOOL_OWNER' | 'TEACHER') {
  return renderToStaticMarkup(
    <SessionContext.Provider
      value={{
        user: { userId: 'u1', role, schoolId: 'school-1', email: 'owner@test.local', displayName: 'Owner' },
        logout: () => undefined,
      }}
    >
      <ClassesPage />
    </SessionContext.Provider>,
  );
}

describe('ClassesPage Wizard', () => {
  it('renders 3-step wizard for school owners', () => {
    const markup = render('SCHOOL_OWNER');
    expect(markup).toContain('Quản lý lớp học');
    expect(markup).toContain('1. Tạo lớp mới');
    expect(markup).toContain('2. Phân công giáo viên');
    expect(markup).toContain('3. Ghi danh học sinh');
    expect(markup).toContain('Mã lớp');
    expect(markup).toContain('Tên lớp');
  });

  it('renders only enrollment step for teachers without owner wizard steps', () => {
    const markup = render('TEACHER');
    expect(markup).toContain('Ghi danh lớp');
    expect(markup).toContain('Ghi danh học sinh vào lớp');
    expect(markup).not.toContain('1. Tạo lớp mới');
    expect(markup).not.toContain('2. Phân công giáo viên');
  });
});
