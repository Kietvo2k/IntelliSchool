import type { AuthContext } from '../types.js';
import type { Readable } from 'node:stream';

export class ReportExportDownloadService {
  constructor(private readonly dependencies: { repository: { getReadyReportExport(actor: AuthContext, exportId: string): Promise<{ objectKey: string; kind: 'GRADEBOOK' | 'PROGRESS'; format: 'CSV' | 'XLSX' }>; }; storage: { signedReadyDownload(objectKey: string, expiresSeconds?: number): Promise<string>; getReadyStream?: (objectKey: string) => Promise<Readable>; }; }) {}
  async getDownload(actor: AuthContext, exportId: string): Promise<{ url: string; expiresAt: string }> {
    const { objectKey } = await this.dependencies.repository.getReadyReportExport(actor, exportId);
    const expiresSeconds = 300;
    return { url: await this.dependencies.storage.signedReadyDownload(objectKey, expiresSeconds), expiresAt: new Date(Date.now() + expiresSeconds * 1_000).toISOString() };
  }

  async getFile(actor: AuthContext, exportId: string): Promise<{ stream: Readable; filename: string; mimeType: string }> {
    const file = await this.dependencies.repository.getReadyReportExport(actor, exportId);
    if (!this.dependencies.storage.getReadyStream) throw new Error('Storage không hỗ trợ tải file trực tiếp.');
    const extension = file.format === 'CSV' ? 'csv' : 'xlsx';
    const mimeType = file.format === 'CSV' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return { stream: await this.dependencies.storage.getReadyStream(file.objectKey), filename: `smartpath-${file.kind.toLowerCase()}-${exportId}.${extension}`, mimeType };
  }
}
