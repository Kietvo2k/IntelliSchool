import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.js';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('lesson lifecycle', () => {
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('allows a teacher to edit only a draft, then publish and archive it', async () => {
    const seed = await controlPool.query<{ user_id: string; school_id: string; email: string; display_name: string; class_id: string; subject_id: string }>(`
      SELECT u.id AS user_id, sm.school_id, u.email::text, u.display_name, cta.class_id, cta.subject_id
      FROM users u JOIN school_memberships sm ON sm.user_id = u.id JOIN class_teacher_assignments cta ON cta.teacher_id = u.id
      WHERE u.email = 'giaovien.toan@nguyendu.smartpath.test' LIMIT 1
    `);
    const actor = seed.rows[0]!;
    const context = { userId: actor.user_id, schoolId: actor.school_id, email: actor.email, displayName: actor.display_name, role: 'TEACHER' as const };
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const lifecycle = repository as unknown as {
      updateLesson(actor: unknown, lessonId: string, input: unknown, key: string): Promise<{ id: string; status: string; title: string }>;
      publishLesson(actor: unknown, lessonId: string, key: string): Promise<{ id: string; status: string }>;
      archiveLesson(actor: unknown, lessonId: string, key: string): Promise<{ id: string; status: string }>;
    };
    const created = await repository.createLesson(context, { classId: actor.class_id, subjectId: actor.subject_id, title: 'Bản nháp ôn tập', content: { blocks: [{ type: 'paragraph', text: 'Bản đầu tiên' }] }, publish: false }, 'lesson-lifecycle-create-001') as { id: string };

    await expect(lifecycle.updateLesson(context, created.id, { title: 'Bản nháp đã sửa', content: { blocks: [{ type: 'heading', text: 'Đạo hàm', level: 2 }] } }, 'lesson-lifecycle-update-001')).resolves.toMatchObject({ id: created.id, status: 'DRAFT', title: 'Bản nháp đã sửa' });
    await expect(lifecycle.publishLesson(context, created.id, 'lesson-lifecycle-publish-001')).resolves.toMatchObject({ id: created.id, status: 'PUBLISHED' });
    await expect(lifecycle.updateLesson(context, created.id, { title: 'Không được sửa', content: { blocks: [] } }, 'lesson-lifecycle-update-002')).rejects.toMatchObject<AppError>({ code: 'LESSON_NOT_DRAFT' });
    await expect(lifecycle.archiveLesson(context, created.id, 'lesson-lifecycle-archive-001')).resolves.toMatchObject({ id: created.id, status: 'ARCHIVED' });
  });

  it('lets an enrolled student mark progress without Postgres enum parameter conflicts', async () => {
    const seed = await controlPool.query<{
      teacher_id: string; student_id: string; school_id: string; teacher_email: string; teacher_name: string;
      student_email: string; student_name: string; class_id: string; subject_id: string;
    }>(`
      SELECT teacher.id AS teacher_id, student.id AS student_id, sm.school_id,
             teacher.email::text AS teacher_email, teacher.display_name AS teacher_name,
             student.email::text AS student_email, student.display_name AS student_name,
             cta.class_id, cta.subject_id
      FROM users teacher
      JOIN school_memberships sm ON sm.user_id = teacher.id
      JOIN class_teacher_assignments cta ON cta.teacher_id = teacher.id
      JOIN class_enrollments ce ON ce.class_id = cta.class_id AND ce.status = 'ACTIVE'
      JOIN users student ON student.id = ce.student_id
      WHERE teacher.email = 'giaovien.toan@nguyendu.smartpath.test'
        AND student.email = 'hocsinh.minh@nguyendu.smartpath.test'
      LIMIT 1
    `);
    const row = seed.rows[0]!;
    const teacher = { userId: row.teacher_id, schoolId: row.school_id, email: row.teacher_email, displayName: row.teacher_name, role: 'TEACHER' as const };
    const student = { userId: row.student_id, schoolId: row.school_id, email: row.student_email, displayName: row.student_name, role: 'STUDENT' as const };
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const created = await repository.createLesson(teacher, {
      classId: row.class_id, subjectId: row.subject_id, title: 'Tien do bai giang',
      content: { blocks: [{ type: 'paragraph', text: 'Noi dung ngan' }] }, publish: true,
    }, 'lesson-progress-create-001') as { id: string };
    await expect(repository.setLessonProgress(student, created.id, { status: 'IN_PROGRESS' }, 'lesson-progress-start-001')).resolves.toMatchObject({ lessonId: created.id, status: 'IN_PROGRESS' });
    await expect(repository.setLessonProgress(student, created.id, { status: 'COMPLETED' }, 'lesson-progress-complete-001')).resolves.toMatchObject({ lessonId: created.id, status: 'COMPLETED' });
  });
});
