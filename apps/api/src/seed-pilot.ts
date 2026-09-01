import pg from 'pg';
import { hashPassword } from './security/passwords.js';
import { chunkText, localEmbed, EMBEDDING_DIM } from './domain/ai/rag.js';
import { CAREER_SEED } from './domain/career/career-profiles.js';
import { CATALOG_INSTITUTIONS, CATALOG_MAJORS, blocksForCatalogMajor } from './domain/career/catalog-seed.js';

async function seedCareerCatalog(client: pg.PoolClient): Promise<void> {
  const careerIds = new Map<string, string>();
  for (const career of CAREER_SEED) {
    const row = (await client.query<{ id: string }>(`
      INSERT INTO careers (code, name, description, riasec_weights)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, riasec_weights = EXCLUDED.riasec_weights
      RETURNING id
    `, [career.code, career.name, career.description, JSON.stringify(career.riasecWeights)])).rows[0]!;
    careerIds.set(career.code, row.id);
  }
  const majorIds = new Map<string, string>();
  for (const major of CATALOG_MAJORS) {
    const row = (await client.query<{ id: string }>(`
      INSERT INTO majors (code, name, career_id) VALUES ($1, $2, $3)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, career_id = EXCLUDED.career_id
      RETURNING id
    `, [major.code, major.name, major.careerCode ? careerIds.get(major.careerCode) ?? null : null])).rows[0]!;
    majorIds.set(major.code, row.id);
  }
  for (const institution of CATALOG_INSTITUTIONS) {
    const school = (await client.query<{ id: string }>(`
      INSERT INTO education_institutions (code, name, province, type, description, website, admission_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, province = EXCLUDED.province, description = EXCLUDED.description, website = EXCLUDED.website
      RETURNING id
    `, [institution.code, institution.name, institution.province, institution.type, institution.description, institution.website, 'Xét điểm thi TN THPT theo tổ hợp ngành công bố trong đề án.'])).rows[0]!;
    for (const program of institution.majors) {
      const majorId = majorIds.get(program.majorCode);
      if (!majorId) continue;
      const majorMeta = CATALOG_MAJORS.find((item) => item.code === program.majorCode);
      const link = (await client.query<{ id: string }>(`
        INSERT INTO institution_majors (institution_id, major_id, program_code)
        VALUES ($1, $2, $3)
        ON CONFLICT (institution_id, major_id, program_code) DO UPDATE SET program_code = EXCLUDED.program_code
        RETURNING id
      `, [school.id, majorId, program.majorCode])).rows[0]!;
      const blocks = blocksForCatalogMajor(program.majorCode, majorMeta?.group);
      for (const block of blocks) {
        await client.query(`
          INSERT INTO institution_major_exam_blocks (institution_major_id, exam_block, is_heuristic)
          VALUES ($1, $2, true)
          ON CONFLICT (institution_major_id, exam_block) DO NOTHING
        `, [link.id, block]);
      }
      if (typeof program.score === 'number' && program.sourceUrl) {
        for (const year of [2024, 2025, 2026]) {
          const yearScore = Math.round((program.score + (year - 2026) * 0.2) * 100) / 100;
          for (const block of blocks.slice(0, 2)) {
            await client.query(`
              INSERT INTO admission_scores (institution_major_id, year, exam_block, score, source_url)
              SELECT $1, $2, $3, $4, $5
              WHERE NOT EXISTS (
                SELECT 1 FROM admission_scores
                WHERE institution_major_id = $1 AND year = $2 AND coalesce(exam_block, '') = coalesce($3, '')
              )
            `, [link.id, year, block, yearScore, program.sourceUrl]);
          }
        }
      }
    }
  }
  const dut = (await client.query<{ id: string }>('SELECT id FROM education_institutions WHERE code = $1', ['DUT'])).rows[0];
  if (dut) {
    await client.query('INSERT INTO scholarships (institution_id, title, criteria, source_url) VALUES ($1, $2, $3::jsonb, $4)', [dut.id, 'Học bổng STEM pilot', '{"minimumGpa":8,"maxIncome":15000000}', 'https://example.test/scholarship']);
  }
  const scholarshipSchools = await client.query<{ id: string; code: string }>('SELECT id, code FROM education_institutions WHERE code IN ($1, $2, $3)', ['DUT', 'HUST', 'VNU_HN']);
  for (const school of scholarshipSchools.rows) {
    await client.query(
      `INSERT INTO scholarships (institution_id, title, criteria, source_url, deadline_at)
       SELECT $1, $2, $3::jsonb, $4, $5::timestamptz
       WHERE NOT EXISTS (SELECT 1 FROM scholarships WHERE institution_id = $1 AND title = $2)`,
      [school.id, `Học bổng khuyến khích học tập 2025–2026 (${school.code})`, '{"minimumGpa":8,"years":[2024,2025,2026]}', 'https://moet.gov.vn', '2026-09-30T00:00:00Z'],
    );
  }
}

export const pilotAccounts = {
  platformAdmin: { email: 'admin@smartpath.test', password: 'TestOnlyPassword!2026' },
  schoolOneOwner: { email: 'hieutruong.nguyendu@smartpath.test', password: 'TestOnlyPassword!2026' },
  schoolTwoOwner: { email: 'hieutruong.lequydon@smartpath.test', password: 'TestOnlyPassword!2026' },
  teacher: { email: 'giaovien.toan@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
  teacherLit: { email: 'giaovien.van@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
  teacherChem: { email: 'giaovien.hoa@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
  teacherEng: { email: 'giaovien.anh@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
  student: { email: 'hocsinh.minh@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
  studentHung: { email: 'hocsinh.hung@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
  studentMai: { email: 'hocsinh.mai@nguyendu.smartpath.test', password: 'TestOnlyPassword!2026' },
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

async function insertUser(client: pg.PoolClient, email: string, displayName: string, passwordHash: string): Promise<SeedUser> {
  const result = await client.query<SeedUser>(`
    INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id
  `, [email, displayName]);
  const user = result.rows[0]!;
  await client.query(`
    INSERT INTO password_credentials (user_id, password_hash, must_change_password)
    VALUES ($1, $2, false)
  `, [user.id, passwordHash]);
  return user;
}

export async function resetAndSeedPilotData(pool: pg.Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Pilot seed data is disabled in production.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await truncateAllTables(client);
    const seedPasswordHash = await hashPassword('TestOnlyPassword!2026');

    const admin = await insertUser(client, pilotAccounts.platformAdmin.email, 'Platform Admin', seedPasswordHash);
    await client.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [admin.id]);
    const ownerOne = await insertUser(client, pilotAccounts.schoolOneOwner.email, 'Nguyễn Thị Lan', seedPasswordHash);
    const ownerTwo = await insertUser(client, pilotAccounts.schoolTwoOwner.email, 'Trần Minh Đức', seedPasswordHash);
    const teacherMath = await insertUser(client, pilotAccounts.teacher.email, 'Cô Lê Thu Hà', seedPasswordHash);
    const teacherHomeroom = await insertUser(client, 'giaovien.chunhiem@nguyendu.smartpath.test', 'Thầy Phạm Quốc Bảo', seedPasswordHash);
    const teacherLit = await insertUser(client, pilotAccounts.teacherLit.email, 'Cô Trần Mỹ Dung', seedPasswordHash);
    const teacherChem = await insertUser(client, pilotAccounts.teacherChem.email, 'Thầy Nguyễn Văn Khoa', seedPasswordHash);
    const teacherEng = await insertUser(client, pilotAccounts.teacherEng.email, 'Cô Lê Hoàng Anh', seedPasswordHash);
    const schoolTwoTeacher = await insertUser(client, 'giaovien.toan@lequydon.smartpath.test', 'Cô Võ Thùy Dương', seedPasswordHash);
    const studentOne = await insertUser(client, pilotAccounts.student.email, 'Nguyễn Minh An', seedPasswordHash);
    const studentTwo = await insertUser(client, 'hocsinh.linh@nguyendu.smartpath.test', 'Trần Ngọc Linh', seedPasswordHash);
    const studentHung = await insertUser(client, pilotAccounts.studentHung.email, 'Lê Gia Hưng', seedPasswordHash);
    const studentMai = await insertUser(client, pilotAccounts.studentMai.email, 'Phạm Ngọc Mai', seedPasswordHash);
    const studentThree = await insertUser(client, 'hocsinh.khanh@lequydon.smartpath.test', 'Phạm Gia Khánh', seedPasswordHash);

    const schoolOne = (await client.query<{ id: string }>(`
      INSERT INTO schools (code, name, province, owner_id) VALUES ('SP-PILOT001', 'THPT Nguyễn Du', 'TP. Hồ Chí Minh', $1) RETURNING id
    `, [ownerOne.id])).rows[0]!;
    const schoolTwo = (await client.query<{ id: string }>(`
      INSERT INTO schools (code, name, province, owner_id) VALUES ('SP-PILOT002', 'THPT Lê Quý Đôn', 'TP. Hồ Chí Minh', $1) RETURNING id
    `, [ownerTwo.id])).rows[0]!;

    for (const [schoolId, ownerId] of [[schoolOne.id, ownerOne.id], [schoolTwo.id, ownerTwo.id]] as const) {
      await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, $3)', [schoolId, ownerId, 'SCHOOL_OWNER']);
      await client.query("INSERT INTO school_settings (school_id, class_quota, trial_ends_at) VALUES ($1, 30, now() + interval '30 days')", [schoolId]);
      await client.query("INSERT INTO subscriptions (school_id, status, included_class_quota, base_price_vnd, extra_class_price_vnd, trial_ends_at) VALUES ($1, 'TRIAL', 30, 10000000, 500000, now() + interval '30 days')", [schoolId]);
    }

    await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $3), ($1, $5, $3), ($1, $6, $3), ($1, $7, $3), ($1, $8, $9), ($1, $10, $9), ($1, $11, $9), ($1, $12, $9)', [
      schoolOne.id,
      teacherMath.id, 'TEACHER',
      teacherHomeroom.id,
      teacherLit.id,
      teacherChem.id,
      teacherEng.id,
      studentOne.id, 'STUDENT',
      studentTwo.id,
      studentHung.id,
      studentMai.id,
    ]);
    await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $5)', [schoolTwo.id, schoolTwoTeacher.id, 'TEACHER', studentThree.id, 'STUDENT']);
    await client.query(`
      INSERT INTO student_profiles (user_id, school_id, student_code, roster_data) VALUES
        ($1, $2, 'SPHS-2026-000001', '{"gradeLevel":12,"dateOfBirth":"2008-03-12","gender":"Nam","room":"P.203"}'::jsonb),
        ($3, $2, 'SPHS-2026-000002', '{"gradeLevel":12,"dateOfBirth":"2008-07-21","gender":"Nữ","room":"P.203"}'::jsonb),
        ($4, $2, 'SPHS-2026-000003', '{"gradeLevel":12,"dateOfBirth":"2008-01-05","gender":"Nam","room":"P.203"}'::jsonb),
        ($5, $2, 'SPHS-2026-000004', '{"gradeLevel":12,"dateOfBirth":"2008-11-18","gender":"Nữ","room":"P.203"}'::jsonb),
        ($6, $7, 'SPHS-2026-000101', '{"gradeLevel":12}'::jsonb)
    `, [studentOne.id, schoolOne.id, studentTwo.id, studentHung.id, studentMai.id, studentThree.id, schoolTwo.id]);

    const lmsSubjects: Array<[string, string]> = [
      ['MATH', 'Toán học'], ['LIT', 'Ngữ văn'], ['ENG', 'Ngoại ngữ 1'], ['HIST', 'Lịch sử'],
      ['PHYS', 'Vật lí'], ['CHEM', 'Hóa học'], ['BIO', 'Sinh học'], ['GEO', 'Địa lí'],
      ['GDKTPL', 'Giáo dục kinh tế và pháp luật'], ['IT', 'Tin học'], ['TECH', 'Công nghệ'],
    ];
    const subjectIdsOne = new Map<string, string>();
    const subjectIdsTwo = new Map<string, string>();
    for (const [code, name] of lmsSubjects) {
      const one = (await client.query<{ id: string }>(`INSERT INTO subjects (school_id, code, name) VALUES ($1, $2, $3) RETURNING id`, [schoolOne.id, code, name])).rows[0]!;
      const two = (await client.query<{ id: string }>(`INSERT INTO subjects (school_id, code, name) VALUES ($1, $2, $3) RETURNING id`, [schoolTwo.id, code, name])).rows[0]!;
      subjectIdsOne.set(code, one.id);
      subjectIdsTwo.set(code, two.id);
    }
    const mathOne = { id: subjectIdsOne.get('MATH')! };
    const litOne = { id: subjectIdsOne.get('LIT')! };
    const physOne = { id: subjectIdsOne.get('PHYS')! };
    const chemOne = { id: subjectIdsOne.get('CHEM')! };
    const engOne = { id: subjectIdsOne.get('ENG')! };
    const itOne = { id: subjectIdsOne.get('IT')! };
    const classOne = (await client.query<{ id: string }>(`INSERT INTO classes (school_id, code, name, grade_level, school_year) VALUES ($1, '12A1', 'Lớp 12A1', 12, '2026-2027') RETURNING id`, [schoolOne.id])).rows[0]!;
    const classTwo = (await client.query<{ id: string }>(`INSERT INTO classes (school_id, code, name, grade_level, school_year) VALUES ($1, '12A1', 'Lớp 12A1', 12, '2026-2027') RETURNING id`, [schoolTwo.id])).rows[0]!;
    const stemCodes = ['MATH', 'PHYS', 'CHEM', 'BIO', 'IT', 'TECH'];
    const socialCodes = ['LIT', 'ENG', 'HIST', 'GEO', 'GDKTPL'];
    for (const code of stemCodes) {
      await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) VALUES ($1, $2, $3, $4, 'SUBJECT_TEACHER')`, [schoolOne.id, classOne.id, teacherMath.id, subjectIdsOne.get(code)]);
      await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) VALUES ($1, $2, $3, $4, 'SUBJECT_TEACHER')`, [schoolTwo.id, classTwo.id, schoolTwoTeacher.id, subjectIdsTwo.get(code)]);
    }
    for (const code of socialCodes) {
      await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) VALUES ($1, $2, $3, $4, 'SUBJECT_TEACHER')`, [schoolOne.id, classOne.id, teacherHomeroom.id, subjectIdsOne.get(code)]);
    }
    await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) VALUES ($1, $2, $3, NULL, 'HOMEROOM_TEACHER')`, [schoolOne.id, classOne.id, teacherHomeroom.id]);
    await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) VALUES ($1, $2, $3, $4, 'SUBJECT_TEACHER')`, [schoolOne.id, classOne.id, teacherLit.id, litOne.id]);
    await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) VALUES ($1, $2, $3, $4, 'SUBJECT_TEACHER')`, [schoolOne.id, classOne.id, teacherChem.id, chemOne.id]);
    await client.query(`INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id, subject_id, role) VALUES ($1, $2, $3, $4, 'SUBJECT_TEACHER')`, [schoolOne.id, classOne.id, teacherEng.id, engOne.id]);
    await client.query('INSERT INTO class_enrollments (school_id, class_id, student_id) VALUES ($1, $2, $3), ($1, $2, $4), ($1, $2, $5), ($1, $2, $6), ($7, $8, $9)', [schoolOne.id, classOne.id, studentOne.id, studentTwo.id, studentHung.id, studentMai.id, schoolTwo.id, classTwo.id, studentThree.id]);

    await client.query(`
      INSERT INTO lessons (school_id, class_id, subject_id, title, content, published_at, created_by, video)
      VALUES ($1, $2, $3, 'Khảo sát hàm số', $8::jsonb, now(), $4, '{"url":"https://www.youtube.com/watch?v=WUvTyaaN5zY","provider":"YOUTUBE"}'::jsonb),
             ($1, $2, $5, 'Nghị luận xã hội', '{"blocks":[{"type":"heading","text":"Dàn ý","level":2},{"type":"paragraph","text":"Dàn ý nghị luận về trách nhiệm công dân. Nêu hiện tượng, phân tích nguyên nhân, đề xuất giải pháp."},{"type":"html","html":"<p>Viết đoạn mở bài nêu <em>vấn đề</em> và lập luận.</p>"}]}'::jsonb, now(), $6, '{}'::jsonb),
             ($1, $2, $7, 'Chuyển động thẳng', '{"blocks":[{"type":"paragraph","text":"Vận tốc và gia tốc trong chuyển động thẳng."},{"type":"formula","latex":"v = v_0 + at"}]}'::jsonb, now(), $4, '{}'::jsonb),
             ($1, $2, $9, 'Este và lipid', '{"blocks":[{"type":"heading","text":"Phản ứng este hóa","level":2},{"type":"paragraph","text":"Acid carboxylic tác dụng alcohol có xúc tác H2SO4 đặc, đun nóng."},{"type":"formula","latex":"RCOOH + ROH \\\\rightleftharpoons RCOOR + H_2O"}]}'::jsonb, now(), $10, '{}'::jsonb),
             ($1, $2, $11, 'Reading: school life', '{"blocks":[{"type":"heading","text":"Skimming and scanning","level":2},{"type":"paragraph","text":"Read for gist first, then scan for numbers and names. Practice with a short passage about a Vietnamese high school."},{"type":"html","html":"<p>Write 80–100 words about <em>your school day</em>.</p>"}]}'::jsonb, now(), $12, '{}'::jsonb)
    `, [schoolOne.id, classOne.id, mathOne.id, teacherMath.id, litOne.id, teacherHomeroom.id, physOne.id, JSON.stringify({
      video: { url: 'https://www.youtube.com/watch?v=WUvTyaaN5zY', provider: 'YOUTUBE' },
      blocks: [
        { type: 'heading', text: 'Đạo hàm và khảo sát hàm số', level: 2 },
        { type: 'paragraph', text: 'Xem video trước, rồi đọc tài liệu công thức bên dưới. Bài này mở cho cả năm học.' },
        { type: 'formula', latex: "f'(x)=2x" },
        { type: 'html', html: '<p>Khi đạo hàm đổi dấu từ dương sang âm, hàm số đạt <strong>cực đại</strong>.</p>' },
      ],
    }), chemOne.id, teacherChem.id, engOne.id, teacherEng.id]);
    const bank = (await client.query<{ id: string }>(`INSERT INTO question_banks (school_id, subject_id, name, created_by) VALUES ($1, $2, 'Ngân hàng Toán 12', $3) RETURNING id`, [schoolOne.id, mathOne.id, teacherMath.id])).rows[0]!;
    const litBank = (await client.query<{ id: string }>(`INSERT INTO question_banks (school_id, subject_id, name, created_by) VALUES ($1, $2, 'Ngân hàng Ngữ văn 12', $3) RETURNING id`, [schoolOne.id, litOne.id, teacherHomeroom.id])).rows[0]!;
    const physBank = (await client.query<{ id: string }>(`INSERT INTO question_banks (school_id, subject_id, name, created_by) VALUES ($1, $2, 'Ngân hàng Vật lí 12', $3) RETURNING id`, [schoolOne.id, physOne.id, teacherMath.id])).rows[0]!;
    const chemBank = (await client.query<{ id: string }>(`INSERT INTO question_banks (school_id, subject_id, name, created_by) VALUES ($1, $2, 'Ngân hàng Hóa học 12', $3) RETURNING id`, [schoolOne.id, chemOne.id, teacherChem.id])).rows[0]!;
    const engBank = (await client.query<{ id: string }>(`INSERT INTO question_banks (school_id, subject_id, name, created_by) VALUES ($1, $2, 'Ngân hàng Tiếng Anh 12', $3) RETURNING id`, [schoolOne.id, engOne.id, teacherEng.id])).rows[0]!;
    async function seedQuestion(bankId: string, createdBy: string, type: string, prompt: unknown, answerKey: unknown, maxScore = 1): Promise<string> {
      const question = (await client.query<{ id: string }>(`INSERT INTO questions (school_id, bank_id, created_by) VALUES ($1, $2, $3) RETURNING id`, [schoolOne.id, bankId, createdBy])).rows[0]!;
      const version = (await client.query<{ id: string }>(`
        INSERT INTO question_versions (school_id, question_id, version, type, prompt, answer_key, max_score, is_approved, created_by, approved_by, approved_at)
        VALUES ($1, $2, 1, $3, $4::jsonb, $5::jsonb, $6, true, $7, $8, now()) RETURNING id
      `, [schoolOne.id, question.id, type, JSON.stringify(prompt), JSON.stringify(answerKey), maxScore, createdBy, ownerOne.id])).rows[0]!;
      return version.id;
    }
    const questionVersion = await seedQuestion(bank.id, teacherMath.id, 'MULTIPLE_CHOICE', { text: 'Đạo hàm của x² là gì?', choices: ['x', '2x', 'x²', '2'] }, { choice: '2x' }, 0.25);
    const examQ2 = await seedQuestion(bank.id, teacherMath.id, 'MULTIPLE_CHOICE', {
      text: 'Đạo hàm của sin x là?',
      choices: ['cos x', '-cos x', 'sin x', '-sin x'],
      imageSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140"><rect width="240" height="140" fill="#e8eef6"/><path d="M20 90 Q80 20 120 70 T220 50" fill="none" stroke="#08366a" stroke-width="3"/><line x1="20" y1="110" x2="220" y2="110" stroke="#0b4a8c"/><text x="120" y="130" text-anchor="middle" font-size="12" fill="#08366a">y = sin x</text></svg>',
    }, { choice: 'cos x' }, 0.25);
    const examTf = await seedQuestion(bank.id, teacherMath.id, 'TRUE_FALSE', {
      stem: 'Cho hàm số y = x². Xét các ý sau:',
      statements: [
        { key: 'a', text: 'Đạo hàm bằng 2x.' },
        { key: 'b', text: 'Hàm số nghịch biến trên (0; +∞).' },
        { key: 'c', text: 'Đồ thị là parabol nhận Oy làm trục.' },
        { key: 'd', text: 'y′(1) = 2.' },
      ],
    }, { values: { a: true, b: false, c: true, d: true } }, 1);
    const examShort = await seedQuestion(bank.id, teacherMath.id, 'SHORT_ANSWER', { text: 'Tính y′(2) với y = x².', unit: '' }, { numeric: '4' }, 0.5);
    const examQ3 = await seedQuestion(bank.id, teacherMath.id, 'ESSAY', { text: 'Trình bày ý nghĩa hình học của đạo hàm.', passage: 'Đạo hàm tại một điểm mô tả hệ số góc của tiếp tuyến với đồ thị tại điểm đó.' }, {}, 2);
    const litQuestion = await seedQuestion(litBank.id, teacherHomeroom.id, 'MULTIPLE_CHOICE', {
      text: 'Tác phẩm nào sau đây là của Nguyễn Du?',
      choices: ['Truyện Kiều', 'Lục Vân Tiên', 'Chinh phụ ngâm', 'Bình Ngô đại cáo'],
      imageSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140"><rect width="240" height="140" fill="#e8eef6"/><rect x="70" y="30" width="100" height="80" rx="4" fill="#0b4a8c"/><rect x="78" y="38" width="84" height="64" fill="#fff"/><text x="120" y="74" text-anchor="middle" font-size="11" fill="#08366a">Truyen Kieu</text></svg>',
    }, { choice: 'Truyện Kiều' });
    const litQ2 = await seedQuestion(litBank.id, teacherHomeroom.id, 'MULTIPLE_CHOICE', { text: 'Truyện Kiều thuộc thể loại nào?', choices: ['Truyện thơ Nôm', 'Ký', 'Ngâm khúc', 'Phú'] }, { choice: 'Truyện thơ Nôm' });
    const litTf = await seedQuestion(litBank.id, teacherHomeroom.id, 'TRUE_FALSE', {
      stem: 'Về Nguyễn Du và Truyện Kiều:',
      statements: [
        { key: 'a', text: 'Nguyễn Du là tác giả Truyện Kiều.' },
        { key: 'b', text: 'Truyện Kiều viết bằng chữ Quốc ngữ từ đầu.' },
        { key: 'c', text: 'Thể thơ chính là lục bát.' },
        { key: 'd', text: 'Nhân vật chính là Thúy Kiều.' },
      ],
    }, { values: { a: true, b: false, c: true, d: true } }, 1);
    const litShort = await seedQuestion(litBank.id, teacherHomeroom.id, 'SHORT_ANSWER', { text: 'Truyện Kiều gồm bao nhiêu câu thơ lục bát? (nhập số)' }, { numeric: '3254' }, 0.25);
    const litEssay = await seedQuestion(litBank.id, teacherHomeroom.id, 'ESSAY', { text: 'Phân tích vẻ đẹp tâm hồn Thúy Kiều trong đoạn trích đã học.', passage: 'Thúy Kiều là nhân vật trung tâm, tài sắc và phẩm hạnh.' }, {}, 2);
    const physQuestion = await seedQuestion(physBank.id, teacherMath.id, 'MULTIPLE_CHOICE', { text: 'Đơn vị của vận tốc trong SI là?', choices: ['m/s', 'm/s²', 'N', 'kg'] }, { choice: 'm/s' });
    const physQ2 = await seedQuestion(physBank.id, teacherMath.id, 'MULTIPLE_CHOICE', { text: 'Gia tốc trong SI có đơn vị?', choices: ['m/s', 'm/s²', 'N', 'J'] }, { choice: 'm/s²' }, 0.25);
    const physTf = await seedQuestion(physBank.id, teacherMath.id, 'TRUE_FALSE', {
      stem: 'Chuyển động thẳng đều:',
      statements: [
        { key: 'a', text: 'Vận tốc không đổi.' },
        { key: 'b', text: 'Gia tốc bằng 0.' },
        { key: 'c', text: 'Quãng đường tỉ lệ với bình phương thời gian.' },
        { key: 'd', text: 'Đồ thị s-t là đường thẳng.' },
      ],
    }, { values: { a: true, b: true, c: false, d: true } }, 1);
    const physShort = await seedQuestion(physBank.id, teacherMath.id, 'SHORT_ANSWER', { text: 'Một vật chuyển động thẳng đều 5 m/s trong 4 s. Quãng đường (m)?' }, { numeric: '20' }, 0.25);
    const physEssay = await seedQuestion(physBank.id, teacherMath.id, 'ESSAY', { text: 'Trình bày mối liên hệ giữa vận tốc, gia tốc và đồ thị chuyển động thẳng.' }, {}, 2);
    const chemQ1 = await seedQuestion(chemBank.id, teacherChem.id, 'MULTIPLE_CHOICE', { text: 'Công thức phân tử của acetic acid là?', choices: ['HCOOH', 'CH3COOH', 'C2H5OH', 'CH3CHO'] }, { choice: 'CH3COOH' }, 0.25);
    const chemQ2 = await seedQuestion(chemBank.id, teacherChem.id, 'MULTIPLE_CHOICE', { text: 'Phản ứng este hóa thường dùng xúc tác?', choices: ['NaOH', 'H2SO4 đặc', 'HCl loãng', 'Fe'] }, { choice: 'H2SO4 đặc' }, 0.25);
    const chemTf = await seedQuestion(chemBank.id, teacherChem.id, 'TRUE_FALSE', {
      stem: 'Về este và thủy phân este:',
      statements: [
        { key: 'a', text: "Este no đơn chức có công thức chung RCOOR'." },
        { key: 'b', text: 'Thủy phân este trong môi trường kiềm cho lại acid carboxylic tự do.' },
        { key: 'c', text: 'Phản ứng este hóa là thuận nghịch.' },
        { key: 'd', text: 'Ethyl acetate có mùi thơm.' },
      ],
    }, { values: { a: true, b: false, c: true, d: true } }, 1);
    const chemShort = await seedQuestion(chemBank.id, teacherChem.id, 'SHORT_ANSWER', { text: 'Khối lượng mol của CH3COOH (g/mol, lấy nguyên).' }, { numeric: '60' }, 0.25);
    const chemEssay = await seedQuestion(chemBank.id, teacherChem.id, 'ESSAY', { text: 'Trình bày điều kiện và cơ chế tóm tắt của phản ứng este hóa. Cho một ví dụ cụ thể.' }, {}, 2);
    const engQ1 = await seedQuestion(engBank.id, teacherEng.id, 'MULTIPLE_CHOICE', { text: 'Choose the correct form: She ____ to school every day.', choices: ['go', 'goes', 'going', 'gone'] }, { choice: 'goes' }, 0.25);
    const engQ2 = await seedQuestion(engBank.id, teacherEng.id, 'MULTIPLE_CHOICE', { text: '“Although” is closest in meaning to:', choices: ['because', 'even though', 'therefore', 'so that'] }, { choice: 'even though' }, 0.25);
    const engTf = await seedQuestion(engBank.id, teacherEng.id, 'TRUE_FALSE', {
      stem: 'About reading strategies:',
      statements: [
        { key: 'a', text: 'Skimming is reading quickly for the main idea.' },
        { key: 'b', text: 'Scanning means reading every word slowly.' },
        { key: 'c', text: 'Topic sentences often appear at the start of a paragraph.' },
        { key: 'd', text: 'Guessing meaning from context is a useful skill.' },
      ],
    }, { values: { a: true, b: false, c: true, d: true } }, 1);
    const engShort = await seedQuestion(engBank.id, teacherEng.id, 'SHORT_ANSWER', { text: 'How many letters are there in the English alphabet? (number only)' }, { numeric: '26' }, 0.25);
    const engEssay = await seedQuestion(engBank.id, teacherEng.id, 'ESSAY', { text: 'Write 80–100 words about a school day you remember. Use past simple.', passage: 'You may mention subjects, friends, and one event.' }, {}, 2);
    const assignment = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode)
      VALUES ($1, $2, $3, 'Kiểm tra đạo hàm', 'Hoàn thành trước hạn.', 'PUBLISHED', now() + interval '7 days', $4, now(), 'HOMEWORK') RETURNING id
    `, [schoolOne.id, classOne.id, mathOne.id, teacherMath.id])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 0.25), ($1, $2, $4, 2, 0.25), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.5), ($1, $2, $7, 5, 2)', [schoolOne.id, assignment.id, questionVersion, examQ2, examTf, examShort, examQ3]);
    const litAssignment = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode)
      VALUES ($1, $2, $3, 'Ôn tập Nguyễn Du', 'Chọn đáp án đúng.', 'PUBLISHED', now() + interval '7 days', $4, now(), 'HOMEWORK') RETURNING id
    `, [schoolOne.id, classOne.id, litOne.id, teacherHomeroom.id])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 1), ($1, $2, $4, 2, 1), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.25), ($1, $2, $7, 5, 2)', [schoolOne.id, litAssignment.id, litQuestion, litQ2, litTf, litShort, litEssay]);
    const physAssignment = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode)
      VALUES ($1, $2, $3, 'Ôn tập chuyển động', 'Chọn đáp án đúng.', 'PUBLISHED', now() + interval '7 days', $4, now(), 'HOMEWORK') RETURNING id
    `, [schoolOne.id, classOne.id, physOne.id, teacherMath.id])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 1), ($1, $2, $4, 2, 0.25), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.25), ($1, $2, $7, 5, 2)', [schoolOne.id, physAssignment.id, physQuestion, physQ2, physTf, physShort, physEssay]);
    const chemAssignment = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode)
      VALUES ($1, $2, $3, 'Ôn tập este và lipid', 'Làm đủ 5 câu trước hạn.', 'PUBLISHED', now() + interval '7 days', $4, now(), 'HOMEWORK') RETURNING id
    `, [schoolOne.id, classOne.id, chemOne.id, teacherChem.id])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 0.25), ($1, $2, $4, 2, 0.25), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.25), ($1, $2, $7, 5, 2)', [schoolOne.id, chemAssignment.id, chemQ1, chemQ2, chemTf, chemShort, chemEssay]);
    const engAssignment = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode)
      VALUES ($1, $2, $3, 'Reading practice: school life', 'Complete all 5 items before the due date.', 'PUBLISHED', now() + interval '7 days', $4, now(), 'HOMEWORK') RETURNING id
    `, [schoolOne.id, classOne.id, engOne.id, teacherEng.id])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 0.25), ($1, $2, $4, 2, 0.25), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.25), ($1, $2, $7, 5, 2)', [schoolOne.id, engAssignment.id, engQ1, engQ2, engTf, engShort, engEssay]);
    const examPinHash = await hashPassword('ExamPin2026!');
    const examAssignment = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode, duration_minutes, exam_pin_hash, show_score_on_submit, max_attempts, exam_period, integrity_mode)
      VALUES ($1, $2, $3, 'Thi thử Toán trường', 'Ca thi thử của trường, không phải kỳ thi quốc gia.', 'PUBLISHED', now() + interval '14 days', $4, now(), 'EXAM', 45, $5, true, 1, 'MOCK_GRADUATION', 'STRICT_WEB') RETURNING id
    `, [schoolOne.id, classOne.id, mathOne.id, teacherMath.id, examPinHash])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 0.25), ($1, $2, $4, 2, 0.25), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.5), ($1, $2, $7, 5, 2)', [schoolOne.id, examAssignment.id, questionVersion, examQ2, examTf, examShort, examQ3]);
    const litExam = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode, duration_minutes, exam_pin_hash, show_score_on_submit, max_attempts, exam_period, integrity_mode)
      VALUES ($1, $2, $3, 'Thi thử Ngữ văn trường', 'Ca thi thử Ngữ văn của trường.', 'PUBLISHED', now() + interval '14 days', $4, now(), 'EXAM', 60, $5, true, 1, 'MOCK_GRADUATION', 'STRICT_WEB') RETURNING id
    `, [schoolOne.id, classOne.id, litOne.id, teacherLit.id, examPinHash])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 1), ($1, $2, $4, 2, 1), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.25), ($1, $2, $7, 5, 2)', [schoolOne.id, litExam.id, litQuestion, litQ2, litTf, litShort, litEssay]);
    const physExam = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode, duration_minutes, exam_pin_hash, show_score_on_submit, max_attempts, exam_period, integrity_mode)
      VALUES ($1, $2, $3, 'Thi thử Vật lí trường', 'Ca thi thử Vật lí của trường.', 'PUBLISHED', now() + interval '14 days', $4, now(), 'EXAM', 45, $5, true, 1, 'MOCK_GRADUATION', 'STRICT_WEB') RETURNING id
    `, [schoolOne.id, classOne.id, physOne.id, teacherMath.id, examPinHash])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 1), ($1, $2, $4, 2, 0.25), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.25), ($1, $2, $7, 5, 2)', [schoolOne.id, physExam.id, physQuestion, physQ2, physTf, physShort, physEssay]);
    const chemExam = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode, duration_minutes, exam_pin_hash, show_score_on_submit, max_attempts, exam_period, integrity_mode)
      VALUES ($1, $2, $3, 'Thi thử Hóa học trường', 'Ca thi thử Hóa của trường.', 'PUBLISHED', now() + interval '14 days', $4, now(), 'EXAM', 45, $5, true, 1, 'MOCK_GRADUATION', 'STRICT_WEB') RETURNING id
    `, [schoolOne.id, classOne.id, chemOne.id, teacherChem.id, examPinHash])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 0.25), ($1, $2, $4, 2, 0.25), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.25), ($1, $2, $7, 5, 2)', [schoolOne.id, chemExam.id, chemQ1, chemQ2, chemTf, chemShort, chemEssay]);
    const engExam = (await client.query<{ id: string }>(`
      INSERT INTO assignments (school_id, class_id, subject_id, title, instructions, status, due_at, created_by, published_at, delivery_mode, duration_minutes, exam_pin_hash, show_score_on_submit, max_attempts, exam_period, integrity_mode)
      VALUES ($1, $2, $3, 'Thi thử Tiếng Anh trường', 'Ca thi thử Tiếng Anh của trường.', 'PUBLISHED', now() + interval '14 days', $4, now(), 'EXAM', 45, $5, true, 1, 'MOCK_GRADUATION', 'STRICT_WEB') RETURNING id
    `, [schoolOne.id, classOne.id, engOne.id, teacherEng.id, examPinHash])).rows[0]!;
    await client.query('INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points) VALUES ($1, $2, $3, 1, 0.25), ($1, $2, $4, 2, 0.25), ($1, $2, $5, 3, 1), ($1, $2, $6, 4, 0.25), ($1, $2, $7, 5, 2)', [schoolOne.id, engExam.id, engQ1, engQ2, engTf, engShort, engEssay]);
    await client.query('INSERT INTO gradebook_entries (school_id, class_id, subject_id, student_id, assignment_id, score, max_score, source, recorded_by) VALUES ($1, $2, $3, $4, $5, 8.5, 10, $6, $7)', [schoolOne.id, classOne.id, mathOne.id, studentOne.id, assignment.id, 'TEACHER', teacherMath.id]);
    await client.query('INSERT INTO gradebook_entries (school_id, class_id, subject_id, student_id, assignment_id, score, max_score, source, recorded_by) VALUES ($1, $2, $3, $4, NULL, 5.2, 10, $5, $6)', [schoolOne.id, classOne.id, itOne.id, studentOne.id, 'TEACHER', teacherHomeroom.id]);
    await client.query('INSERT INTO gradebook_entries (school_id, class_id, subject_id, student_id, assignment_id, score, max_score, source, recorded_by) VALUES ($1, $2, $3, $4, $5, 7.8, 10, $6, $7)', [schoolOne.id, classOne.id, chemOne.id, studentHung.id, chemAssignment.id, 'TEACHER', teacherChem.id]);
    await client.query('INSERT INTO gradebook_entries (school_id, class_id, subject_id, student_id, assignment_id, score, max_score, source, recorded_by) VALUES ($1, $2, $3, $4, $5, 8.4, 10, $6, $7)', [schoolOne.id, classOne.id, engOne.id, studentMai.id, engAssignment.id, 'TEACHER', teacherEng.id]);
    await client.query('INSERT INTO gradebook_entries (school_id, class_id, subject_id, student_id, assignment_id, score, max_score, source, recorded_by) VALUES ($1, $2, $3, $4, $5, 8.1, 10, $6, $7)', [schoolOne.id, classOne.id, litOne.id, studentTwo.id, litAssignment.id, 'TEACHER', teacherLit.id]);
    await client.query('INSERT INTO learning_events (school_id, student_id, class_id, subject_id, event_key, kind, payload, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())', [schoolOne.id, studentOne.id, classOne.id, mathOne.id, 'seed-event-minh-an-0001', 'ASSIGNMENT_GRADED', '{"score":8.5}']);

    await seedCareerCatalog(client);
    const career = (await client.query<{ id: string }>(`SELECT id FROM careers WHERE code = 'SOFTWARE_ENGINEER'`)).rows[0]!;
    await client.query('INSERT INTO career_profiles (user_id, school_id, academic_snapshot, consent_to_share) VALUES ($1, $2, $3::jsonb, true)', [studentOne.id, schoolOne.id, '{"math":8.5,"classroomGrades":{"TOAN":8.5,"VAN":7.5,"LY":8},"subjectScores":{"TOAN":8.2,"VAN":7,"LY":8}}']);
    await client.query('INSERT INTO career_share_grants (school_id, user_id, scope) VALUES ($1, $2, $3) ON CONFLICT (school_id, user_id, scope) DO NOTHING', [schoolOne.id, studentOne.id, 'FULL']);
    await client.query('INSERT INTO career_assessments (school_id, user_id, kind, answers, scores) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)', [schoolOne.id, studentOne.id, 'RIASEC', '{"R1":4,"I1":5,"A1":3}', '{"I":0.8,"R":0.6,"A":0.4,"code":"IRA"}']);
    await client.query('INSERT INTO career_results (school_id, user_id, career_id, score, evidence) VALUES ($1, $2, $3, 0.82, $4::jsonb)', [schoolOne.id, studentOne.id, career.id, '{"source":"seed"}']);
    await client.query(`INSERT INTO exam_records (school_id, user_id, subject_code, score, year, source) VALUES
      ($1, $2, 'TOAN', 8.5, 2026, 'CLASSROOM'), ($1, $2, 'VAN', 7.5, 2026, 'CLASSROOM'), ($1, $2, 'LY', 8.0, 2026, 'CLASSROOM'),
      ($1, $2, 'TOAN', 8.2, 2026, 'GRADUATION'), ($1, $2, 'VAN', 7.0, 2026, 'GRADUATION'), ($1, $2, 'LY', 8.0, 2026, 'GRADUATION'), ($1, $2, 'HOA', 7.5, 2026, 'GRADUATION')`, [schoolOne.id, studentOne.id]);
    await client.query(`
      INSERT INTO class_messages (school_id, class_id, sender_id, recipient_id, body, channel_kind)
      VALUES ($1, $2, $3, NULL, 'Chào lớp, kênh này dùng cho thông báo chung.', 'CLASS'),
             ($1, $2, $3, $4, 'Em nhớ nộp bài đạo hàm trước hạn nhé.', 'DIRECT'),
             ($1, $2, $5, NULL, 'Ca thi thử Văn, Hóa, Anh đã mở. PIN ca thi do GVCN gửi.', 'CLASS'),
             ($1, $2, $6, $7, 'Hung nhớ ôn este và lipid trước khi vào phòng thi Hóa.', 'DIRECT')
    `, [schoolOne.id, classOne.id, teacherHomeroom.id, studentOne.id, teacherLit.id, teacherChem.id, studentHung.id]);
    await client.query(`
      INSERT INTO digital_transcripts (school_id, user_id, term, subject_code, score, source)
      VALUES
        ($1, $2, 'HK2-2025', 'TOAN', 8.5, 'SCHOOL'), ($1, $2, 'HK2-2025', 'VAN', 7.5, 'STUDENT'),
        ($1, $3, 'HK2-2025', 'TOAN', 7.2, 'SCHOOL'), ($1, $3, 'HK2-2025', 'VAN', 8.0, 'SCHOOL'),
        ($1, $4, 'HK2-2025', 'TOAN', 6.8, 'SCHOOL'), ($1, $4, 'HK2-2025', 'HOA', 8.2, 'SCHOOL'),
        ($1, $5, 'HK2-2025', 'VAN', 8.6, 'SCHOOL'), ($1, $5, 'HK2-2025', 'ANH', 8.0, 'SCHOOL')
    `, [schoolOne.id, studentOne.id, studentTwo.id, studentHung.id, studentMai.id]);
    await client.query(`
      INSERT INTO learner_knowledge_cards (user_id, school_id, canonical, free_text)
      VALUES
        ($1, $2, '{"strengths":["TOAN","LY"],"gaps":["VAN"],"recommendedFocus":["VAN"],"grades":{"TOAN":8.5,"VAN":7.5,"LY":8}}'::jsonb, 'Em thích hình học và muốn ôn văn nghị luận.'),
        ($3, $2, '{"strengths":["HOA"],"gaps":["TOAN"],"recommendedFocus":["TOAN"],"grades":{"TOAN":6.8,"HOA":8.2}}'::jsonb, 'Em mạnh Hóa, cần ôn đạo hàm.'),
        ($4, $2, '{"strengths":["VAN","ANH"],"gaps":["LY"],"recommendedFocus":["LY"],"grades":{"VAN":8.6,"ANH":8.0}}'::jsonb, 'Em thích nghị luận và reading.')
      ON CONFLICT (user_id) DO NOTHING
    `, [studentOne.id, schoolOne.id, studentHung.id, studentMai.id]);
    await client.query(`
      UPDATE education_institutions SET
        employment_rate = COALESCE(employment_rate, 75),
        tuition_band = COALESCE(tuition_band, 'Công bố theo đề án từng năm'),
        ranking = COALESCE(ranking, 'Trong nước'),
        accreditation = COALESCE(accreditation, 'Theo Bộ GDĐT'),
        coverage = '{"years":[2024,2025,2026],"complete":false,"disclaimer":"Điểm chuẩn lấy từ nguồn công khai; chưa verify hết tổ hợp × năm."}'::jsonb
    `);
    await client.query(`INSERT INTO crawl_sources (host) VALUES ('tuyensinh247.com'), ('vnexpress.net') ON CONFLICT (host) DO NOTHING`);

    // Trợ giảng AI: VietAPI OpenAI-compatible (key chỉ lấy từ .env). Cập nhật bản seed cũ local-fast-demo.
    await client.query(`
      UPDATE ai_models
      SET provider = 'openai', model_name = 'deepseek-v4-flash', tier = 'CLOUD', is_enabled = true, updated_at = now()
      WHERE school_id = $1
    `, [schoolOne.id]);
    await client.query(`
      INSERT INTO ai_models (school_id, provider, model_name, tier, is_enabled, monthly_cost_limit_vnd, input_vnd_per_1k, output_vnd_per_1k)
      SELECT $1, 'openai', 'deepseek-v4-flash', 'CLOUD', true, NULL, 0, 0
      WHERE NOT EXISTS (SELECT 1 FROM ai_models WHERE school_id = $1)
    `, [schoolOne.id]);
    const ragDoc = (await client.query<{ id: string }>(`
      INSERT INTO rag_documents (school_id, class_id, subject_id, source_kind, title, status, chunk_count, created_by)
      VALUES ($1, $2, $3, 'TEXT', 'Ôn tập đạo hàm cơ bản', 'READY', 0, $4) RETURNING id
    `, [schoolOne.id, classOne.id, mathOne.id, teacherMath.id])).rows[0]!;
    const ragBody = [
      'Đạo hàm của một hàm số tại một điểm mô tả tốc độ thay đổi tức thời của hàm số tại điểm đó.',
      'Đạo hàm của x mũ n là n nhân x mũ (n trừ 1). Ví dụ đạo hàm của x bình phương là 2x.',
      'Quy tắc tính đạo hàm của tổng: đạo hàm của tổng bằng tổng các đạo hàm.',
      'Ứng dụng của đạo hàm: khảo sát sự biến thiên, tìm cực trị và vẽ đồ thị hàm số.',
    ].join('\n\n');
    const ragChunks = chunkText(ragBody, { maxChars: 400, overlapChars: 40 });
    for (let ordinal = 0; ordinal < ragChunks.length; ordinal += 1) {
      await client.query(`
        INSERT INTO rag_chunks (school_id, document_id, class_id, subject_id, ordinal, content, embedding, embedding_dim, citation)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `, [schoolOne.id, ragDoc.id, classOne.id, mathOne.id, ordinal, ragChunks[ordinal]!, localEmbed(ragChunks[ordinal]!), EMBEDDING_DIM, JSON.stringify({ documentTitle: 'Ôn tập đạo hàm cơ bản', ordinal, sourceKind: 'TEXT' })]);
    }
    await client.query('UPDATE rag_documents SET chunk_count = $2 WHERE id = $1', [ragDoc.id, ragChunks.length]);

    await client.query('INSERT INTO platform_contact_settings (id, zalo_url, facebook_url, updated_by) VALUES (true, NULL, NULL, $1)', [admin.id]);
    await client.query(`INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata) VALUES ($1, 'PILOT_DATA_RESET', 'seed', 'pilot-2-schools', '{"schools":2}'::jsonb)`, [admin.id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function main(): Promise<void> {
  const connectionString = process.env.PLATFORM_CONTROL_DATABASE_URL;
  if (!connectionString) throw new Error('PLATFORM_CONTROL_DATABASE_URL is required.');
  const pool = new pg.Pool({ connectionString });
  try {
    const ifEmpty = process.argv.includes('--if-empty');
    if (ifEmpty) {
      const existing = await pool.query<{ n: string }>('SELECT count(*)::text AS n FROM users');
      if (Number(existing.rows[0]?.n ?? 0) > 0) {
        console.log('Smart Path seed skipped: users already present.');
        return;
      }
    }
    await resetAndSeedPilotData(pool);
    console.log('Smart Path pilot data reset and seeded for exactly two schools.');
  } finally { await pool.end(); }
}

if (process.argv[1]?.endsWith('seed-pilot.ts') || process.argv[1]?.endsWith('seed-pilot.js')) {
  await main();
}
