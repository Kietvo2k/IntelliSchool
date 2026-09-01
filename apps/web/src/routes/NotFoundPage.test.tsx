import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NotFoundPage } from './NotFoundPage.js';
import { SessionContext } from '../lib/SessionContext.js';
import type { SessionUser } from '../lib/session.js';

const mockStudentUser: SessionUser = {
  userId: 'usr-student-1',
  schoolId: 'sch-1',
  role: 'STUDENT',
  email: 'hocsinh@nguyendu.edu.vn',
  displayName: 'Nguyễn Văn Học Sinh',
};

describe('NotFoundPage', () => {
  it('renders 404 elements, back action and shortcuts for unauthenticated visitors', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/not-found']}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('Không tìm thấy trang');
    expect(markup).toContain('404');
    expect(markup).toContain('Quay lại');
    expect(markup).toContain('Về trang chủ');
    expect(markup).toContain('Mở trường mới');
    expect(markup).toContain('Đăng nhập');
  });

  it('renders workspace shortcuts when user has active session', () => {
    const markup = renderToStaticMarkup(
      <SessionContext.Provider value={{ user: mockStudentUser, logout: () => {} }}>
        <MemoryRouter initialEntries={['/not-found']}>
          <NotFoundPage />
        </MemoryRouter>
      </SessionContext.Provider>,
    );

    expect(markup).toContain('Không tìm thấy trang');
    expect(markup).toContain('Vào không gian làm việc');
    expect(markup).toContain('Bài giảng');
    expect(markup).toContain('Hướng nghiệp');
    expect(markup).toContain('Hồ sơ cá nhân');
  });
});
