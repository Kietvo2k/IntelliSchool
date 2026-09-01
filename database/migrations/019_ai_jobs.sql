-- Durable asynchronous AI jobs for long-running Thinking turns. Forward-only.
CREATE TABLE IF NOT EXISTS ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES ai_sessions(id) ON DELETE SET NULL,
  input jsonb NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  stage text NOT NULL DEFAULT 'QUEUED',
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_jobs_school_user_created_idx ON ai_jobs (school_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_jobs_queue_idx ON ai_jobs (status, created_at);
GRANT SELECT, INSERT, UPDATE ON ai_jobs TO smartpath_api, smartpath_control;
GRANT TRUNCATE ON ai_jobs TO smartpath_control;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_jobs_tenant ON ai_jobs FOR ALL TO smartpath_api
  USING (school_id = app_current_school_id()) WITH CHECK (school_id = app_current_school_id());
CREATE POLICY ai_jobs_control ON ai_jobs FOR ALL TO smartpath_control USING (true) WITH CHECK (true);
