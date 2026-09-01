import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BillingPage } from './BillingPage.js';
import { AdminBillingPage } from './AdminBillingPage.js';

describe('BillingPage', () => {
  it('renders the owner billing overview heading', () => {
    const markup = renderToStaticMarkup(<BillingPage />);
    expect(markup).toContain('Gói dịch vụ');
    expect(markup).toContain('Chi phí hằng tháng');
  });
});

describe('AdminBillingPage', () => {
  it('renders the admin subscription management heading', () => {
    const markup = renderToStaticMarkup(<AdminBillingPage />);
    expect(markup).toContain('Quản lý gói dịch vụ');
  });
});
