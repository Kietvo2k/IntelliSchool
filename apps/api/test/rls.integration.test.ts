import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../src/db.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });
let schoolOneId = '';
let schoolTwoId = '';
let schoolTwoMemberId = '';

describe('PostgreSQL tenant isolation', () => {
  beforeAll(async () => {
    await resetAndSeedPilotData(controlPool);
    const schools = await controlPool.query<{ id: string; code: string }>(`SELECT id, code FROM schools WHERE code IN ('SP-PILOT001', 'SP-PILOT002') ORDER BY code`);
    schoolOneId = schools.rows[0]!.id;
    schoolTwoId = schools.rows[1]!.id;
    const schoolTwoMember = await controlPool.query<{ user_id: string }>('SELECT user_id FROM school_memberships WHERE school_id = $1 ORDER BY user_id LIMIT 1', [schoolTwoId]);
    schoolTwoMemberId = schoolTwoMember.rows[0]!.user_id;
  });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('exposes only the active school rows to the application role', async () => {
    const classRows = await withTenantTransaction(apiPool, { schoolId: schoolOneId }, async (client) => {
      await client.query("SELECT set_config('app.platform_admin', 'true', true)");
      return client.query<{ school_id: string }>('SELECT school_id FROM classes ORDER BY school_id');
    });
    expect(classRows.rows).toEqual([{ school_id: schoolOneId }]);
    expect(classRows.rows.map((row) => row.school_id)).not.toContain(schoolTwoId);
  });

  it('limits the tenant directory to members of the active school', async () => {
    const userRows = await withTenantTransaction(apiPool, { schoolId: schoolOneId }, async (client) => client.query<{ id: string }>('SELECT id FROM users ORDER BY id'));
    expect(userRows.rows.length).toBeGreaterThan(0);
    expect(userRows.rows.map((row) => row.id)).not.toContain(schoolTwoMemberId);
  });
});
