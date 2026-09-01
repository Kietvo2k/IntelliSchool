import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionContext } from '../lib/SessionContext.js';
import { ProfilePage } from './ProfilePage.js';

describe('ProfilePage', () => {
  it('provides profile and session-security controls to a platform admin', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SessionContext.Provider value={{ user: { userId: 'admin-1', displayName: 'Platform Admin', email: 'admin@example.test', role: 'PLATFORM_ADMIN' }, logout: () => undefined }}>
          <ProfilePage />
        </SessionContext.Provider>
      </MemoryRouter>,
    );
    expect(markup).toContain('Thông tin của bạn');
    expect(markup).toContain('Bảo mật phiên đăng nhập');
    expect(markup).toContain('Thu hồi các phiên khác');
  });
});
