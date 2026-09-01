import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SessionContext } from '../lib/SessionContext.js';
import { AdminUsersPage } from './AdminUsersPage.js';

describe('AdminUsersPage', () => {
  it('renders accessible filters and account-management controls', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SessionContext.Provider value={{ user: { userId: 'admin-1', displayName: 'Platform Admin', email: 'admin@example.test', role: 'PLATFORM_ADMIN' }, logout: () => undefined }}>
          <AdminUsersPage />
        </SessionContext.Provider>
      </MemoryRouter>,
    );
    expect(markup).toContain('Quản lý người dùng');
    expect(markup).toContain('Mời admin nền tảng');
    expect(markup).toContain('Email admin mới');
    expect(markup).toContain('Lọc theo trường');
    expect(markup).toContain('Lọc theo vai trò');
    expect(markup).toContain('Tải danh sách');
  });
});
