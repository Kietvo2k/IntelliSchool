import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';
import type { AuthContext } from '../src/types.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

interface Ctx {
  schoolId: string;
  subjectId: string;
  classId: string;
  teacher: AuthContext;
  owner: AuthContext;
  student: AuthContext;
}

async function loadCtx(): Promise<Ctx> {
  const row = await controlPool.query<{
    school_id: string; subject_id: string; class_id: string;
    teacher_id: string; teacher_email: string; teacher_name: string;
    owner_id: string; owner_email: string; owner_name: string;
    student_id: string; student_email: string; student_name: string;
  }>(`
    SELECT sm.school_id,
      (SELECT cta.subject_id FROM class_teacher_assignments cta WHERE cta.teacher_id = t.id AND cta.role = 'SUBJECT_TEACHER' LIMIT 1) AS subject_id,
      (SELECT cta.class_id FROM class_teacher_assignments cta WHERE cta.teacher_id = t.id AND cta.role = 'SUBJECT_TEACHER' LIMIT 1) AS class_id,
      t.id AS teacher_id, t.email::text AS teacher_email, t.display_name AS teacher_name,
      o.id AS owner_id, o.email::text AS owner_email, o.display_name AS owner_name,
      s.id AS student_id, s.email::text AS student_email, s.display_name AS student_name
    FROM users t
    JOIN school_memberships sm ON sm.user_id = t.id
    JOIN users o ON o.email = 'hieutruong.nguyendu@smartpath.test'
    JOIN users s ON s.email = 'hocsinh.minh@nguyendu.smartpath.test'
    WHERE t.email = 'giaovien.toan@nguyendu.smartpath.test' LIMIT 1
  `);
  const r = row.rows[0]!;
  return {
    schoolId: r.school_id, subjectId: r.subject_id, classId: r.class_id,
    teacher: { userId: r.teacher_id, schoolId: r.school_id, email: r.teacher_email, displayName: r.teacher_name, role: 'TEACHER' },
    owner: { userId: r.owner_id, schoolId: r.school_id, email: r.owner_email, displayName: r.owner_name, role: 'SCHOOL_OWNER' },
    student: { userId: r.student_id, schoolId: r.school_id, email: r.student_email, displayName: r.student_name, role: 'STUDENT' },
  };
}

describe('adaptive diagnosis end to end', () => {
  let ctx: Ctx;
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); ctx = await loadCtx(); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('only produces an actionable diagnosis after the graph is approved and evidence accumulates', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });

    const graph = await repository.createSkillGraph(ctx.teacher, {
      subjectId: ctx.subjectId, title: 'Đạo hàm cơ bản',
      definition: { skills: [{ code: 'LIMIT', name: 'Giới hạn' }, { code: 'DERIV', name: 'Đạo hàm' }], edges: [{ prerequisite: 'LIMIT', skill: 'DERIV' }] },
    }, 'adaptive-graph-create') as { id: string };

    // Trước khi duyệt: học sinh chưa có chẩn đoán actionable.
    const before = await repository.getMyAdaptivePlan(ctx.student) as { plans: unknown[] };
    expect(before.plans).toEqual([]);

    // Gán câu hỏi vào kỹ năng LIMIT (dùng một question version có sẵn trong seed cùng môn).
    const questionVersion = await controlPool.query<{ id: string }>(`
      SELECT qv.id FROM question_versions qv JOIN questions q ON q.id = qv.question_id
      JOIN question_banks qb ON qb.id = q.bank_id WHERE qb.subject_id = $1 LIMIT 1
    `, [ctx.subjectId]);
    if (questionVersion.rows[0]) {
      await repository.mapSkillItems(ctx.teacher, graph.id, { questionVersionId: questionVersion.rows[0].id, skills: [{ skillCode: 'LIMIT', weight: 1 }] }, 'adaptive-map-1');
    }

    await repository.submitSkillGraphForReview(ctx.teacher, graph.id, 'adaptive-submit');
    await repository.reviewSkillGraph(ctx.owner, graph.id, { decision: 'APPROVED' }, 'adaptive-approve');

    // Ghi hai sự kiện sai cho kỹ năng LIMIT của học sinh (mô phỏng bài làm đã chấm).
    for (let i = 0; i < 2; i += 1) {
      await controlPool.query(`
        INSERT INTO learning_events (school_id, student_id, class_id, subject_id, event_key, kind, payload, occurred_at)
        VALUES ($1, $2, $3, $4, $5, 'ASSIGNMENT_ANSWER', $6::jsonb, now())
        ON CONFLICT (student_id, event_key) DO NOTHING
      `, [ctx.schoolId, ctx.student.userId, ctx.classId, ctx.subjectId, `test-limit-${i}`, JSON.stringify({ skillCode: 'LIMIT', correct: false })]);
    }

    const diagnoses = await repository.getAdaptiveDiagnoses(ctx.teacher, { classId: ctx.classId, subjectId: ctx.subjectId }) as { graphApproved: boolean; groups: Array<{ skillCode: string }> };
    expect(diagnoses.graphApproved).toBe(true);
    expect(diagnoses.groups.some((group) => group.skillCode === 'LIMIT')).toBe(true);

    const plan = await repository.getMyAdaptivePlan(ctx.student) as { plans: Array<{ status: string; rootSkillCode: string | null }> };
    const subjectPlan = plan.plans.find((entry) => entry.rootSkillCode === 'LIMIT');
    expect(subjectPlan?.status).toBe('ACTIONABLE');

    // Giáo viên bác bỏ chẩn đoán -> lộ trình học sinh tôn trọng override.
    await repository.overrideAdaptiveDiagnosis(ctx.teacher, { studentId: ctx.student.userId, subjectId: ctx.subjectId, decision: 'DISMISS', reason: 'Đã kèm riêng, không cần ôn lại.' }, 'adaptive-dismiss');
    const afterOverride = await repository.getMyAdaptivePlan(ctx.student) as { plans: Array<{ status: string }> };
    expect(afterOverride.plans.some((entry) => entry.status === 'DISMISSED_BY_TEACHER')).toBe(true);
  });
});
