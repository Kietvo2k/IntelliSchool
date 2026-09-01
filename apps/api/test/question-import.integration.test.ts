import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('question import transaction', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('creates every imported question as unapproved in one transaction', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; email: string; display_name: string; bank_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.email::text, u.display_name, qb.id AS bank_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id JOIN question_banks qb ON qb.school_id = sm.school_id
      WHERE u.email = 'giaovien.toan@nguyendu.smartpath.test' LIMIT 1
    `);
    const seed = row.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const importer = repository as unknown as { importQuestions(actor: unknown, bankId: string, rows: unknown[], key: string): Promise<{ importedCount: number; questionIds: string[] }>; };

    const result = await importer.importQuestions(
      { userId: seed.user_id, schoolId: seed.school_id, email: seed.email, displayName: seed.display_name, role: 'TEACHER' },
      seed.bank_id,
      [
        { type: 'TRUE_FALSE', prompt: { statements: [{ key: 'a', text: 'Một là số lẻ.' }, { key: 'b', text: 'Hai là số lẻ.' }, { key: 'c', text: 'Ba là số nguyên tố.' }, { key: 'd', text: 'Bốn là số nguyên tố.' }] }, answerKey: { values: { a: true, b: false, c: true, d: false } }, rubric: {}, maxScore: 1 },
        { type: 'SHORT_ANSWER', prompt: { text: 'Thủ đô Việt Nam?' }, answerKey: { acceptable: ['Hà Nội'] }, rubric: {}, maxScore: 1 },
      ],
      'question-import-20260725-001',
    );

    expect(result).toMatchObject({ importedCount: 2, questionIds: expect.arrayContaining([expect.any(String)]) });
    const persisted = await controlPool.query<{ count: string }>('SELECT count(*)::text AS count FROM question_versions WHERE question_id = ANY($1::uuid[]) AND is_approved = false', [result.questionIds]);
    expect(persisted.rows[0]).toEqual({ count: '2' });
  });
});
