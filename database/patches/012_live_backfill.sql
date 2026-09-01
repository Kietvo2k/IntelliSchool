-- Live backfill for school-platform overhaul on existing volume (not a schema migration).
-- Idempotent enough to re-run: skips exam items if TRUE_FALSE already present.

INSERT INTO crawl_sources (host) VALUES ('tuyensinh247.com'), ('vnexpress.net') ON CONFLICT (host) DO NOTHING;

UPDATE education_institutions SET
  employment_rate = COALESCE(employment_rate, 75),
  tuition_band = COALESCE(tuition_band, 'Công bố theo đề án từng năm'),
  ranking = COALESCE(ranking, 'Trong nước'),
  accreditation = COALESCE(accreditation, 'Theo Bộ GDĐT'),
  coverage = '{"years":[2024,2025,2026],"complete":false,"disclaimer":"Điểm chuẩn lấy từ nguồn công khai; chưa verify hết tổ hợp × năm."}'::jsonb;

INSERT INTO admission_scores (institution_major_id, year, exam_block, score, source_url)
SELECT s.institution_major_id, y.year, s.exam_block,
       round((s.score + (y.year - 2026) * 0.2)::numeric, 2),
       s.source_url
FROM admission_scores s
CROSS JOIN (VALUES (2024), (2025)) AS y(year)
WHERE s.year = 2026
  AND NOT EXISTS (
    SELECT 1 FROM admission_scores s2
    WHERE s2.institution_major_id = s.institution_major_id
      AND s2.year = y.year
      AND coalesce(s2.exam_block, '') = coalesce(s.exam_block, '')
  );

INSERT INTO scholarships (institution_id, title, criteria, source_url, deadline_at)
SELECT ei.id, 'Học bổng khuyến khích học tập 2025–2026 (' || ei.code || ')', '{"minimumGpa":8,"years":[2024,2025,2026]}'::jsonb, 'https://moet.gov.vn', '2026-09-30T00:00:00Z'
FROM education_institutions ei
WHERE ei.code IN ('DUT', 'HUST', 'VNU_HN')
  AND NOT EXISTS (SELECT 1 FROM scholarships s WHERE s.institution_id = ei.id AND s.title LIKE 'Học bổng khuyến khích học tập 2025–2026%');

UPDATE lessons
SET video = '{"url":"https://www.youtube.com/watch?v=WUvTyaaN5zY","provider":"YOUTUBE"}'::jsonb,
    available_from = COALESCE(available_from, now() - interval '1 day')
WHERE subject_id IN (SELECT id FROM subjects WHERE code = 'MATH');

DO $$
DECLARE
  school uuid;
  bank uuid;
  teacher uuid;
  owner uuid;
  student uuid;
  klass uuid;
  exam uuid;
  homework uuid;
  v_tf uuid;
  v_short uuid;
  v_mcq1 uuid;
  v_mcq2 uuid;
  v_essay uuid;
BEGIN
  SELECT qb.school_id, qb.id, qb.created_by INTO school, bank, teacher
  FROM question_banks qb
  JOIN subjects s ON s.id = qb.subject_id
  WHERE s.code = 'MATH'
  LIMIT 1;
  IF school IS NULL THEN
    RAISE NOTICE 'No math bank; skip question backfill';
    RETURN;
  END IF;

  SELECT sm.user_id INTO owner FROM school_memberships sm WHERE sm.school_id = school AND sm.role = 'SCHOOL_OWNER' LIMIT 1;
  SELECT u.id INTO student FROM users u WHERE u.email = 'hocsinh.minh@nguyendu.smartpath.test';
  SELECT a.class_id, a.id INTO klass, exam FROM assignments a WHERE a.delivery_mode = 'EXAM' LIMIT 1;
  SELECT a.id INTO homework FROM assignments a WHERE a.delivery_mode = 'HOMEWORK' AND a.subject_id IN (SELECT id FROM subjects WHERE code = 'MATH') LIMIT 1;

  SELECT qv.id INTO v_mcq1 FROM question_versions qv JOIN questions q ON q.id = qv.question_id
    WHERE q.bank_id = bank AND qv.type = 'MULTIPLE_CHOICE' AND qv.prompt->>'text' LIKE '%x%' LIMIT 1;
  SELECT qv.id INTO v_mcq2 FROM question_versions qv JOIN questions q ON q.id = qv.question_id
    WHERE q.bank_id = bank AND qv.type = 'MULTIPLE_CHOICE' AND qv.id <> v_mcq1 LIMIT 1;
  SELECT qv.id INTO v_essay FROM question_versions qv JOIN questions q ON q.id = qv.question_id
    WHERE q.bank_id = bank AND qv.type = 'ESSAY' LIMIT 1;
  SELECT qv.id INTO v_tf FROM question_versions qv JOIN questions q ON q.id = qv.question_id
    WHERE q.bank_id = bank AND qv.type = 'TRUE_FALSE' LIMIT 1;
  SELECT qv.id INTO v_short FROM question_versions qv JOIN questions q ON q.id = qv.question_id
    WHERE q.bank_id = bank AND qv.type = 'SHORT_ANSWER' LIMIT 1;

  IF v_tf IS NULL THEN
    INSERT INTO questions (school_id, bank_id, created_by) VALUES (school, bank, teacher) RETURNING id INTO v_tf;
    INSERT INTO question_versions (school_id, question_id, version, type, prompt, answer_key, max_score, is_approved, created_by, approved_by, approved_at)
    VALUES (
      school, v_tf, 1, 'TRUE_FALSE',
      '{"stem":"Cho hàm số y = x². Xét các ý sau:","statements":[{"key":"a","text":"Đạo hàm bằng 2x."},{"key":"b","text":"Hàm số nghịch biến trên (0; +∞)."},{"key":"c","text":"Đồ thị là parabol nhận Oy làm trục."},{"key":"d","text":"y′(1) = 2."}]}'::jsonb,
      '{"values":{"a":true,"b":false,"c":true,"d":true}}'::jsonb,
      1, true, teacher, owner, now()
    ) RETURNING id INTO v_tf;
  END IF;

  IF v_short IS NULL THEN
    INSERT INTO questions (school_id, bank_id, created_by) VALUES (school, bank, teacher) RETURNING id INTO v_short;
    INSERT INTO question_versions (school_id, question_id, version, type, prompt, answer_key, max_score, is_approved, created_by, approved_by, approved_at)
    VALUES (
      school, v_short, 1, 'SHORT_ANSWER',
      '{"text":"Tính y′(2) với y = x².","unit":""}'::jsonb,
      '{"numeric":"4"}'::jsonb,
      0.5, true, teacher, owner, now()
    ) RETURNING id INTO v_short;
  END IF;

  IF exam IS NOT NULL THEN
    DELETE FROM exam_sessions WHERE assignment_id = exam;
    DELETE FROM assignment_attempts WHERE assignment_id = exam;
    DELETE FROM assignment_items WHERE assignment_id = exam;
    INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points)
    VALUES
      (school, exam, v_mcq1, 1, 0.25),
      (school, exam, v_mcq2, 2, 0.25),
      (school, exam, v_tf, 3, 1),
      (school, exam, v_short, 4, 0.5),
      (school, exam, v_essay, 5, 2);
  END IF;

  IF homework IS NOT NULL AND v_mcq1 IS NOT NULL THEN
    DELETE FROM assignment_items WHERE assignment_id = homework;
    INSERT INTO assignment_items (school_id, assignment_id, question_version_id, position, points)
    VALUES
      (school, homework, v_mcq1, 1, 0.25),
      (school, homework, v_mcq2, 2, 0.25),
      (school, homework, v_tf, 3, 1),
      (school, homework, v_short, 4, 0.5),
      (school, homework, v_essay, 5, 2);
  END IF;

  IF student IS NOT NULL THEN
    INSERT INTO digital_transcripts (school_id, user_id, term, subject_code, score, source)
    VALUES (school, student, 'HK2-2025', 'TOAN', 8.5, 'SCHOOL'), (school, student, 'HK2-2025', 'VAN', 7.5, 'STUDENT')
    ON CONFLICT (user_id, term, subject_code, source) DO NOTHING;
    INSERT INTO learner_knowledge_cards (user_id, school_id, canonical, free_text)
    VALUES (student, school, '{"strengths":["TOAN","LY"],"gaps":["VAN"],"recommendedFocus":["VAN"],"grades":{"TOAN":8.5,"VAN":7.5,"LY":8}}'::jsonb, 'Em thích hình học và muốn ôn văn nghị luận.')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF klass IS NOT NULL AND teacher IS NOT NULL THEN
    INSERT INTO class_messages (school_id, class_id, sender_id, recipient_id, body, channel_kind)
    SELECT school, klass, teacher, NULL, 'Chao lop, kenh thong bao chung.', 'CLASS'
    WHERE NOT EXISTS (SELECT 1 FROM class_messages cm WHERE cm.class_id = klass AND cm.channel_kind = 'CLASS');
  END IF;
END $$;
