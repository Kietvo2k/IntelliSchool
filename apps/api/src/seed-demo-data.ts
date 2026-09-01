import pg from 'pg';
import { createHash } from 'node:crypto';
import { hashPassword } from './security/passwords.js';
import { EMBEDDING_DIM, localEmbed } from './domain/ai/rag.js';

/**
 * Additive, deterministic demo fixture. It never truncates pilot data and is
 * intentionally disabled in production. Re-running it updates the same rows.
 */
const DEMO_PASSWORD = 'DemoOnlyPassword!2026';
const SCHOOL_CODES = ['SP-PILOT001', 'SP-PILOT002'] as const;
const SUBJECT_CODES = ['MATH', 'LIT', 'ENG', 'PHYS', 'CHEM', 'BIO'] as const;
const SUBJECT_NAMES: Record<string, string> = { MATH: 'Toán học', LIT: 'Ngữ văn', ENG: 'Ngoại ngữ 1', PHYS: 'Vật lí', CHEM: 'Hóa học', BIO: 'Sinh học' };

type School = { id: string; code: string; name: string };
type DemoUser = { id: string; email: string; role: 'TEACHER' | 'STUDENT' };
type QuestionVersion = { id: string; type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY' };

async function getOrCreateUser(client: pg.PoolClient, email: string, displayName: string, role: DemoUser['role'], passwordHash: string): Promise<DemoUser> {
  const user = (await client.query<{ id: string }>(
    `INSERT INTO users (email, display_name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [email, displayName],
  )).rows[0]!;
  await client.query('INSERT INTO password_credentials (user_id, password_hash, must_change_password) VALUES ($1, $2, false) ON CONFLICT (user_id) DO NOTHING', [user.id, passwordHash]);
  return { id: user.id, email, role };
}

async function getOrCreateClass(client: pg.PoolClient, school: School, index: number): Promise<{ id: string; code: string; grade: number }> {
  const grade = 10 + (index % 3);
  const code = `DEMO${grade}${String.fromCharCode(65 + Math.floor(index / 3))}`;
  const row = (await client.query<{ id: string }>(
    `INSERT INTO classes (school_id, code, name, grade_level, school_year)
     VALUES ($1, $2, $3, $4, '2026-2027')
     ON CONFLICT (school_id, code, school_year) DO UPDATE SET name = EXCLUDED.name, grade_level = EXCLUDED.grade_level
     RETURNING id`,
    [school.id, code, `Lớp ${grade}${String.fromCharCode(65 + Math.floor(index / 3))} · dữ liệu demo`, grade],
  )).rows[0]!;
  return { id: row.id, code, grade };
}

async function getOrCreateBank(client: pg.PoolClient, school: School, subjectId: string, subjectCode: string, teacherId: string): Promise<string> {
  const existing = await client.query<{ id: string }>('SELECT id FROM question_banks WHERE school_id = $1 AND name = $2 LIMIT 1', [school.id, `Ngân hàng demo ${subjectCode}`]);
  if (existing.rows[0]) return existing.rows[0].id;
  return (await client.query<{ id: string }>('INSERT INTO question_banks (school_id, subject_id, name, created_by) VALUES ($1, $2, $3, $4) RETURNING id', [school.id, subjectId, `Ngân hàng demo ${subjectCode}`, teacherId])).rows[0]!.id;
}

async function getOrCreateQuestions(client: pg.PoolClient, school: School, bankId: string, teacherId: string, subjectCode: string): Promise<QuestionVersion[]> {
  const questions: QuestionVersion[] = [];
  const definitions: Array<{ type: QuestionVersion['type']; points: number; prompt: Record<string, unknown>; answer: Record<string, unknown> }> = [
    { type: 'MULTIPLE_CHOICE', points: 1, prompt: { demoKey: `${subjectCode}-mc-1`, text: `${SUBJECT_NAMES[subjectCode]} · câu khởi động: kết luận nào đúng?`, choices: ['Mệnh đề A', 'Mệnh đề B', 'Mệnh đề C', 'Mệnh đề D'] }, answer: { choice: 'Mệnh đề B' } },
    { type: 'MULTIPLE_CHOICE', points: 1, prompt: { demoKey: `${subjectCode}-mc-2`, text: `${SUBJECT_NAMES[subjectCode]} · chọn đáp án phù hợp với dữ kiện.`, choices: ['12', '18', '24', '36'] }, answer: { choice: '24' } },
    { type: 'MULTIPLE_CHOICE', points: 1, prompt: { demoKey: `${subjectCode}-mc-3`, text: `${SUBJECT_NAMES[subjectCode]} · nhận định nào cần kiểm chứng thêm?`, choices: ['A', 'B', 'C', 'D'] }, answer: { choice: 'C' } },
    { type: 'SHORT_ANSWER', points: 1, prompt: { demoKey: `${subjectCode}-short-1`, text: `${SUBJECT_NAMES[subjectCode]} · ghi kết quả cuối cùng (không kèm đơn vị).` }, answer: { numeric: '42' } },
    { type: 'SHORT_ANSWER', points: 1, prompt: { demoKey: `${subjectCode}-short-2`, text: `${SUBJECT_NAMES[subjectCode]} · tính nhanh giá trị của biểu thức sau.` }, answer: { numeric: '7.5' } },
    { type: 'ESSAY', points: 2, prompt: { demoKey: `${subjectCode}-essay-1`, text: `${SUBJECT_NAMES[subjectCode]} · trình bày cách suy luận và tự kiểm tra kết quả.` }, answer: {} },
  ];
  for (const definition of definitions) {
    const existing = await client.query<{ id: string; version_id: string; type: QuestionVersion['type'] }>(
      `SELECT q.id, qv.id AS version_id, qv.type
       FROM questions q JOIN question_versions qv ON qv.question_id = q.id
       WHERE q.bank_id = $1 AND qv.prompt->>'demoKey' = $2 LIMIT 1`,
      [bankId, String(definition.prompt.demoKey)],
    );
    if (existing.rows[0]) {
      questions.push({ id: existing.rows[0].version_id, type: existing.rows[0].type });
      continue;
    }
    const question = (await client.query<{ id: string }>('INSERT INTO questions (school_id, bank_id, created_by) VALUES ($1, $2, $3) RETURNING id', [school.id, bankId, teacherId])).rows[0]!;
    const version = (await client.query<{ id: string }>(
      `INSERT INTO question_versions (school_id, question_id, version, type, prompt, answer_key, max_score, is_approved, created_by, approved_by, approved_at)
       VALUES ($1, $2, 1, $3, $4::jsonb, $5::jsonb, $6, true, $7, $7, now()) RETURNING id`,
      [school.id, question.id, definition.type, JSON.stringify(definition.prompt), JSON.stringify(definition.answer), definition.points, teacherId],
    )).rows[0]!;
    questions.push({ id: version.id, type: definition.type });
  }
  return questions;
}

async function seedLesson(client: pg.PoolClient, school: School, classId: string, subjectId: string, teacherId: string, index: number, subjectCode: string): Promise<void> {
  const title = `Chuyên đề demo ${subjectCode} · bài ${index + 1}`;
  const existing = await client.query<{ id: string }>('SELECT id FROM lessons WHERE school_id = $1 AND class_id = $2 AND title = $3 LIMIT 1', [school.id, classId, title]);
  if (existing.rows[0]) return;
  await client.query(
    `INSERT INTO lessons (school_id, class_id, subject_id, title, content, published_at, created_by, video)
     VALUES ($1, $2, $3, $4, $5::jsonb, now(), $6, $7::jsonb)`,
    [school.id, classId, subjectId, title, JSON.stringify({ blocks: [{ type: 'heading', level: 2, text: `Mục tiêu ${SUBJECT_NAMES[subjectCode]}` }, { type: 'paragraph', text: 'Bài giảng demo có nội dung, ví dụ, câu hỏi tự kiểm tra và phần ghi chú cho học sinh.' }, { type: 'formula', latex: 'a^2+b^2=c^2' }] }), teacherId, JSON.stringify(index % 2 === 0 ? { url: 'https://www.youtube.com/watch?v=WUvTyaaN5zY', provider: 'YOUTUBE' } : {} )],
  );
}

async function seedResource(client: pg.PoolClient, school: School, classId: string, subjectId: string, uploadedBy: DemoUser, ownerId: string, index: number, subjectCode: string): Promise<void> {
  const contributionStatus = index % 5 === 0 ? 'PENDING' : index % 5 === 1 ? 'APPROVED' : 'NONE';
  const visibility = contributionStatus === 'APPROVED' ? 'SCHOOL' : index % 3 === 0 ? 'CLASS' : 'PRIVATE';
  const title = `Tài liệu demo ${school.code} · ${subjectCode} · ${String(index + 1).padStart(2, '0')}.txt`;
  const body = `Tài liệu học tập demo cho ${SUBJECT_NAMES[subjectCode]}.\n\nNội dung mẫu ${index + 1}: học sinh đọc, ghi chú và hỏi trợ lý AI theo ngữ cảnh của lớp.\n\nTừ khóa: ${subjectCode}, luyện tập, tư duy, hướng nghiệp.`;
  const objectKey = `demo/${school.code.toLowerCase()}/${subjectCode.toLowerCase()}-${String(index + 1).padStart(2, '0')}.txt`;
  const sha256 = createHash('sha256').update(body, 'utf8').digest('hex');
  const lesson = await client.query<{ id: string }>('SELECT id FROM lessons WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 ORDER BY created_at ASC LIMIT 1', [school.id, classId, subjectId]);
  const resource = (await client.query<{ id: string }>(
    `INSERT INTO resources (school_id, class_id, subject_id, lesson_id, object_key, original_name, mime_type, byte_size, sha256, status, uploaded_by, owner_user_id, visibility, contribution_status, reviewed_by, reviewed_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'text/plain', $7, $8, 'READY', $9, $10, $11, $12, $13, CASE WHEN $12 = 'APPROVED' THEN now() ELSE NULL END)
     ON CONFLICT (object_key) DO UPDATE SET class_id = EXCLUDED.class_id, subject_id = EXCLUDED.subject_id, lesson_id = EXCLUDED.lesson_id, original_name = EXCLUDED.original_name, owner_user_id = EXCLUDED.owner_user_id, visibility = EXCLUDED.visibility, contribution_status = EXCLUDED.contribution_status, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at
     RETURNING id`,
    [school.id, classId, subjectId, lesson.rows[0]?.id ?? null, objectKey, title, Buffer.byteLength(body), sha256, uploadedBy.id, ownerId, visibility, contributionStatus, uploadedBy.role === 'TEACHER' ? uploadedBy.id : null],
  )).rows[0]!;
  const existingDocument = await client.query<{ id: string }>('SELECT id FROM rag_documents WHERE resource_id = $1 ORDER BY created_at ASC LIMIT 1', [resource.id]);
  const document = existingDocument.rows[0] ?? (await client.query<{ id: string }>(
    `INSERT INTO rag_documents (school_id, class_id, subject_id, resource_id, source_kind, title, status, chunk_count, created_by)
     VALUES ($1, $2, $3, $4, 'RESOURCE', $5, 'READY', 0, $6) RETURNING id`,
    [school.id, classId, subjectId, resource.id, title, uploadedBy.id],
  )).rows[0]!;
  const chunks = body.split(/\n\n+/).filter(Boolean);
  for (let ordinal = 0; ordinal < chunks.length; ordinal += 1) {
    await client.query(
      `INSERT INTO rag_chunks (school_id, document_id, class_id, subject_id, ordinal, content, embedding, embedding_dim, citation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (document_id, ordinal) DO NOTHING`,
      [school.id, document.id, classId, subjectId, ordinal, chunks[ordinal], localEmbed(chunks[ordinal]!), EMBEDDING_DIM, JSON.stringify({ documentTitle: title, sourceKind: 'RESOURCE', demo: true })],
    );
  }
  await client.query('UPDATE rag_documents SET chunk_count = (SELECT count(*) FROM rag_chunks WHERE document_id = $1), status = \'READY\', updated_at = now() WHERE id = $1', [document.id]);
}

async function seedSchool(client: pg.PoolClient, school: School, passwordHash: string): Promise<{ accounts: number; assignments: number; resources: number }> {
  const teachers: DemoUser[] = [];
  for (let index = 0; index < 8; index += 1) {
    teachers.push(await getOrCreateUser(client, `demo.gv${String(index + 1).padStart(2, '0')}@${school.code.toLowerCase()}.smartpath.test`, `Giáo viên demo ${school.code} ${index + 1}`, 'TEACHER', passwordHash));
  }
  const students: DemoUser[] = [];
  for (let index = 0; index < 40; index += 1) {
    students.push(await getOrCreateUser(client, `demo.hs${String(index + 1).padStart(2, '0')}@${school.code.toLowerCase()}.smartpath.test`, `Học sinh demo ${school.code} ${index + 1}`, 'STUDENT', passwordHash));
  }
  for (const teacher of teachers) await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, \'TEACHER\') ON CONFLICT DO NOTHING', [school.id, teacher.id]);
  for (const [index, student] of students.entries()) {
    await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, \'STUDENT\') ON CONFLICT DO NOTHING', [school.id, student.id]);
    await client.query('INSERT INTO student_profiles (user_id, school_id, student_code, roster_data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (user_id) DO NOTHING', [student.id, school.id, `SPDEMO-${school.code.slice(-3)}-${String(index + 1).padStart(3, '0')}`, JSON.stringify({ gradeLevel: 10 + (index % 3), demo: true })]);
  }
  const subjectIds = new Map<string, string>();
  for (const code of SUBJECT_CODES) {
    const subject = await client.query<{ id: string }>('SELECT id FROM subjects WHERE school_id = $1 AND code = $2 LIMIT 1', [school.id, code]);
    if (subject.rows[0]) subjectIds.set(code, subject.rows[0].id);
  }
  const classes = [];
  for (let index = 0; index < 8; index += 1) {
    const demoClass = await getOrCreateClass(client, school, index);
    classes.push(demoClass);
    const homeroom = teachers[index % teachers.length]!;
    await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) SELECT $1, $2, $3, NULL, 'HOMEROOM_TEACHER' WHERE NOT EXISTS (SELECT 1 FROM class_teacher_assignments WHERE class_id = $2 AND role = 'HOMEROOM_TEACHER')`, [school.id, demoClass.id, homeroom.id]);
    for (const [subjectIndex, subjectCode] of SUBJECT_CODES.entries()) {
      const subjectId = subjectIds.get(subjectCode);
      if (!subjectId) continue;
      const teacher = teachers[(index + subjectIndex) % teachers.length]!;
      await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) SELECT $1, $2, $3, $4, 'SUBJECT_TEACHER' WHERE NOT EXISTS (SELECT 1 FROM class_teacher_assignments WHERE class_id = $2 AND subject_id = $4)`, [school.id, demoClass.id, teacher.id, subjectId]);
      await seedLesson(client, school, demoClass.id, subjectId, teacher.id, index, subjectCode);
    }
    for (let offset = 0; offset < 8; offset += 1) {
      const student = students[(index * 5 + offset) % students.length]!;
      await client.query('INSERT INTO class_enrollments (school_id, class_id, student_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [school.id, demoClass.id, student.id]);
    }
  }
  let assignmentCount = 0;
  for (const [classIndex, demoClass] of classes.entries()) {
    for (const [subjectIndex, subjectCode] of SUBJECT_CODES.entries()) {
      const subjectId = subjectIds.get(subjectCode);
      if (!subjectId) continue;
      const teacher = teachers[(classIndex + subjectIndex) % teachers.length]!;
      const bankId = await getOrCreateBank(client, school, subjectId, subjectCode, teacher.id);
      const questions = await getOrCreateQuestions(client, school, bankId, teacher.id, subjectCode);
      for (let assignmentIndex = 0; assignmentIndex < 2; assignmentIndex += 1) {
        const isExam = assignmentIndex === 0;
        const title = `${isExam ? 'Thi thử' : 'Bài luyện tập'} demo · ${school.code} · ${demoClass.code} · ${subjectCode}`;
        const existing = await client.query<{ id: string }>('SELECT id FROM assignments WHERE school_id = $1 AND class_id = $2 AND title = $3 LIMIT 1', [school.id, demoClass.id, title]);
        const assignment = existing.rows[0] ?? (await client.query<{ id: string }>(
          `INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode, duration_minutes, exam_pin_hash, show_score_on_submit, max_attempts, exam_period, integrity_mode)
           VALUES ($1, $2, $3, $4, $5, 'PUBLISHED', now() + interval '30 days', $6, now(), $7, $8, $9, true, 2, $10, $11) RETURNING id`,
          [school.id, demoClass.id, subjectId, title, isExam ? 'Ca thi demo STRICT_WEB để thử cảnh báo và trình soạn thảo.' : 'Bài luyện tập demo có thể làm lại và lưu tiến độ.', teacher.id, isExam ? 'EXAM' : 'HOMEWORK', isExam ? 45 : null, passwordHash, isExam ? 'MOCK_GRADUATION' : 'PRACTICE', isExam ? 'STRICT_WEB' : 'PRACTICE'],
        )).rows[0]!;
        for (let position = 0; position < 5; position += 1) {
          const question = questions[position % questions.length]!;
          await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (assignment_id, position) DO NOTHING', [school.id, assignment.id, question.id, position + 1, question.type === 'ESSAY' ? 2 : 1]);
        }
        assignmentCount += 1;
        for (const student of students.slice(0, 6)) {
          const score = 5 + ((classIndex + subjectIndex + assignmentIndex + Number(student.email.match(/(\d+)@/)?.[1] ?? 1)) % 46) / 10;
          await client.query(`INSERT INTO gradebook_entries (school_id, class_id, subject_id, student_id, assignment_id, score, max_score, source, recorded_by) SELECT $1, $2, $3, $4, $5, $6, 10, 'TEACHER', $7 WHERE NOT EXISTS (SELECT 1 FROM gradebook_entries WHERE student_id = $4 AND assignment_id = $5)`, [school.id, demoClass.id, subjectId, student.id, assignment.id, score, teacher.id]);
        }
      }
    }
  }
  let resourceCount = 0;
  for (let index = 0; index < 24; index += 1) {
    const subjectCode = SUBJECT_CODES[index % SUBJECT_CODES.length];
    const subjectId = subjectIds.get(subjectCode);
    if (!subjectId) continue;
    const demoClass = classes[index % classes.length]!;
    const owner = students[index % students.length]!;
    const uploader = index % 4 === 0 ? owner : teachers[index % teachers.length]!;
    await seedResource(client, school, demoClass.id, subjectId, uploader, owner.id, index, subjectCode);
    resourceCount += 1;
  }
  return { accounts: teachers.length + students.length, assignments: assignmentCount, resources: resourceCount };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data is disabled in production.');
  const connectionString = process.env.PLATFORM_CONTROL_DATABASE_URL;
  if (!connectionString) throw new Error('PLATFORM_CONTROL_DATABASE_URL is required.');
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const schools = (await client.query<School>('SELECT id, code, name FROM schools WHERE code = ANY($1::text[]) ORDER BY code', [SCHOOL_CODES])).rows;
    if (schools.length !== SCHOOL_CODES.length) throw new Error('Cần chạy seed pilot trước để có SP-PILOT001 và SP-PILOT002.');
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const totals = { accounts: 0, assignments: 0, resources: 0 };
    for (const school of schools) {
      const result = await seedSchool(client, school, passwordHash);
      totals.accounts += result.accounts;
      totals.assignments += result.assignments;
      totals.resources += result.resources;
    }
    await client.query('COMMIT');
    console.log(`Demo data ready: ${totals.accounts} tài khoản, ${totals.assignments} bài kiểm tra/bài tập, ${totals.resources} tài liệu trên ${schools.length} trường.`);
    console.log(`Email demo theo mẫu demo.gv01@sp-pilot001.smartpath.test / demo.hs01@sp-pilot001.smartpath.test; mật khẩu dùng chung là DEMO_PASSWORD trong script.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
