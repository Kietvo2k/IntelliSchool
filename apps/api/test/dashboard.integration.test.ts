import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('role dashboards', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); }, 30_000);
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('returns the LMS-operational metric set for every pilot role', async () => {
    const users = await controlPool.query<{ id: string; school_id: string | null; email: string; display_name: string; role: 'PLATFORM_ADMIN' | 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT' }>(`
      SELECT u.id, sm.school_id, u.email::text, u.display_name,
        CASE WHEN pa.user_id IS NOT NULL THEN 'PLATFORM_ADMIN' ELSE sm.role::text END AS role
      FROM users u
      LEFT JOIN platform_admins pa ON pa.user_id = u.id
      LEFT JOIN school_memberships sm ON sm.user_id = u.id
      WHERE u.email IN ('admin@smartpath.test', 'hieutruong@nguyendu.smartpath.test', 'giaovien.toan@nguyendu.smartpath.test', 'hocsinh.minh@nguyendu.smartpath.test')
    `);
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const expected: Record<string, string[]> = {
      PLATFORM_ADMIN: ['schools', 'active-users', 'pending', 'audits'],
      SCHOOL_OWNER: ['classes', 'teachers', 'students', 'completion', 'average-score', 'needs-support'],
      TEACHER: ['classes', 'learners', 'essays', 'late', 'completion'],
      STUDENT: ['assignments', 'late', 'lessons', 'average'],
    };

    for (const user of users.rows) {
      const dashboard = await repository.getDashboard({ userId: user.id, schoolId: user.school_id ?? undefined, email: user.email, displayName: user.display_name, role: user.role }) as { metrics: Array<{ id: string }> };
      expect(dashboard.metrics.map((metric) => metric.id)).toEqual(expected[user.role]);
      expect(Array.isArray((dashboard as { highlights: unknown[] }).highlights)).toBe(true);
    }
  });
});
