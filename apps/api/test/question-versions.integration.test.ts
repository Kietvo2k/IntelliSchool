import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('question versions', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('creates an unapproved new version without changing the version pinned by an old assignment', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; email: string; display_name: string; question_id: string; old_version_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.email::text, u.display_name, q.id AS question_id, qv.id AS old_version_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id
      JOIN questions q ON q.school_id = sm.school_id JOIN question_versions qv ON qv.question_id = q.id AND qv.version = 1
      WHERE u.email = 'giaovien.toan@nguyendu.smartpath.test' LIMIT 1
    `);
    const seed = row.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const updater = repository as unknown as { updateQuestion(actor: unknown, questionId: string, input: unknown, key: string): Promise<{ versionId: string; version: number; isApproved: boolean }>; };

    const updated = await updater.updateQuestion(
      { userId: seed.user_id, schoolId: seed.school_id, email: seed.email, displayName: seed.display_name, role: 'TEACHER' },
      seed.question_id,
      { type: 'MULTIPLE_CHOICE', prompt: { text: 'Đạo hàm của x³ là gì?', choices: ['x²', '3x²'] }, answerKey: { choice: '3x²' }, rubric: {}, maxScore: 2 },
      'question-version-update-20260725-001',
    );

    expect(updated).toMatchObject({ version: 2, isApproved: false });
    const versions = await controlPool.query<{ version: number; is_approved: boolean }>('SELECT version, is_approved FROM question_versions WHERE question_id = $1 ORDER BY version', [seed.question_id]);
    expect(versions.rows).toEqual([{ version: 1, is_approved: true }, { version: 2, is_approved: false }]);
    const pinned = await controlPool.query<{ question_version_id: string }>('SELECT question_version_id FROM assignment_items LIMIT 1');
    expect(pinned.rows[0]).toEqual({ question_version_id: seed.old_version_id });
  });
});
