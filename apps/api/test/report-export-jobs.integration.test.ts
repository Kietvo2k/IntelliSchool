import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresReportExportJobRepository } from '../src/repositories/postgres-report-export-jobs.js';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const pool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass' });

describe('report export jobs', () => {
  beforeAll(async () => { await resetAndSeedPilotData(pool); });
  afterAll(async () => { await Promise.all([pool.end(), apiPool.end()]); });

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

  it('replays an export request only for the same payload hash', async () => {
    const actorRow = await pool.query<{ id: string; email: string; display_name: string; school_id: string; class_id: string }>(`
      SELECT u.id, u.email::text, u.display_name, sm.school_id, c.id AS class_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id JOIN classes c ON c.school_id = sm.school_id
      WHERE sm.role = 'SCHOOL_OWNER' ORDER BY u.created_at LIMIT 1
    `);
    const actor = actorRow.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool: pool });
    const input = { kind: 'PROGRESS' as const, format: 'CSV' as const, classId: actor.class_id };
    const first = await repository.requestReportExport({ userId: actor.id, schoolId: actor.school_id, email: actor.email, displayName: actor.display_name, role: 'SCHOOL_OWNER' }, input, 'report-db-replay-1') as { id: string };
    const replay = await repository.requestReportExport({ userId: actor.id, schoolId: actor.school_id, email: actor.email, displayName: actor.display_name, role: 'SCHOOL_OWNER' }, input, 'report-db-replay-1') as { id: string };
    expect(replay.id).toBe(first.id);
    await expect(repository.requestReportExport({ userId: actor.id, schoolId: actor.school_id, email: actor.email, displayName: actor.display_name, role: 'SCHOOL_OWNER' }, { ...input, format: 'XLSX' }, 'report-db-replay-1')).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    const audit = await pool.query<{ total: string }>("SELECT count(*)::text AS total FROM audit_events WHERE target_id = $1 AND action = 'REPORT_EXPORT_QUEUED'", [first.id]);
    expect(audit.rows[0]?.total).toBe('1');
  });
});
