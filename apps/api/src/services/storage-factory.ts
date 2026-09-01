import { LocalResourceStorage } from './local-resource-storage.js';
import { MinioResourceStorage } from './minio-resource-storage.js';
import type { ResourceObjectStorage } from './resource-object-storage.js';

export function createResourceStorage(): ResourceObjectStorage | undefined {
  const localDir = process.env.LOCAL_STORAGE_DIR?.trim();
  if (localDir) {
    const secret = process.env.FILE_SIGNING_SECRET?.trim() || process.env.STUDENT_IDENTITY_HMAC_SECRET?.trim();
    if (!secret) throw new Error('FILE_SIGNING_SECRET or STUDENT_IDENTITY_HMAC_SECRET is required for local file storage.');
    return new LocalResourceStorage({
      rootDir: localDir,
      publicBaseUrl: process.env.APP_BASE_URL ?? 'http://127.0.0.1:8080',
      signingSecret: secret,
      quotaBytes: Number(process.env.FILE_QUOTA_BYTES ?? 6 * 1024 * 1024 * 1024),
    });
  }
  if (process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY) {
    return new MinioResourceStorage({
      endpoint: process.env.MINIO_ENDPOINT,
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      quarantineBucket: process.env.MINIO_QUARANTINE_BUCKET,
      readyBucket: process.env.MINIO_READY_BUCKET,
    });
  }
  return undefined;
}
