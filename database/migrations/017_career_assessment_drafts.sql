-- Versioned, tenant-scoped drafts for long-running career assessments. Forward-only.
CREATE TABLE IF NOT EXISTS career_assessment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_kind text NOT NULL CHECK (assessment_kind IN ('APTITUDE')),
  questionnaire_version text NOT NULL CHECK (char_length(questionnaire_version) BETWEEN 1 AND 32),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  skipped_ids text[] NOT NULL DEFAULT '{}',
  current_index integer NOT NULL DEFAULT 0 CHECK (current_index BETWEEN 0 AND 19),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, assessment_kind)
);

CREATE INDEX IF NOT EXISTS career_assessment_drafts_school_user_idx
  ON career_assessment_drafts (school_id, user_id, assessment_kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON career_assessment_drafts TO smartpath_api, smartpath_control;
GRANT TRUNCATE ON career_assessment_drafts TO smartpath_control;
ALTER TABLE career_assessment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_assessment_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY career_assessment_drafts_tenant ON career_assessment_drafts FOR ALL TO smartpath_api
  USING (school_id = app_current_school_id()) WITH CHECK (school_id = app_current_school_id());
CREATE POLICY career_assessment_drafts_control ON career_assessment_drafts FOR ALL TO smartpath_control
  USING (true) WITH CHECK (true);
