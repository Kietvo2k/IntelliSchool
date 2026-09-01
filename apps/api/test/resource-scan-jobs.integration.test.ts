import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresResourceScanJobRepository } from '../src/repositories/postgres-resource-scan-jobs.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });

describe('resource scan jobs', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
  afterAll(async () => { await controlPool.end(); });

  it('claims a quarantined job and makes only the promoted object READY', async () => {
    const seed = await controlPool.query<{ school_id: string; user_id: string }>(`SELECT school_id, user_id FROM school_memberships WHERE role = 'SCHOOL_OWNER' LIMIT 1`);
    const { school_id: schoolId, user_id: userId } = seed.rows[0]!;
    const resource = await controlPool.query<{ id: string }>(`
      INSERT INTO resources (school_id, object_key, original_name, mime_type, byte_size, sha256, status, uploaded_by)
      VALUES ($1, 'quarantine/scan-ready', 'scan.pdf', 'application/pdf', 10, repeat('b', 64), 'QUARANTINED', $2) RETURNING id
    `, [schoolId, userId]);
    await controlPool.query('INSERT INTO resource_scan_jobs (school_id, resource_id) VALUES ($1, $2)', [schoolId, resource.rows[0]!.id]);
    const repository = new PostgresResourceScanJobRepository(controlPool);

    const claimed = await repository.claimNext();
    expect(claimed).toMatchObject({ resourceId: resource.rows[0]!.id, quarantineObjectKey: 'quarantine/scan-ready', readyObjectKey: `resources/${resource.rows[0]!.id}` });
    await repository.markReady(claimed!);

    const state = await controlPool.query<{ status: string; object_key: string; job_status: string }>(`
      SELECT r.status::text, r.object_key, j.status::text AS job_status FROM resources r JOIN resource_scan_jobs j ON j.resource_id = r.id WHERE r.id = $1
    `, [resource.rows[0]!.id]);
    expect(state.rows).toEqual([{ status: 'READY', object_key: `resources/${resource.rows[0]!.id}`, job_status: 'READY' }]);
  });
});
