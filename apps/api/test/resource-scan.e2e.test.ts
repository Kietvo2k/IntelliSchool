import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresResourceRepository } from '../src/repositories/postgres-resources.js';
import { PostgresResourceScanJobRepository } from '../src/repositories/postgres-resource-scan-jobs.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';
import { ClamAvScanner } from '../src/services/clamav-scanner.js';
import { MinioResourceStorage } from '../src/services/minio-resource-storage.js';
import { processNextResourceScan } from '../src/services/resource-scan-worker.js';
import { ResourceUploadService } from '../src/services/resource-upload-service.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });
const storage = new MinioResourceStorage({ endpoint: process.env.MINIO_ENDPOINT ?? '127.0.0.1', port: Number(process.env.MINIO_PORT ?? 9000), accessKey: process.env.MINIO_ACCESS_KEY ?? 'smartclass', secretKey: process.env.MINIO_SECRET_KEY ?? 'smartclass_local_only', quarantineBucket: 'smartpath-test-quarantine', readyBucket: 'smartpath-test-resources' });

describe('resource scan end-to-end', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('makes a clean PDF downloadable only after ClamAV marks it clean', async () => {
    const user = await controlPool.query<{ id: string; school_id: string; email: string; display_name: string }>(`
      SELECT u.id, sm.school_id, u.email::text, u.display_name FROM users u JOIN school_memberships sm ON sm.user_id = u.id WHERE sm.role = 'SCHOOL_OWNER' LIMIT 1
    `);
    const actor = user.rows[0]!;
    const resourceRepository = new PostgresResourceRepository(apiPool);
    const uploaded = await new ResourceUploadService({ storage, repository: resourceRepository }).upload(
      { userId: actor.id, schoolId: actor.school_id, email: actor.email, displayName: actor.display_name, role: 'SCHOOL_OWNER' },
      { filename: 'on-tap.pdf', declaredMimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.7\nTài liệu ôn tập an toàn') },
    ) as { id: string };

    const result = await processNextResourceScan({
      repository: new PostgresResourceScanJobRepository(controlPool),
      storage,
      scanner: new ClamAvScanner(storage, { host: process.env.CLAMAV_HOST ?? '127.0.0.1', port: Number(process.env.CLAMAV_PORT ?? 3310) }),
    });
    expect(result).toEqual({ outcome: 'READY', resourceId: uploaded.id });
    const persisted = await controlPool.query<{ status: string; object_key: string }>('SELECT status::text, object_key FROM resources WHERE id = $1', [uploaded.id]);
    expect(persisted.rows[0]).toEqual({ status: 'READY', object_key: `resources/${uploaded.id}` });
    await expect(storage.signedReadyDownload(persisted.rows[0]!.object_key, 60)).resolves.toContain('X-Amz-Signature');
  });
});
