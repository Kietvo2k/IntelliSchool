import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CareerResultsPage } from './CareerResultsPage.js';

describe('CareerResultsPage', () => {
  it('exposes an honest loading state while the real result API is pending', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><CareerResultsPage /></MemoryRouter>);
    expect(markup).toContain('Đang tải kết quả từ hồ sơ và dữ liệu đã kiểm chứng');
  });
});
