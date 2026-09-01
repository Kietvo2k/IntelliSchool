-- Short-lived, single-use server grants for essay file pickers. Forward-only.
CREATE TABLE IF NOT EXISTS exam_attachment_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_attachment_exemptions_lookup_idx
  ON exam_attachment_exemptions (session_id, user_id, expires_at);

GRANT SELECT, INSERT, UPDATE ON exam_attachment_exemptions TO smartpath_api, smartpath_control;
GRANT TRUNCATE ON exam_attachment_exemptions TO smartpath_control;

ALTER TABLE exam_attachment_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attachment_exemptions FORCE ROW LEVEL SECURITY;
CREATE POLICY exam_attachment_exemptions_tenant ON exam_attachment_exemptions FOR ALL TO smartpath_api
  USING (school_id = app_current_school_id()) WITH CHECK (school_id = app_current_school_id());
CREATE POLICY exam_attachment_exemptions_control ON exam_attachment_exemptions FOR ALL TO smartpath_control
  USING (true) WITH CHECK (true);
