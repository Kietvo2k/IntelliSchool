import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { AppQueryProvider } from './lib/query.js';

function renderApp(route = '/') {
  return renderToStaticMarkup(
    <AppQueryProvider>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </AppQueryProvider>,
  );
}

describe('Smart Path Platform landing page', () => {
  it('uses the Smart Path Platform brand and presents the three product paths', () => {
    const markup = renderApp();
    const text = markup.replace(/<[^>]*>/g, '');
    expect(text).toContain('Smart Path Platform');
    expect(text).toContain('Nền tảng trường số');
    expect(markup).toContain('Lớp học');
    expect(markup).toContain('Định hướng');
    expect(markup).toContain('Quản trị');
    expect(text).not.toMatch(/Tenant|audit trail|school-first|Mở không gian số/i);
  });

  it('offers an accessible login entry point in addition to the school-request flow', () => {
    const markup = renderApp();
    expect(markup).toContain('Đăng nhập');
    expect(markup).toContain('href="/auth/login"');
    expect(markup).toContain('href="/auth/school-request"');
    expect(markup).not.toContain('aria-haspopup="dialog"');
  });

  it('does not flash the public landing while the workspace is hydrating', () => {
    const markup = renderApp('/app');
    expect(markup).toContain('Đang mở không gian làm việc');
    expect(markup).not.toContain('Dạy, học và hướng nghiệp trong');
    expect(markup).not.toContain('Mở không gian số cho');
  });
});
