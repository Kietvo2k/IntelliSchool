import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SchoolRequestPage } from './SchoolRequestPage.js';

describe('SchoolRequestPage', () => {
  it('renders the public school-opening form on its own route', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/auth/school-request']}>
        <SchoolRequestPage />
      </MemoryRouter>,
    );
    expect(markup).toContain('Tên trường');
    expect(markup).toContain('Họ tên hiệu trưởng');
    expect(markup).toContain('Email công việc');
    expect(markup).toContain('Tỉnh / thành phố');
    expect(markup).toContain('href="/auth/login"');
  });
});
