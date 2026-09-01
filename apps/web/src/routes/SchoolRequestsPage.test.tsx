import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchoolRequestsPage } from './SchoolRequestsPage.js';

describe('SchoolRequestsPage', () => {
  it('keeps the platform admin approval and rejection decisions accessible', () => {
    const markup = renderToStaticMarkup(<SchoolRequestsPage />);
    expect(markup).toContain('Yêu cầu mở trường');
    expect(markup).toContain('Đang tải danh sách');
  });
});
