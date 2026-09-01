import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresReportExportJobRepository } from '../src/repositories/postgres-report-export-jobs.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const pool = new pg.Pool({ connectionString: controlUrl });

describe('report export jobs', () => {
  beforeAll(async () => { await resetAndSeedPilotData(pool); });
  afterAll(async () => { await pool.end(); });

  it('claims a queued job once and persists its private object reference only after success', async () => {
    const created = await pool.query<{ id: string }>(`
      INSERT INTO report_exports (school_id, requested_by, kind, format, filters, idempotency_key)
      SELECT sm.school_id, sm.user_id, 'GRADEBOOK', 'CSV', '{"classId":"00000000-0000-4000-8000-000000000001"}'::jsonb, 'export-job-20260725-001'
      FROM school_memberships sm WHERE sm.role = 'SCHOOL_OWNER' LIMIT 1 RETURNING id
    `);
    const repository = new PostgresReportExportJobRepository(pool);
    const job = await repository.claimNext();
    expect(job).toMatchObject({ id: created.rows[0]!.id, kind: 'GRADEBOOK', format: 'CSV' });
    await expect(repository.claimNext()).resolves.toBeNull();
    await repository.markReady(job!.id, 'reports/export.csv');
    const stored = await pool.query<{ status: string; object_key: string | null }>('SELECT status::text, object_key FROM report_exports WHERE id = $1', [job!.id]);
    expect(stored.rows).toEqual([{ status: 'READY', object_key: 'reports/export.csv' }]);
  });
});
