import { createPool } from './db.js';
import { PostgresResourceScanJobRepository } from './repositories/postgres-resource-scan-jobs.js';
import { ClamAvScanner } from './services/clamav-scanner.js';
import { MinioResourceStorage } from './services/minio-resource-storage.js';
import { processNextResourceScan } from './services/resource-scan-worker.js';

const databaseUrl = process.env.PLATFORM_CONTROL_DATABASE_URL;
const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;
if (!databaseUrl || !endpoint || !accessKey || !secretKey) throw new Error('PLATFORM_CONTROL_DATABASE_URL and MINIO_* configuration are required.');

const pool = createPool(databaseUrl);
const storage = new MinioResourceStorage({ endpoint, port: Number(process.env.MINIO_PORT ?? 9000), useSSL: process.env.MINIO_USE_SSL === 'true', accessKey, secretKey, quarantineBucket: process.env.MINIO_QUARANTINE_BUCKET, readyBucket: process.env.MINIO_READY_BUCKET });
const repository = new PostgresResourceScanJobRepository(pool);
const scanner = new ClamAvScanner(storage, { host: process.env.CLAMAV_HOST ?? '127.0.0.1', port: Number(process.env.CLAMAV_PORT ?? 3310) });
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; });

while (!stopping) {
  const result = await processNextResourceScan({ repository, storage, scanner });
  if (result.outcome === 'IDLE') await new Promise((resolve) => setTimeout(resolve, 1_000));
}
await pool.end();
