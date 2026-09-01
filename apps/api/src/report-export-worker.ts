import { createPool } from './db.js';
import { PostgresReportExportJobRepository } from './repositories/postgres-report-export-jobs.js';
import { MinioResourceStorage } from './services/minio-resource-storage.js';
import { processNextReportExport } from './services/report-export-worker.js';

const databaseUrl = process.env.PLATFORM_CONTROL_DATABASE_URL;
if (!databaseUrl) throw new Error('PLATFORM_CONTROL_DATABASE_URL is required.');
if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) throw new Error('MinIO configuration is required.');
const pool = createPool(databaseUrl);
const repository = new PostgresReportExportJobRepository(pool);
const storage = new MinioResourceStorage({ endpoint: process.env.MINIO_ENDPOINT, port: Number(process.env.MINIO_PORT ?? 9000), useSSL: process.env.MINIO_USE_SSL === 'true', accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY, quarantineBucket: process.env.MINIO_QUARANTINE_BUCKET, readyBucket: process.env.MINIO_READY_BUCKET });
try {
  console.log(JSON.stringify(await processNextReportExport({
    claimNext: () => repository.claimNext(),
    listGradebook: (job) => repository.listGradebook(job),
    listProgress: (job) => repository.listProgress(job),
    markReady: (exportId, objectKey) => repository.markReady(exportId, objectKey),
    markFailed: (exportId, message) => repository.markFailed(exportId, message),
    putPrivate: (objectKey, bytes, mimeType) => storage.putPrivate(objectKey, bytes, mimeType),
  })));
}
finally { await pool.end(); }
