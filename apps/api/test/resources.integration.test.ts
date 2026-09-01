import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresResourceRepository } from '../src/repositories/postgres-resources.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('resource persistence', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('creates a quarantined resource, durable scan job, and audit event in its school', async () => {
    const actorRow = await controlPool.query<{ id: string; email: string; display_name: string; school_id: string; class_id: string; subject_id: string }>(`
      SELECT u.id, u.email::text, u.display_name, sm.school_id, c.id AS class_id, s.id AS subject_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id
      JOIN classes c ON c.school_id = sm.school_id JOIN subjects s ON s.school_id = sm.school_id
      WHERE sm.role = 'SCHOOL_OWNER' ORDER BY u.created_at LIMIT 1
    `);
    const actor = actorRow.rows[0]!;
    const repository = new PostgresResourceRepository(apiPool);
    const resource = await repository.createQuarantined(
      { userId: actor.id, email: actor.email, displayName: actor.display_name, role: 'SCHOOL_OWNER', schoolId: actor.school_id },
      { objectKey: 'quarantine/10000000-0000-4000-8000-000000000001', originalName: 'on-tap.pdf', mimeType: 'application/pdf', byteSize: 30, sha256: 'a'.repeat(64), classId: actor.class_id, subjectId: actor.subject_id },
    ) as { id: string; status: string };

    expect(resource.status).toBe('QUARANTINED');
    const jobs = await controlPool.query<{ status: string }>('SELECT status::text FROM resource_scan_jobs WHERE resource_id = $1', [resource.id]);
    expect(jobs.rows).toEqual([{ status: 'QUEUED' }]);
    const audit = await controlPool.query<{ action: string }>('SELECT action FROM audit_events WHERE target_id = $1', [resource.id]);
    expect(audit.rows).toEqual([{ action: 'RESOURCE_UPLOADED' }]);
  });
});
