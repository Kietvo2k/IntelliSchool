-- School platform: lesson schedule/video, class channels, transcript, knowledge card, catalog extras.
-- Forward-only.

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS available_from timestamptz;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS available_until timestamptz;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_byte_size_check;
ALTER TABLE resources ADD CONSTRAINT resources_byte_size_check
  CHECK (byte_size > 0 AND byte_size <= 209715200);

ALTER TABLE class_messages ALTER COLUMN recipient_id DROP NOT NULL;
ALTER TABLE class_messages ADD COLUMN IF NOT EXISTS channel_kind text NOT NULL DEFAULT 'DIRECT';
ALTER TABLE class_messages DROP CONSTRAINT IF EXISTS class_messages_channel_kind_check;
ALTER TABLE class_messages ADD CONSTRAINT class_messages_channel_kind_check
  CHECK (channel_kind IN ('CLASS', 'DIRECT'));
ALTER TABLE class_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE class_messages DROP CONSTRAINT IF EXISTS class_messages_channel_shape;
ALTER TABLE class_messages ADD CONSTRAINT class_messages_channel_shape
  CHECK (
    (channel_kind = 'DIRECT' AND recipient_id IS NOT NULL)
    OR (channel_kind = 'CLASS' AND recipient_id IS NULL)
  );

CREATE TABLE IF NOT EXISTS digital_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  term text NOT NULL CHECK (char_length(term) BETWEEN 2 AND 32),
  subject_code text NOT NULL CHECK (char_length(subject_code) BETWEEN 2 AND 16),
  score numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 10),
  source text NOT NULL CHECK (source IN ('STUDENT', 'SCHOOL', 'PORTAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, term, subject_code, source)
);

CREATE TABLE IF NOT EXISTS learner_knowledge_cards (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  canonical jsonb NOT NULL DEFAULT '{}'::jsonb,
  free_text text NOT NULL DEFAULT '' CHECK (char_length(free_text) <= 4000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE education_institutions ADD COLUMN IF NOT EXISTS employment_rate numeric(5,2);
ALTER TABLE education_institutions ADD COLUMN IF NOT EXISTS tuition_band text;
ALTER TABLE education_institutions ADD COLUMN IF NOT EXISTS ranking text;
ALTER TABLE education_institutions ADD COLUMN IF NOT EXISTS accreditation text;
ALTER TABLE education_institutions ADD COLUMN IF NOT EXISTS coverage jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS class_messages_class_channel_idx ON class_messages (school_id, class_id, channel_kind, created_at);
CREATE INDEX IF NOT EXISTS digital_transcripts_user_idx ON digital_transcripts (school_id, user_id, term);

DO $$
DECLARE
  tenant_tables text[] := ARRAY['digital_transcripts', 'learner_knowledge_cards'];
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
