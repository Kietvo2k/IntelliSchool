import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData, pilotAccounts } from '../src/seed-pilot.js';
import { createExamSnapshotKeyring } from '../src/security/exam-snapshot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });
const examSnapshotKeyring = createExamSnapshotKeyring('test-v1', { 'test-v1': Buffer.alloc(32, 91) });

describe('CBT exam periods and grading', () => {
  beforeAll(async () => {
    await resetAndSeedPilotData(controlPool);
    await new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring }).backfillExamSnapshots();
  }, 120_000);
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

    const repository = new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring });
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
    const repository = new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring });
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: pilotAccounts.student.email, displayName: seed.display_name, role: 'STUDENT' as const };
    const started = await repository.startExamSession(actor, { assignmentId: seed.assignment_id, studentCode: seed.student_code, pin: 'ExamPin2026!' }, 'exam-start-integration-1') as { sessionId: string };
    const submitted = await repository.submitExamSession(actor, started.sessionId, 'exam-submit-integration-1') as { gradingStatus: string; provisionalMaxScore: number; pendingCount: number };
    expect(submitted).toMatchObject({ gradingStatus: 'PROVISIONAL', pendingCount: 1 });
    expect(submitted.provisionalMaxScore).toBeGreaterThan(0);
    const grades = await repository.getMyGrades(actor) as Array<{ status: string; assignmentTitle: string }>;
    expect(grades).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'PROVISIONAL', assignmentTitle: 'Thi thử Hóa học trường' })]));
  });

  it('returns only the decrypted prompt projection to a student', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; display_name: string; student_code: string; assignment_id: string; email: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.display_name, sp.student_code, a.id AS assignment_id, u.email::text
      FROM users u
      JOIN school_memberships sm ON sm.user_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN assignments a ON a.school_id = sm.school_id
      WHERE u.email = $1 AND a.title = 'Thi thử Tiếng Anh trường' LIMIT 1
    `, [pilotAccounts.studentMai.email]);
    const seed = row.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring });
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: seed.email, displayName: seed.display_name, role: 'STUDENT' as const };
    const started = await repository.startExamSession(actor, { assignmentId: seed.assignment_id, studentCode: seed.student_code, pin: 'ExamPin2026!' }, 'exam-projection-start-1') as { sessionId: string };
    const session = await repository.getExamSession(actor, started.sessionId);
    const encoded = JSON.stringify(session);
    expect(encoded).not.toContain('answerKey');
    expect(encoded).not.toContain('rubric');
    expect(encoded).not.toContain('ciphertext');
    expect((session as { items: Array<{ prompt: unknown }> }).items.length).toBe(5);
    const signal = await repository.logExamIntegrity(actor, { sessionId: started.sessionId, kind: 'visibilitychange' }, 'exam-duplicate-signal-1') as { incidentId: string; counted: boolean; state: string };
    const duplicate = await repository.logExamIntegrity(actor, { sessionId: started.sessionId, kind: 'blur' }, 'exam-duplicate-signal-2') as { incidentId: string; counted: boolean; state: string };
    expect(signal).toMatchObject({ counted: true, state: 'GRACE' });
    expect(duplicate).toMatchObject({ counted: false, incidentId: signal.incidentId, state: 'GRACE' });
    await repository.restoreExamIncident(actor, started.sessionId, signal.incidentId, 'exam-duplicate-restore-1');
  });

  it('locks an incident at its server deadline without finalizing the exam', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; display_name: string; student_code: string; assignment_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.display_name, sp.student_code, a.id AS assignment_id
      FROM users u
      JOIN school_memberships sm ON sm.user_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN assignments a ON a.school_id = sm.school_id
      WHERE u.email = $1 AND a.title = 'Thi thử Toán trường' LIMIT 1
    `, [pilotAccounts.student.email]);
    const seed = row.rows[0]!;
    const repository = new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring });
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: pilotAccounts.student.email, displayName: seed.display_name, role: 'STUDENT' as const };
    const started = await repository.startExamSession(actor, { assignmentId: seed.assignment_id, studentCode: seed.student_code, pin: 'ExamPin2026!' }, 'exam-lock-start-integration-1') as { sessionId: string };
    await controlPool.query(`
      INSERT INTO exam_integrity_incidents (school_id, session_id, state, started_at, last_signal_at, grace_ends_at, lock_at)
      VALUES ($1, $2, 'WARNING', now() - interval '30 seconds', now() - interval '30 seconds', now() - interval '25 seconds', now())
    `, [seed.school_id, started.sessionId]);

    const locked = await repository.logExamIntegrity(actor, { sessionId: started.sessionId, kind: 'visibilitychange' }, 'exam-integrity-lock-1') as { state: string; lockedAt: string | null; incidentId: string };
    expect(locked).toMatchObject({ state: 'LOCKED', incidentId: expect.any(String) });
    expect(locked.lockedAt).toBeTruthy();
    const notSubmitted = await controlPool.query<{ submitted_at: Date | null; finalization_reason: string | null; lock_reason: string | null }>('SELECT submitted_at, finalization_reason, lock_reason FROM exam_sessions WHERE id = $1', [started.sessionId]);
    expect(notSubmitted.rows[0]).toEqual({ submitted_at: null, finalization_reason: null, lock_reason: 'INTEGRITY_INCIDENT' });

    const restored = await repository.restoreExamIncident(actor, started.sessionId, locked.incidentId, 'exam-integrity-restore-1') as { state: string };
    expect(restored.state).toBe('ACTIVE');
    const ownerRow = await controlPool.query<{ user_id: string; email: string; display_name: string }>('SELECT u.id AS user_id, u.email::text, u.display_name FROM users u JOIN school_memberships sm ON sm.user_id = u.id WHERE sm.school_id = $1 AND sm.role = \'SCHOOL_OWNER\' LIMIT 1', [seed.school_id]);
    const owner = ownerRow.rows[0]!;
    const unlocked = await repository.unlockExamSession({ userId: owner.user_id, schoolId: seed.school_id, email: owner.email, displayName: owner.display_name, role: 'SCHOOL_OWNER' }, started.sessionId, 'Đã xác minh sự cố và cho phép tiếp tục.', 'exam-integrity-unlock-1') as { state: string; unlocked: boolean };
    expect(unlocked).toMatchObject({ state: 'ACTIVE', unlocked: true, lockedAt: null });
    const stillNotSubmitted = await controlPool.query<{ submitted_at: Date | null }>('SELECT submitted_at FROM exam_sessions WHERE id = $1', [started.sessionId]);
    expect(stillNotSubmitted.rows[0]?.submitted_at).toBeNull();
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
    const repository = new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring });
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: pilotAccounts.student.email, displayName: seed.display_name, role: 'STUDENT' as const };
    const started = await repository.startExamSession(actor, { assignmentId: seed.assignment_id, studentCode: seed.student_code, pin: 'ExamPin2026!' }, 'exam-attachment-start-integration-1') as { sessionId: string };
    const grant = await repository.issueExamAttachmentExemption(actor, started.sessionId, 'exam-attachment-issue-1');
    expect(grant.token).toHaveLength(43);
    expect((await repository.consumeExamAttachmentExemption(actor, started.sessionId, grant.token, 'exam-attachment-upload-1')).authorized).toBe(true);
    expect((await repository.consumeExamAttachmentExemption(actor, started.sessionId, grant.token, 'exam-attachment-upload-2')).authorized).toBe(false);
  });

  it('fails closed when a snapshot key is missing or its authentication tag is invalid', async () => {
    const row = await controlPool.query<{ session_id: string; user_id: string; school_id: string; email: string; display_name: string; auth_tag: Buffer; snapshot_id: string }>(`
      SELECT es.id AS session_id, es.student_id AS user_id, es.school_id, u.email::text, u.display_name, snap.auth_tag, snap.id AS snapshot_id
      FROM exam_sessions es JOIN exam_snapshots snap ON snap.id = es.exam_snapshot_id JOIN users u ON u.id = es.student_id
      WHERE u.email = $1 LIMIT 1
    `, [pilotAccounts.studentMai.email]);
    const source = row.rows[0]!;
    const actor = { userId: source.user_id, schoolId: source.school_id, email: source.email, displayName: source.display_name, role: 'STUDENT' as const };
    const missingKey = new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring: createExamSnapshotKeyring('missing-v1', { 'missing-v1': Buffer.alloc(32, 93) }) });
    await expect(missingKey.getExamSession(actor, source.session_id)).rejects.toMatchObject({ code: 'EXAM_SNAPSHOT_UNAVAILABLE' });

    await controlPool.query("UPDATE exam_snapshots SET auth_tag = decode(repeat('00', 16), 'hex') WHERE id = $1", [source.snapshot_id]);
    await expect(new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring }).getExamSession(actor, source.session_id)).rejects.toMatchObject({ code: 'EXAM_SNAPSHOT_UNAVAILABLE' });
    await controlPool.query('UPDATE exam_snapshots SET auth_tag = $2 WHERE id = $1', [source.snapshot_id, source.auth_tag]);
  });

  it('keeps backfill idempotent and rotates an encrypted snapshot without plaintext storage', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring });
    expect(await repository.backfillExamSnapshots()).toBe(0);
    const row = await controlPool.query<{ id: string; school_id: string; owner_id: string; email: string; display_name: string; key_version: string; ciphertext: Buffer }>(`
      SELECT es.id, es.school_id, s.owner_id, u.email::text, u.display_name, es.key_version, es.ciphertext
      FROM exam_snapshots es JOIN assignments a ON a.id = es.assignment_id JOIN schools s ON s.id = es.school_id JOIN users u ON u.id = s.owner_id
      WHERE a.title = 'Thi thử Tiếng Anh trường' AND es.id = a.active_exam_snapshot_id
    `);
    const source = row.rows[0]!;
    expect(source.key_version).toBe('test-v1');
    expect(source.ciphertext.toString('utf8')).not.toContain('answerKey');

    const rotatingKeyring = createExamSnapshotKeyring('test-v2', { 'test-v1': Buffer.alloc(32, 91), 'test-v2': Buffer.alloc(32, 92) });
    const rotated = await new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring: rotatingKeyring }).rotateExamSnapshot(
      { userId: source.owner_id, schoolId: source.school_id, email: source.email, displayName: source.display_name, role: 'SCHOOL_OWNER' },
      (await controlPool.query<{ id: string }>(`SELECT id FROM assignments WHERE title = 'Thi thử Tiếng Anh trường' LIMIT 1`)).rows[0]!.id,
    ) as { rotated: boolean; keyVersion: string };
    expect(rotated).toMatchObject({ rotated: true, keyVersion: 'test-v2', id: expect.any(String) });
    const versions = await controlPool.query<{ key_version: string }>(`SELECT key_version FROM exam_snapshots WHERE assignment_id = (SELECT id FROM assignments WHERE title = 'Thi thử Tiếng Anh trường' LIMIT 1) ORDER BY encryption_revision`);
    expect(versions.rows.map((item) => item.key_version)).toEqual(['test-v1', 'test-v2']);
  });
});
