import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuditLogPage } from './AuditLogPage.js';

describe('AuditLogPage', () => {
  it('offers a security audit filter and does not render internal identifiers as a primary field', () => {
    const markup = renderToStaticMarkup(<AuditLogPage />);
    expect(markup).toContain('Nhật ký bảo mật');
    expect(markup).toContain('Lọc theo hành động');
    expect(markup).toContain('Người thực hiện');
    expect(markup).toContain('Trường');
    expect(markup).toContain('Từ thời điểm');
    expect(markup).not.toContain('targetId');
  });
});
