import type { FastifyInstance } from 'fastify';
import { ClamAvScanner } from './clamav-scanner.js';
import { processNextReportExport } from './report-export-worker.js';
import { processNextResourceScan } from './resource-scan-worker.js';
import type { ResourceObjectStorage } from './resource-object-storage.js';
import { PostgresResourceScanJobRepository } from '../repositories/postgres-resource-scan-jobs.js';
import { PostgresReportExportJobRepository } from '../repositories/postgres-report-export-jobs.js';
import type pg from 'pg';

const alwaysCleanScanner = { scan: async () => 'CLEAN' as const };

export function startInlineWorkers(options: {
  app: FastifyInstance;
  controlPool: pg.Pool;
  storage: ResourceObjectStorage;
}): void {
  const scanRepository = new PostgresResourceScanJobRepository(options.controlPool);
  const exportRepository = new PostgresReportExportJobRepository(options.controlPool);
  const scanner = process.env.CLAMAV_HOST
    ? new ClamAvScanner(options.storage, { host: process.env.CLAMAV_HOST, port: Number(process.env.CLAMAV_PORT ?? 3310), timeoutMs: 8_000 })
    : alwaysCleanScanner;

  let scanBusy = false;
  let exportBusy = false;
  const scanTimer = setInterval(() => {
    if (scanBusy) return;
    scanBusy = true;
    void processNextResourceScan({ repository: scanRepository, storage: options.storage, scanner })
      .catch((error) => console.error(error))
      .finally(() => { scanBusy = false; });
  }, 2_000);
  const exportTimer = setInterval(() => {
    if (exportBusy) return;
    exportBusy = true;
    void processNextReportExport({
      claimNext: () => exportRepository.claimNext(),
      listGradebook: (job) => exportRepository.listGradebook(job),
      listProgress: (job) => exportRepository.listProgress(job),
      markReady: (exportId, objectKey) => exportRepository.markReady(exportId, objectKey),
      markFailed: (exportId, message) => exportRepository.markFailed(exportId, message),
      putPrivate: (objectKey, bytes, mimeType) => options.storage.putPrivate(objectKey, bytes, mimeType),
    }).catch((error) => console.error(error)).finally(() => { exportBusy = false; });
  }, 3_000);
  scanTimer.unref();
  exportTimer.unref();
  options.app.addHook('onClose', async () => {
    clearInterval(scanTimer);
    clearInterval(exportTimer);
  });
}
