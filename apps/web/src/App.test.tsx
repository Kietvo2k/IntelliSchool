import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('Smart Path Platform landing page', () => {
  it('uses the Smart Path Platform brand and presents the three product paths', () => {
    const markup = renderToStaticMarkup(<App />);
    const text = markup.replace(/<[^>]*>/g, '');
    expect(text).toContain('Smart Path Platform');
    expect(text).toContain('Nền tảng trường số');
    expect(markup).toContain('Lớp học');
    expect(markup).toContain('Định hướng');
    expect(markup).toContain('Quản trị');
  });
});

  it('offers an accessible login entry point in addition to the school-request flow', () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain('Đăng nhập');
    expect(markup).toContain('aria-haspopup="dialog"');
  });
