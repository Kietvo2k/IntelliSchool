import { describe, expect, it } from 'vitest';
import XlsxPopulate from 'xlsx-populate';
import { buildGradebookExport, buildProgressExport } from '../src/services/report-export.js';

describe('buildGradebookExport', () => {
  const rows = [{ studentCode: 'SPHS-01', studentName: 'Nguyễn Minh An', assignmentTitle: 'Kiểm tra', score: 8.5, maxScore: 10, attemptCount: 2, isLate: true, source: 'AUTO' }];

  it('creates UTF-8 BOM CSV with Vietnamese headings', async () => {
    const result = await buildGradebookExport('CSV', rows);
    expect(result.mimeType).toBe('text/csv; charset=utf-8');
    expect(result.bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(result.bytes.toString('utf8')).toContain('Mã học sinh');
    expect(result.bytes.toString('utf8')).toContain('Nguyễn Minh An');
  });

  it('creates XLSX with a frozen Vietnamese header row', async () => {
    const result = await buildGradebookExport('XLSX', rows);
    const workbook = await XlsxPopulate.fromDataAsync(result.bytes);
    const sheet = workbook.sheet('Sổ điểm');
    expect(sheet.cell('A1').value()).toBe('Mã học sinh');
    expect(sheet.panes()).toMatchObject({ state: 'frozen', ySplit: 1 });
  });
});

describe('buildProgressExport', () => {
  it('creates a Vietnamese CSV progress report', async () => {
    const result = await buildProgressExport('CSV', [{ studentCode: 'SPHS-01', studentName: 'Nguyễn Minh An', completionPercent: 75, averagePercent: 80, trend: 'IMPROVING', needsSupport: false }]);
    expect(result.bytes.toString('utf8')).toContain('Hoàn thành (%)');
    expect(result.bytes.toString('utf8')).toContain('Nguyễn Minh An');
  });
});
