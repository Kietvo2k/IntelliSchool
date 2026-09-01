-- Knowledge base học sinh, khóa ca thi, giám thị, tin nhắn GVCN, skill nháp.
-- Forward-only.

ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS camera_required boolean NOT NULL DEFAULT false;

ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE rag_documents DROP CONSTRAINT IF EXISTS rag_documents_source_kind_check;
ALTER TABLE rag_documents ADD CONSTRAINT rag_documents_source_kind_check
  CHECK (source_kind IN ('RESOURCE', 'LESSON', 'TEXT', 'LEARNER_PROFILE', 'GRADEBOOK', 'CAREER_SNAPSHOT', 'CHAT_MEMORY'));
ALTER TABLE rag_documents DROP CONSTRAINT IF EXISTS rag_documents_source_present;
ALTER TABLE rag_documents ADD CONSTRAINT rag_documents_source_present
  CHECK (
    resource_id IS NOT NULL
    OR lesson_id IS NOT NULL
    OR source_kind IN ('TEXT', 'LEARNER_PROFILE', 'GRADEBOOK', 'CAREER_SNAPSHOT', 'CHAT_MEMORY')
  );

CREATE TABLE IF NOT EXISTS exam_proctors (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS class_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skill_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  skill_code text NOT NULL CHECK (char_length(skill_code) BETWEEN 1 AND 64),
  skill_name text NOT NULL CHECK (char_length(skill_name) BETWEEN 1 AND 160),
  evidence text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_messages_thread_idx ON class_messages (school_id, class_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS skill_suggestions_student_idx ON skill_suggestions (school_id, student_id, status);

DO $$
DECLARE
  tenant_tables text[] := ARRAY['exam_proctors', 'class_messages', 'skill_suggestions'];
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
