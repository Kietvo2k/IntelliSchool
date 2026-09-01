import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CareerSchoolsPage } from './CareerSchoolsPage.js';

describe('CareerSchoolsPage', () => {
  it('keeps the school search content-first with a real loading state', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><CareerSchoolsPage /></MemoryRouter>);
    expect(markup).toContain('Trường gợi ý');
    expect(markup).toContain('Đang tìm trường theo ngành');
  });
});
