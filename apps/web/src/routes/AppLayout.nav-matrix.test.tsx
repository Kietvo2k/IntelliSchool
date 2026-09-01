import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SessionContext } from '../lib/SessionContext.js';
import type { SessionUser } from '../lib/session.js';
import { AppQueryProvider } from '../lib/query.js';
import { AppLayout } from './AppLayout.js';

function renderLayout(user: SessionUser): string {
  return renderToStaticMarkup(
    <AppQueryProvider>
      <MemoryRouter initialEntries={['/app']}>
        <SessionContext.Provider value={{ user, logout: () => undefined }}>
          <AppLayout />
        </SessionContext.Provider>
      </MemoryRouter>
    </AppQueryProvider>,
  );
}

const base = {
  userId: 'user-1',
  email: 'user@example.test',
  displayName: 'Người dùng thử nghiệm',
  schoolId: 'school-a',
} as const;

describe('phase 5 nav matrix', () => {
  it('exposes the locked labels for every workspace role', () => {
    const admin = renderLayout({ ...base, role: 'PLATFORM_ADMIN', schoolId: undefined });
    expect(admin).toContain('Duyệt trường');
    expect(admin).toContain('Danh mục hướng nghiệp');

    const owner = renderLayout({ ...base, role: 'SCHOOL_OWNER' });
    expect(owner).toContain('Lớp &amp; giáo viên');
    expect(owner).toContain('Duyệt đăng ký');
    expect(owner).toContain('Sổ điểm');
    expect(owner).toContain('Giám thị thi thử');
    expect(owner).toContain('Skill nháp');

    const teacher = renderLayout({ ...base, role: 'TEACHER' });
    expect(teacher).toContain('Lớp');
    expect(teacher).toContain('Soạn bài AI');
    expect(teacher).not.toContain('Trợ giảng');
    expect(teacher).not.toContain('Danh mục nghề');
    expect(teacher).toContain('Thi');
    expect(teacher).not.toContain('Học sinh chủ nhiệm');

    const homeroom = renderLayout({ ...base, role: 'TEACHER', homeroomClassIds: ['class-1'] });
    expect(homeroom).toContain('Học sinh chủ nhiệm');
    expect(homeroom).toContain('Tin nhắn');
    expect(homeroom).toContain('Skill nháp');

    const student = renderLayout({ ...base, role: 'STUDENT' });
    expect(student).toContain('Phòng thi');
    expect(student).toContain('Khám phá');
    expect(student).toContain('AI học tập');
    expect(student).toContain('Tin nhắn');
    expect(student).not.toContain('Trợ giảng');
    expect(student).not.toContain('Sổ điểm');
    expect(student).not.toContain('Giám thị thi thử');
  });
});
