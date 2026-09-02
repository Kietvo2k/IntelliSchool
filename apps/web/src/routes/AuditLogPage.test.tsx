import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuditLogPage } from './AuditLogPage.js';
import { formatAiAuditMetadata } from './audit-display.js';

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

  it('formats safe AI evidence for an administrator without exposing prompt content', () => {
    const detail = formatAiAuditMetadata({
      category: 'AI', operation: 'CHAT', status: 'COMPLETED', provider: 'OPENAI_COMPATIBLE',
      usedModel: 'deepseek-v4-flash', inputTokens: 120, outputTokens: 80,
      requestId: 'request-123', prompt: 'không được hiển thị',
    });
    expect(detail).toContain('deepseek-v4-flash');
    expect(detail).toContain('120 in / 80 out');
    expect(detail).toContain('request-123');
    expect(detail).not.toContain('không được hiển thị');
  });
});
