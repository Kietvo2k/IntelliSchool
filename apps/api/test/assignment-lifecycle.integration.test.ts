import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('assignment lifecycle', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('transitions an open assignment from PUBLISHED to CLOSED to ARCHIVED idempotently', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; email: string; display_name: string; assignment_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.email::text, u.display_name, a.id AS assignment_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id JOIN assignments a ON a.school_id = sm.school_id
      WHERE u.email = 'giaovien.toan@nguyendu.smartpath.test' AND a.status = 'PUBLISHED' LIMIT 1
    `);
    const seed = row.rows[0]!;
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: seed.email, displayName: seed.display_name, role: 'TEACHER' as const };
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const lifecycle = repository as unknown as { closeAssignment(actor: unknown, id: string, key: string): Promise<{ status: string }>; archiveAssignment(actor: unknown, id: string, key: string): Promise<{ status: string }>; };

    await expect(lifecycle.closeAssignment(actor, seed.assignment_id, 'assignment-close-20260725-001')).resolves.toEqual({ id: seed.assignment_id, status: 'CLOSED' });
    await expect(lifecycle.closeAssignment(actor, seed.assignment_id, 'assignment-close-20260725-002')).resolves.toEqual({ id: seed.assignment_id, status: 'CLOSED' });
    await expect(lifecycle.archiveAssignment(actor, seed.assignment_id, 'assignment-archive-20260725-001')).resolves.toEqual({ id: seed.assignment_id, status: 'ARCHIVED' });
  });

  it('shows a student their attempt allowance without exposing another learner data', async () => {
    const row = await controlPool.query<{ user_id: string; school_id: string; email: string; display_name: string; class_id: string; subject_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.email::text, u.display_name, ce.class_id, s.id AS subject_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id JOIN class_enrollments ce ON ce.student_id = u.id
      JOIN subjects s ON s.school_id = sm.school_id
      WHERE u.email = 'hocsinh.minh@nguyendu.smartpath.test' LIMIT 1
    `);
    const seed = row.rows[0]!;
    const actor = { userId: seed.user_id, schoolId: seed.school_id, email: seed.email, displayName: seed.display_name, role: 'STUDENT' as const };
    await controlPool.query(`INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, created_by, published_at) VALUES ($1, $2, $3, 'Luyện tập lượt làm', '', 'PUBLISHED', $4, now())`, [seed.school_id, seed.class_id, seed.subject_id, seed.user_id]);
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const assignments = await repository.listAssignments(actor, { classId: seed.class_id }) as Array<{ maxAttempts?: number; attemptsUsed?: number }>;

    expect(assignments.length).toBeGreaterThan(0);
    expect(assignments[0]).toMatchObject({ maxAttempts: 1, attemptsUsed: 0 });
  });

  it('only returns a fully graded attempt and records overall feedback for the learner', async () => {
    const row = await controlPool.query<{ teacher_id: string; student_id: string; school_id: string; email: string; display_name: string; assignment_id: string; item_id: string }>(`
      SELECT teacher.user_id AS teacher_id, ce.student_id, teacher.school_id,
             teacher.email::text, teacher.display_name, a.id AS assignment_id, ai.id AS item_id
      FROM (
        SELECT sm.user_id, sm.school_id, u.email, u.display_name FROM school_memberships sm JOIN users u ON u.id = sm.user_id
        WHERE u.email = 'giaovien.toan@nguyendu.smartpath.test' LIMIT 1
      ) teacher
      JOIN assignments a ON a.school_id = teacher.school_id
      JOIN assignment_items ai ON ai.assignment_id = a.id
      JOIN question_versions qv ON qv.id = ai.question_version_id AND qv.type = 'MULTIPLE_CHOICE'
      JOIN class_enrollments ce ON ce.class_id = a.class_id AND ce.status = 'ACTIVE'
      JOIN users student_user ON student_user.id = ce.student_id AND student_user.email = 'hocsinh.minh@nguyendu.smartpath.test'
      JOIN class_teacher_assignments cta ON cta.class_id = a.class_id AND cta.teacher_id = teacher.user_id
        AND (cta.role = 'HOMEROOM_TEACHER' OR cta.subject_id = a.subject_id)
      LIMIT 1
    `);
    const seed = row.rows[0]!;
    const inserted = await controlPool.query<{ id: string }>(`
      INSERT INTO assignment_attempts (school_id, assignment_id, student_id, status, attempt_number, idempotency_key, submitted_at, graded_at)
      VALUES ($1, $2, $3, 'GRADED', 1, 'returned-attempt-20260725-001', now(), now())
      RETURNING id
    `, [seed.school_id, seed.assignment_id, seed.student_id]);
    const attemptId = inserted.rows[0]!.id;
    await controlPool.query(`INSERT INTO submission_answers (school_id, attempt_id, assignment_item_id, answer, auto_score) VALUES ($1, $2, $3, '{}'::jsonb, 1)`, [seed.school_id, attemptId, seed.item_id]);
    const actor = { userId: seed.teacher_id, schoolId: seed.school_id, email: seed.email, displayName: seed.display_name, role: 'TEACHER' as const };
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });

    await expect(repository.returnAssignmentAttempt(actor, { attemptId, overallFeedback: 'Đã xem lại toàn bộ bài làm.' }, 'attempt-return-20260725-001')).resolves.toMatchObject({ status: 'RETURNED' });
    const returned = await controlPool.query<{ status: string; overall_feedback: string }>('SELECT status, overall_feedback FROM assignment_attempts WHERE id = $1', [attemptId]);
    expect(returned.rows[0]).toMatchObject({ status: 'RETURNED', overall_feedback: 'Đã xem lại toàn bộ bài làm.' });
  });

  it('replaces draft assignment content atomically and refuses non-draft edits', async () => {
    const row = await controlPool.query<{ teacher_id: string; school_id: string; email: string; display_name: string; class_id: string; subject_id: string; question_version_id: string }>(`
      SELECT u.id AS teacher_id, sm.school_id, u.email::text, u.display_name, a.class_id, a.subject_id, ai.question_version_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id
      JOIN assignments a ON a.school_id = sm.school_id
      JOIN assignment_items ai ON ai.assignment_id = a.id
      JOIN question_versions qv ON qv.id = ai.question_version_id AND qv.is_approved
      JOIN questions q ON q.id = qv.question_id
      JOIN question_banks qb ON qb.id = q.bank_id AND qb.subject_id = a.subject_id
      JOIN class_teacher_assignments cta ON cta.class_id = a.class_id AND cta.teacher_id = u.id
        AND (cta.role = 'HOMEROOM_TEACHER' OR cta.subject_id = a.subject_id)
      WHERE u.email = 'giaovien.toan@nguyendu.smartpath.test' LIMIT 1
    `);
    const seed = row.rows[0]!;
    const draft = await controlPool.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, created_by)
      VALUES ($1, $2, $3, 'Nháp cũ', '', 'DRAFT', $4) RETURNING id
    `, [seed.school_id, seed.class_id, seed.subject_id, seed.teacher_id]);
    const assignmentId = draft.rows[0]!.id;
    await controlPool.query(`INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 1)`, [seed.school_id, assignmentId, seed.question_version_id]);
    const actor = { userId: seed.teacher_id, schoolId: seed.school_id, email: seed.email, displayName: seed.display_name, role: 'TEACHER' as const };
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });

    await expect(repository.updateAssignment(actor, assignmentId, { classId: seed.class_id, subjectId: seed.subject_id, title: 'Nháp mới', instructions: 'Đọc kỹ đề bài.', dueAt: null, maxAttempts: 2, gradingPolicy: 'LATEST', items: [{ questionVersionId: seed.question_version_id, position: 1, points: 2 }] }, 'assignment-update-20260725-001')).resolves.toMatchObject({ id: assignmentId, status: 'DRAFT', title: 'Nháp mới', maxAttempts: 2, gradingPolicy: 'LATEST' });
    const updated = await controlPool.query<{ title: string; max_attempts: number; grading_policy: string; points: string }>(`
      SELECT a.title, a.max_attempts, a.grading_policy::text, ai.points::text
      FROM assignments a JOIN assignment_items ai ON ai.assignment_id = a.id WHERE a.id = $1
    `, [assignmentId]);
    expect(updated.rows[0]).toMatchObject({ title: 'Nháp mới', max_attempts: 2, grading_policy: 'LATEST', points: '2.00' });
    await controlPool.query(`UPDATE assignments SET status = 'PUBLISHED' WHERE id = $1`, [assignmentId]);
    await expect(repository.updateAssignment(actor, assignmentId, { classId: seed.class_id, subjectId: seed.subject_id, title: 'Không được sửa', instructions: '', dueAt: null, maxAttempts: 1, gradingPolicy: 'HIGHEST', items: [{ questionVersionId: seed.question_version_id, position: 1, points: 1 }] }, 'assignment-update-20260725-002')).rejects.toMatchObject({ code: 'ASSIGNMENT_NOT_DRAFT' });
  });
});
