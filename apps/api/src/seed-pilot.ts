import pg from 'pg';
import { hashPassword } from './security/passwords.js';

export const pilotAccounts = {
  platformAdmin: { email: 'admin@smartpath.test', password: 'TestOnlyPassword!2026' },
  schoolOneOwner: { email: 'hieutruong.nguyendu@smartpath.test', password: 'TestOnlyPassword!2026' },
  schoolTwoOwner: { email: 'hieutruong.lequydon@smartpath.test', password: 'TestOnlyPassword!2026' },
  teacher: { email: 'giaovien.toan@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
  student: { email: 'hocsinh.minh@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
} as const;

interface SeedUser { id: string; }

async function truncateAllTables(client: pg.PoolClient): Promise<void> {
  const tables = await client.query<{ tablename: string }>(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const identifiers = tables.rows.map((row) => `"${row.tablename.replaceAll('"', '""')}"`).join(', ');
  if (identifiers) await client.query(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`);
}

async function insertUser(client: pg.PoolClient, email: string, displayName: string): Promise<SeedUser> {
  const passwordHash = await hashPassword('TestOnlyPassword!2026');
  const result = await client.query<SeedUser>(`
    INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id
  `, [email, displayName]);
  const user = result.rows[0]!;
  await client.query(`
    INSERT INTO password_credentials (user_id, password_hash, must_change_password)
    VALUES ($1, $2, true)
  `, [user.id, passwordHash]);
  return user;
}

export async function resetAndSeedPilotData(pool: pg.Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Pilot seed data is disabled in production.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await truncateAllTables(client);

    const admin = await insertUser(client, pilotAccounts.platformAdmin.email, 'Platform Admin');
    await client.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [admin.id]);
    const ownerOne = await insertUser(client, pilotAccounts.schoolOneOwner.email, 'Nguyễn Thị Lan');
    const ownerTwo = await insertUser(client, pilotAccounts.schoolTwoOwner.email, 'Trần Minh Đức');
    const teacherMath = await insertUser(client, pilotAccounts.teacher.email, 'Cô Lê Thu Hà');
    const teacherHomeroom = await insertUser(client, 'giaovien.chunhiem@nguyendu.smartpath.test', 'Thầy Phạm Quốc Bảo');
    const schoolTwoTeacher = await insertUser(client, 'giaovien.toan@lequydon.smartpath.test', 'Cô Võ Thùy Dương');
    const studentOne = await insertUser(client, pilotAccounts.student.email, 'Nguyễn Minh An');
    const studentTwo = await insertUser(client, 'hocsinh.linh@nguyendu.smartpath.test', 'Trần Ngọc Linh');
    const studentThree = await insertUser(client, 'hocsinh.khanh@lequydon.smartpath.test', 'Phạm Gia Khánh');

    const schoolOne = (await client.query<{ id: string }>(`
      INSERT INTO schools (code, name, province, owner_id) VALUES ('SP-PILOT001', 'THPT Nguyễn Du', 'Đà Nẵng', $1) RETURNING id
    `, [ownerOne.id])).rows[0]!;
    const schoolTwo = (await client.query<{ id: string }>(`
      INSERT INTO schools (code, name, province, owner_id) VALUES ('SP-PILOT002', 'THPT Lê Quý Đôn', 'Thừa Thiên Huế', $1) RETURNING id
    `, [ownerTwo.id])).rows[0]!;

    for (const [schoolId, ownerId] of [[schoolOne.id, ownerOne.id], [schoolTwo.id, ownerTwo.id]] as const) {
      await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, $3)', [schoolId, ownerId, 'SCHOOL_OWNER']);
      await client.query("INSERT INTO school_settings (school_id, class_quota, trial_ends_at) VALUES ($1, 30, now() + interval '30 days')", [schoolId]);
      await client.query("INSERT INTO subscriptions (school_id, status, included_class_quota, base_price_vnd, extra_class_price_vnd, trial_ends_at) VALUES ($1, 'TRIAL', 30, 10000000, 500000, now() + interval '30 days')", [schoolId]);
    }

    await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $3), ($1, $5, $6), ($1, $7, $6)', [schoolOne.id, teacherMath.id, 'TEACHER', teacherHomeroom.id, studentOne.id, 'STUDENT', studentTwo.id]);
    await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $5)', [schoolTwo.id, schoolTwoTeacher.id, 'TEACHER', studentThree.id, 'STUDENT']);
    await client.query(`
      INSERT INTO student_profiles (user_id, school_id, student_code, roster_data) VALUES
        ($1, $2, 'SPHS-2026-000001', '{"gradeLevel":12}'::jsonb),
        ($3, $2, 'SPHS-2026-000002', '{"gradeLevel":12}'::jsonb),
        ($4, $5, 'SPHS-2026-000101', '{"gradeLevel":12}'::jsonb)
    `, [studentOne.id, schoolOne.id, studentTwo.id, studentThree.id, schoolTwo.id]);

    const mathOne = (await client.query<{ id: string }>(`INSERT INTO subjects (school_id, code, name) VALUES ($1, 'MATH', 'Toán học') RETURNING id`, [schoolOne.id])).rows[0]!;
    const mathTwo = (await client.query<{ id: string }>(`INSERT INTO subjects (school_id, code, name) VALUES ($1, 'MATH', 'Toán học') RETURNING id`, [schoolTwo.id])).rows[0]!;
    const classOne = (await client.query<{ id: string }>(`INSERT INTO classes (school_id, code, name, grade_level, school_year) VALUES ($1, '12A1', 'Lớp 12A1', 12, '2026-2027') RETURNING id`, [schoolOne.id])).rows[0]!;
    const classTwo = (await client.query<{ id: string }>(`INSERT INTO classes (school_id, code, name, grade_level, school_year) VALUES ($1, '12A1', 'Lớp 12A1', 12, '2026-2027') RETURNING id`, [schoolTwo.id])).rows[0]!;
    await client.query(`
      INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) VALUES
        ($1, $2, $3, $4, 'SUBJECT_TEACHER'), ($1, $2, $5, NULL, 'HOMEROOM_TEACHER'),
        ($6, $7, $8, $9, 'SUBJECT_TEACHER')
    `, [schoolOne.id, classOne.id, teacherMath.id, mathOne.id, teacherHomeroom.id, schoolTwo.id, classTwo.id, schoolTwoTeacher.id, mathTwo.id]);
    await client.query('INSERT INTO class_enrollments (school_id, class_id, student_id) VALUES ($1, $2, $3), ($1, $2, $4), ($5, $6, $7)', [schoolOne.id, classOne.id, studentOne.id, studentTwo.id, schoolTwo.id, classTwo.id, studentThree.id]);

    const lesson = (await client.query<{ id: string }>(`
      INSERT INTO lessons (school_id, class_id, subject_id, title, content, published_at, created_by)
      VALUES ($1, $2, $3, 'Khảo sát hàm số', '{"blocks":[{"type":"text","value":"Ôn tập đạo hàm"}]}'::jsonb, now(), $4) RETURNING id
    `, [schoolOne.id, classOne.id, mathOne.id, teacherMath.id])).rows[0]!;
    const bank = (await client.query<{ id: string }>(`INSERT INTO question_banks (school_id, subject_id, name, created_by) VALUES ($1, $2, 'Ngân hàng Toán 12', $3) RETURNING id`, [schoolOne.id, mathOne.id, teacherMath.id])).rows[0]!;
    const question = (await client.query<{ id: string }>(`INSERT INTO questions (school_id, bank_id, created_by) VALUES ($1, $2, $3) RETURNING id`, [schoolOne.id, bank.id, teacherMath.id])).rows[0]!;
    const questionVersion = (await client.query<{ id: string }>(`
      INSERT INTO question_versions (school_id, question_id, version, type, prompt, answer_key, max_score, is_approved, created_by)
      VALUES ($1, $2, 1, 'MULTIPLE_CHOICE', '{"text":"Đạo hàm của x² là gì?","choices":["x","2x","x²"]}'::jsonb, '{"choice":"2x"}'::jsonb, 1, true, $3) RETURNING id
    `, [schoolOne.id, question.id, teacherMath.id])).rows[0]!;
    const assignment = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at)
      VALUES ($1, $2, $3, 'Kiểm tra đạo hàm', 'Hoàn thành trước hạn.', 'PUBLISHED', now() + interval '7 days', $4, now()) RETURNING id
    `, [schoolOne.id, classOne.id, mathOne.id, teacherMath.id])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 1)', [schoolOne.id, assignment.id, questionVersion.id]);
    await client.query('INSERT INTO gradebook_entries (school_id, class_id, subject_id, student_id, assignment_id, score, max_score, source, recorded_by) VALUES ($1, $2, $3, $4, $5, 8.5, 10, $6, $7)', [schoolOne.id, classOne.id, mathOne.id, studentOne.id, assignment.id, 'TEACHER', teacherMath.id]);
    await client.query('INSERT INTO learning_events (school_id, student_id, class_id, subject_id, event_key, kind, payload, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())', [schoolOne.id, studentOne.id, classOne.id, mathOne.id, 'seed-event-minh-an-0001', 'ASSIGNMENT_GRADED', '{"score":8.5}']);

    const career = (await client.query<{ id: string }>(`INSERT INTO careers (code, name, description, riasec_weights) VALUES ('SOFTWARE_ENGINEER', 'Kỹ sư phần mềm', 'Thiết kế và phát triển phần mềm.', '{"I":0.8,"C":0.4}'::jsonb) RETURNING id`)).rows[0]!;
    const major = (await client.query<{ id: string }>(`INSERT INTO majors (code, name, career_id) VALUES ('CS', 'Khoa học máy tính', $1) RETURNING id`, [career.id])).rows[0]!;
    const institution = (await client.query<{ id: string }>(`INSERT INTO education_institutions (code, name, province) VALUES ('DUT', 'Đại học Bách khoa - Đại học Đà Nẵng', 'Đà Nẵng') RETURNING id`)).rows[0]!;
    const institutionMajor = (await client.query<{ id: string }>(`INSERT INTO institution_majors (institution_id, major_id, program_code) VALUES ($1, $2, 'CS') RETURNING id`, [institution.id, major.id])).rows[0]!;
    await client.query('INSERT INTO admission_scores (institution_major_id, year, score, source_url) VALUES ($1, 2026, 25.5, $2)', [institutionMajor.id, 'https://example.test/catalog']);
    await client.query('INSERT INTO scholarships (institution_id, title, criteria, source_url) VALUES ($1, $2, $3::jsonb, $4)', [institution.id, 'Học bổng STEM pilot', '{"minimumScore":8}' , 'https://example.test/scholarship']);
    await client.query('INSERT INTO career_profiles (user_id, school_id, academic_snapshot, consent_to_share) VALUES ($1, $2, $3::jsonb, true)', [studentOne.id, schoolOne.id, '{"math":8.5}']);
    await client.query('INSERT INTO career_assessments (school_id, user_id, kind, answers, scores) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)', [schoolOne.id, studentOne.id, 'RIASEC', '{"answers":[1,2,3]}', '{"I":28,"R":20,"A":17}']);
    await client.query('INSERT INTO career_results (school_id, user_id, career_id, score, evidence) VALUES ($1, $2, $3, 0.82, $4::jsonb)', [schoolOne.id, studentOne.id, career.id, '{"source":"seed"}']);
    await client.query('INSERT INTO platform_contact_settings (id, zalo_url, facebook_url, updated_by) VALUES (true, NULL, NULL, $1)', [admin.id]);
    await client.query(`INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata) VALUES ($1, 'PILOT_DATA_RESET', 'seed', 'pilot-2-schools', '{"schools":2}'::jsonb)`, [admin.id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function main(): Promise<void> {
  const connectionString = process.env.PLATFORM_CONTROL_DATABASE_URL;
  if (!connectionString) throw new Error('PLATFORM_CONTROL_DATABASE_URL is required.');
  const pool = new pg.Pool({ connectionString });
  try { await resetAndSeedPilotData(pool); console.log('Smart Path pilot data reset and seeded for exactly two schools.'); }
  finally { await pool.end(); }
}

if (process.argv[1]?.endsWith('seed-pilot.ts') || process.argv[1]?.endsWith('seed-pilot.js')) {
  await main();
}


