-- Phase 7: hồ sơ điểm thi TN, phân tích AI, tổ hợp theo ngành, phòng thi CBT.
-- Forward-only.

CREATE TABLE IF NOT EXISTS exam_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_code text NOT NULL CHECK (char_length(subject_code) BETWEEN 2 AND 16),
  score numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 10),
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  source text NOT NULL CHECK (source IN ('CLASSROOM', 'GRADUATION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_code, year, source)
);

CREATE TABLE IF NOT EXISTS career_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_fallback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institution_major_exam_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_major_id uuid NOT NULL REFERENCES institution_majors(id) ON DELETE CASCADE,
  exam_block text NOT NULL CHECK (exam_block ~ '^[A-Z][0-9]{2}$'),
  is_heuristic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_major_id, exam_block)
);

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'HOMEWORK'
  CHECK (delivery_mode IN ('HOMEWORK', 'EXAM'));
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS duration_minutes integer
  CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 300);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS exam_pin_hash text;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS show_score_on_submit boolean NOT NULL DEFAULT true;

ALTER TABLE career_assessments DROP CONSTRAINT IF EXISTS career_assessments_kind_check;
ALTER TABLE career_assessments ADD CONSTRAINT career_assessments_kind_check
  CHECK (kind IN ('RIASEC', 'APTITUDE', 'EXTRACURRICULAR'));

CREATE TABLE IF NOT EXISTS exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES assignment_attempts(id) ON DELETE SET NULL,
  shuffle_seed jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  submitted_at timestamptz,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS exam_integrity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 2 AND 40),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON institution_major_exam_blocks TO smartpath_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON institution_major_exam_blocks TO smartpath_control;

DO $$
DECLARE
  tenant_tables text[] := ARRAY['exam_records', 'career_analysis_runs', 'exam_sessions', 'exam_integrity_events'];
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE %I TO smartpath_api', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE %I TO smartpath_control', table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_tenant', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO smartpath_api USING (school_id = app_current_school_id()) WITH CHECK (school_id = app_current_school_id())', table_name || '_tenant', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_control', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO smartpath_control USING (true) WITH CHECK (true)', table_name || '_control', table_name);
  END LOOP;
END $$;
