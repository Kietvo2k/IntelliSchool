import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AspirationsPage } from './AspirationsPage.js';

describe('AspirationsPage', () => {
  it('renders the aspiration manager with an advisory framing', () => {
    const markup = renderToStaticMarkup(<AspirationsPage />);
    expect(markup).toContain('Nguyện vọng của em');
    expect(markup).toContain('chỉ mang tính tham khảo');
    expect(markup).toContain('Học bổng phù hợp');
  });
});
