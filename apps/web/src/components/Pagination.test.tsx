import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Pagination } from './Pagination.js';

describe('Pagination', () => {
  it('renders labelled previous and next controls for a paginated result', () => {
    const markup = renderToStaticMarkup(
      <Pagination page={2} totalPages={3} totalItems={53} onChange={() => undefined} />,
    );

    expect(markup).toContain('Trang 2 trên 3');
    expect(markup).toContain('Tổng cộng 53 mục');
    expect(markup).toContain('Trang trước');
    expect(markup).toContain('Trang sau');
  });

  it('disables previous at the first page and next at the final page', () => {
    const first = renderToStaticMarkup(<Pagination page={1} totalPages={3} totalItems={53} onChange={() => undefined} />);
    const last = renderToStaticMarkup(<Pagination page={3} totalPages={3} totalItems={53} onChange={() => undefined} />);

    expect(first).toMatch(/aria-label="Trang trước"[^>]*disabled/);
    expect(last).toMatch(/aria-label="Trang sau"[^>]*disabled/);
  });
});
