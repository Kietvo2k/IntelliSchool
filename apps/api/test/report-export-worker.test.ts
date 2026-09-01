import { describe, expect, it, vi } from 'vitest';
import { processNextReportExport } from '../src/services/report-export-worker.js';

describe('processNextReportExport', () => {
  it('creates a private gradebook file then marks its job ready', async () => {
    const markReady = vi.fn(async () => undefined);
    const putPrivate = vi.fn(async () => undefined);
    const result = await processNextReportExport({
      claimNext: async () => ({ id: 'export-1', schoolId: 'school-1', kind: 'GRADEBOOK', format: 'CSV', filters: { classId: 'class-1' } }),
      listGradebook: async () => [{ studentCode: 'SPHS-01', studentName: 'Nguyễn Minh An', assignmentTitle: 'Kiểm tra', score: 8, maxScore: 10, attemptCount: 1, isLate: false, source: 'AUTO' }],
      listProgress: async () => [],
      putPrivate,
      markReady,
      markFailed: async () => undefined,
    });
    expect(result).toEqual({ status: 'READY', exportId: 'export-1' });
    expect(putPrivate).toHaveBeenCalledWith('reports/export-1.csv', expect.any(Buffer), 'text/csv; charset=utf-8');
    expect(markReady).toHaveBeenCalledWith('export-1', 'reports/export-1.csv');
  });
});
