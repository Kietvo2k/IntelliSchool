import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('question search pagination', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('returns a filtered paginated result without exposing answer keys', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; email: string; display_name: string; bank_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.email::text, u.display_name, qb.id AS bank_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id JOIN question_banks qb ON qb.school_id = sm.school_id
      WHERE u.email = 'hieutruong.nguyendu@smartpath.test' LIMIT 1
    `);
    const seed = row.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const searcher = repository as unknown as { listQuestions(actor: unknown, input: unknown): Promise<{ items: Array<Record<string, unknown>>; page: number; pageSize: number; totalItems: number; totalPages: number }>; };

    const result = await searcher.listQuestions(
      { userId: seed.user_id, schoolId: seed.school_id, email: seed.email, displayName: seed.display_name, role: 'SCHOOL_OWNER' },
      { bankId: seed.bank_id, page: 1, pageSize: 10, type: 'MULTIPLE_CHOICE', approval: 'APPROVED', query: 'x² là gì' },
    );

    expect(result).toMatchObject({ page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
    expect(result.items[0]).toMatchObject({ type: 'MULTIPLE_CHOICE', isApproved: true, prompt: { text: 'Đạo hàm của x² là gì?' } });
    expect(JSON.stringify(result)).not.toContain('answerKey');
  });
});
