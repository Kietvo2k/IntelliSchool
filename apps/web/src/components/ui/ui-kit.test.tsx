import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataTable } from './DataTable.js';
import { LessonBlockEditor } from './LessonBlockEditor.js';
import { MetricCard } from './MetricCard.js';
import { PageHeader } from './PageHeader.js';
import { StatusBadge } from './StatusBadge.js';

describe('workspace UI kit', () => {
  it('renders page chrome, metric units, table headers and a resource block control', () => {
    const markup = renderToStaticMarkup(
      <>
        <PageHeader eyebrow="Không gian" title="Tổng quan" lede="Việc hôm nay." />
        <MetricCard label="Hoàn thành bài học" value={82} unit="%" />
        <StatusBadge tone="published">Đã xuất bản</StatusBadge>
        <DataTable headers={['Học sinh', 'Điểm']}><tr><td>Minh An</td><td>8/10</td></tr></DataTable>
        <LessonBlockEditor
          blocks={[{ type: 'resource', resourceId: 'res-1' }]}
          onChange={() => undefined}
          resources={[{ id: 'res-1', originalName: 'dao-ham.pdf', mimeType: 'application/pdf', byteSize: 12, status: 'READY' }]}
        />
      </>,
    );
    expect(markup).toContain('Tổng quan');
    expect(markup).toContain('82%');
    expect(markup).toContain('Học sinh');
    expect(markup).toContain('Gắn tài nguyên');
    expect(markup).toContain('dao-ham.pdf');
    expect(markup).toContain('<table');
  });
});
