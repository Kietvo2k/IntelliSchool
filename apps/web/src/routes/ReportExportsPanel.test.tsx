import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReportExportsPanel } from './ReportExportsPanel.js';

describe('ReportExportsPanel', () => {
  it('offers gradebook and progress exports with a disabled safe default', () => {
    const markup = renderToStaticMarkup(<ReportExportsPanel classId="" />);
    expect(markup).toContain('Xuất báo cáo');
    expect(markup).toContain('Xuất sổ điểm');
    expect(markup).toContain('Xuất tiến độ');
  });
});
