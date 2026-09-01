import { buildGradebookExport, buildProgressExport, type GradebookExportRow, type ProgressExportRow } from './report-export.js';

export interface ClaimedReportExport {
  id: string;
  schoolId: string;
  kind: 'GRADEBOOK' | 'PROGRESS';
  format: 'CSV' | 'XLSX';
  filters: { classId: string; subjectId?: string | null; studentId?: string | null };
}

export interface ReportExportWorkerDependencies {
  claimNext(): Promise<ClaimedReportExport | null>;
  listGradebook(job: ClaimedReportExport): Promise<GradebookExportRow[]>;
  listProgress(job: ClaimedReportExport): Promise<ProgressExportRow[]>;
  putPrivate(objectKey: string, bytes: Buffer, mimeType: string): Promise<void>;
  markReady(exportId: string, objectKey: string): Promise<void>;
  markFailed(exportId: string, message: string): Promise<void>;
}

export async function processNextReportExport(dependencies: ReportExportWorkerDependencies): Promise<{ status: 'IDLE' } | { status: 'READY'; exportId: string } | { status: 'FAILED'; exportId: string }> {
  const job = await dependencies.claimNext();
  if (!job) return { status: 'IDLE' };
  try {
    const file = job.kind === 'GRADEBOOK'
      ? await buildGradebookExport(job.format, await dependencies.listGradebook(job))
      : await buildProgressExport(job.format, await dependencies.listProgress(job));
    const objectKey = `reports/${job.id}.${file.extension}`;
    await dependencies.putPrivate(objectKey, file.bytes, file.mimeType);
    await dependencies.markReady(job.id, objectKey);
    return { status: 'READY', exportId: job.id };
  } catch (error) {
    await dependencies.markFailed(job.id, error instanceof Error ? error.message : 'Không thể tạo file export.');
    return { status: 'FAILED', exportId: job.id };
  }
}
