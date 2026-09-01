import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';
import type { AuthContext } from '../src/types.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

interface SeedContext {
  schoolId: string;
  subjectId: string;
  teacher: AuthContext;
  owner: AuthContext;
  otherSchoolId: string;
}

async function loadSeed(): Promise<SeedContext> {
  const teacherRow = await controlPool.query<{ user_id: string; school_id: string; email: string; display_name: string; subject_id: string }>(`
    SELECT u.id AS user_id, sm.school_id, u.email::text, u.display_name,
      (SELECT cta.subject_id FROM class_teacher_assignments cta WHERE cta.teacher_id = u.id AND cta.role = 'SUBJECT_TEACHER' LIMIT 1) AS subject_id
    FROM users u JOIN school_memberships sm ON sm.user_id = u.id
    WHERE u.email = 'giaovien.toan@nguyendu.smartpath.test' LIMIT 1
  `);
  const ownerRow = await controlPool.query<{ user_id: string; school_id: string; email: string; display_name: string }>(`
    SELECT u.id AS user_id, sm.school_id, u.email::text, u.display_name
    FROM users u JOIN school_memberships sm ON sm.user_id = u.id
    WHERE u.email = 'hieutruong.nguyendu@smartpath.test' LIMIT 1
  `);
  const otherSchool = await controlPool.query<{ id: string }>("SELECT id FROM schools WHERE code = 'SP-PILOT002' LIMIT 1");
  const teacher = teacherRow.rows[0]!;
  const owner = ownerRow.rows[0]!;
  return {
    schoolId: teacher.school_id,
    subjectId: teacher.subject_id,
    teacher: { userId: teacher.user_id, schoolId: teacher.school_id, email: teacher.email, displayName: teacher.display_name, role: 'TEACHER' },
    owner: { userId: owner.user_id, schoolId: owner.school_id, email: owner.email, displayName: owner.display_name, role: 'SCHOOL_OWNER' },
    otherSchoolId: otherSchool.rows[0]!.id,
  };
}

const validDefinition = {
  skills: [
    { code: 'FRACTION_SIMPLIFY', name: 'Rút gọn phân số' },
    { code: 'FRACTION_ADD', name: 'Cộng phân số' },
    { code: 'RATIO', name: 'Tỉ lệ thức' },
  ],
  edges: [
    { prerequisite: 'FRACTION_SIMPLIFY', skill: 'FRACTION_ADD' },
    { prerequisite: 'FRACTION_ADD', skill: 'RATIO' },
  ],
};

describe('skill graph authoring', () => {
  let seed: SeedContext;
  beforeAll(async () => { await resetAndSeedPilotData(controlPool); seed = await loadSeed(); });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('rejects a cyclic graph and keeps four-eyes approval', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });

    await expect(repository.createSkillGraph(seed.teacher, {
      subjectId: seed.subjectId, title: 'Đồ thị vòng lặp',
      definition: { skills: [{ code: 'A', name: 'A' }, { code: 'B', name: 'B' }], edges: [{ prerequisite: 'A', skill: 'B' }, { prerequisite: 'B', skill: 'A' }] },
    }, 'skill-graph-cyclic-1')).rejects.toMatchObject({ code: 'SKILL_GRAPH_INVALID' });

    const created = await repository.createSkillGraph(seed.teacher, { subjectId: seed.subjectId, title: 'Phân số đến tỉ lệ', definition: validDefinition }, 'skill-graph-create-1') as { id: string; status: string };
    expect(created.status).toBe('DRAFT');

    await repository.submitSkillGraphForReview(seed.teacher, created.id, 'skill-graph-submit-1');

    // Người soạn không được tự duyệt.
    await expect(repository.reviewSkillGraph(seed.teacher, created.id, { decision: 'APPROVED' }, 'skill-graph-self-approve-1')).rejects.toMatchObject({ statusCode: 403 });

    // Hiệu trưởng (người khác) duyệt được.
    const approved = await repository.reviewSkillGraph(seed.owner, created.id, { decision: 'APPROVED' }, 'skill-graph-approve-1') as { status: string };
    expect(approved.status).toBe('APPROVED');

    const stored = await controlPool.query<{ status: string; approved_by: string | null }>('SELECT status, approved_by FROM skill_graphs WHERE id = $1', [created.id]);
    expect(stored.rows[0]!.status).toBe('APPROVED');
    expect(stored.rows[0]!.approved_by).toBe(seed.owner.userId);
  });

  it('does not expose one school\'s skill graphs to another school', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const created = await repository.createSkillGraph(seed.teacher, { subjectId: seed.subjectId, title: 'Riêng trường A', definition: validDefinition }, 'skill-graph-isolated-1') as { id: string };
    const foreignOwner: AuthContext = { ...seed.owner, schoolId: seed.otherSchoolId };
    await expect(repository.getSkillGraph(foreignOwner, created.id)).rejects.toMatchObject({ statusCode: 404 });
  });
});
