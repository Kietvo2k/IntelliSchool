import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData, pilotAccounts } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('CBT exam periods and grading', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); }, 120_000);
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('keeps the chemistry pilot exam scoped to chemistry and labels its period', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; display_name: string; assignment_id: string; item_count: string; subject_code: string; exam_period: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.display_name, a.id AS assignment_id,
             count(ai.id)::text AS item_count, sub.code AS subject_code, a.exam_period
      FROM users u
      JOIN school_memberships sm ON sm.user_id = u.id
      JOIN assignments a ON a.school_id = sm.school_id
      JOIN subjects sub ON sub.id = a.subject_id
      LEFT JOIN assignment_items ai ON ai.assignment_id = a.id
      WHERE u.email = $1 AND a.title = 'Thi thử Hóa học trường'
      GROUP BY u.id, sm.school_id, u.display_name, a.id, sub.code, a.exam_period
    `, [pilotAccounts.student.email]);
    const seed = row.rows[0]!;
    expect(seed.subject_code).toBe('CHEM');
    expect(seed.exam_period).toBe('MOCK_GRADUATION');
    expect(Number(seed.item_count)).toBe(5);

    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: pilotAccounts.student.email, displayName: seed.display_name, role: 'STUDENT' as const };
    const lobby = await repository.listOpenExams(actor) as { exams: Array<{ title: string; subjectCode: string; examPeriod: string }> };
    const chemistry = lobby.exams.find((exam) => exam.title === 'Thi thử Hóa học trường');
    expect(chemistry).toMatchObject({ subjectCode: 'CHEM', examPeriod: 'MOCK_GRADUATION' });
  });

  it('returns a provisional objective score for an essay exam and exposes it in the grade list', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; display_name: string; student_code: string; assignment_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.display_name, sp.student_code, a.id AS assignment_id
      FROM users u
      JOIN school_memberships sm ON sm.user_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN assignments a ON a.school_id = sm.school_id
      WHERE u.email = $1 AND a.title = 'Thi thử Hóa học trường' LIMIT 1
    `, [pilotAccounts.student.email]);
    const seed = row.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: pilotAccounts.student.email, displayName: seed.display_name, role: 'STUDENT' as const };
    const started = await repository.startExamSession(actor, { assignmentId: seed.assignment_id, studentCode: seed.student_code, pin: 'ExamPin2026!' }, 'exam-start-integration-1') as { sessionId: string };
    const submitted = await repository.submitExamSession(actor, started.sessionId, 'exam-submit-integration-1') as { gradingStatus: string; provisionalMaxScore: number; pendingCount: number };
    expect(submitted).toMatchObject({ gradingStatus: 'PROVISIONAL', pendingCount: 1 });
    expect(submitted.provisionalMaxScore).toBeGreaterThan(0);
    const grades = await repository.getMyGrades(actor) as Array<{ status: string; assignmentTitle: string }>;
    expect(grades).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'PROVISIONAL', assignmentTitle: 'Thi thử Hóa học trường' })]));
  });

  it('only locks and finalizes an exam after the third confirmed integrity strike', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; display_name: string; student_code: string; assignment_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.display_name, sp.student_code, a.id AS assignment_id
      FROM users u
      JOIN school_memberships sm ON sm.user_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN assignments a ON a.school_id = sm.school_id
      WHERE u.email = $1 AND a.title = 'Thi thử Toán trường' LIMIT 1
    `, [pilotAccounts.student.email]);
    const seed = row.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: pilotAccounts.student.email, displayName: seed.display_name, role: 'STUDENT' as const };
    const started = await repository.startExamSession(actor, { assignmentId: seed.assignment_id, studentCode: seed.student_code, pin: 'ExamPin2026!' }, 'exam-lock-start-integration-1') as { sessionId: string };
    await controlPool.query(`
      INSERT INTO exam_integrity_events (school_id, session_id, kind, occurred_at, payload)
      VALUES ($1, $2, 'visibilitychange', now() - interval '8 seconds', '{}'::jsonb),
             ($1, $2, 'visibilitychange', now() - interval '4 seconds', '{}'::jsonb),
             ($1, $2, 'blur', now() - interval '2 seconds', '{}'::jsonb)
    `, [seed.school_id, started.sessionId]);

    const locked = await repository.logExamIntegrity(actor, { sessionId: started.sessionId, kind: 'visibilitychange' }) as { strikeCount: number; warningsRemaining: number; locked: boolean };
    expect(locked).toEqual(expect.objectContaining({ strikeCount: 3, warningsRemaining: 0, locked: true }));
    const submitted = await repository.submitExamSession(actor, started.sessionId, 'exam-lock-submit-integration-1') as { locked: boolean };
    expect(submitted.locked).toBe(true);
    const final = await controlPool.query<{ submitted_at: Date | null; finalization_reason: string | null }>('SELECT submitted_at, finalization_reason FROM exam_sessions WHERE id = $1', [started.sessionId]);
    expect(final.rows[0]).toMatchObject({ finalization_reason: 'INTEGRITY_LOCK' });
    expect(final.rows[0]?.submitted_at).toBeInstanceOf(Date);
  });

  it('requires a server-issued, short-lived token for an essay attachment grant', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; display_name: string; student_code: string; assignment_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.display_name, sp.student_code, a.id AS assignment_id
      FROM users u
      JOIN school_memberships sm ON sm.user_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN assignments a ON a.school_id = sm.school_id
      WHERE u.email = $1 AND a.title = 'Thi thử Ngữ văn trường' LIMIT 1
    `, [pilotAccounts.student.email]);
    const seed = row.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: pilotAccounts.student.email, displayName: seed.display_name, role: 'STUDENT' as const };
    const started = await repository.startExamSession(actor, { assignmentId: seed.assignment_id, studentCode: seed.student_code, pin: 'ExamPin2026!' }, 'exam-attachment-start-integration-1') as { sessionId: string };
    const grant = await repository.issueExamAttachmentExemption(actor, started.sessionId);
    expect(grant.token).toHaveLength(43);
    expect((await repository.consumeExamAttachmentExemption(actor, started.sessionId, grant.token, 'exam-attachment-upload-1')).authorized).toBe(true);
    expect((await repository.consumeExamAttachmentExemption(actor, started.sessionId, grant.token, 'exam-attachment-upload-2')).authorized).toBe(false);
  });
});
