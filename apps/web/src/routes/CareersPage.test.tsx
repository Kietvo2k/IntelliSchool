import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CareersPage } from './CareersPage.js';
import { SessionContext } from '../lib/SessionContext.js';

function render(role: 'STUDENT' | 'PLATFORM_ADMIN') {
  return renderToStaticMarkup(
    <SessionContext.Provider value={{ user: { userId: 'u1', role, schoolId: role === 'STUDENT' ? 's1' : undefined, email: 'u@e.test', displayName: 'U' }, logout: () => undefined }}>
      <CareersPage />
    </SessionContext.Provider>,
  );
}

describe('CareersPage', () => {
  it('shows the catalog browse view with source disclaimer for students', () => {
    const markup = render('STUDENT');
    expect(markup).toContain('Danh mục nghề');
    expect(markup).toContain('kèm nguồn tham khảo');
    expect(markup).not.toContain('Quản lý danh mục (admin)');
  });

  it('reveals the admin management section only for platform admins', () => {
    expect(render('PLATFORM_ADMIN')).toContain('Quản lý danh mục (admin)');
  });
});
