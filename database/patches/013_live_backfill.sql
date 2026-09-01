-- Apply on existing Docker volumes that already ran 001–012.
-- Same SQL as database/migrations/013_ai_sessions_context.sql

ALTER TABLE ai_sessions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE ai_sessions ADD COLUMN IF NOT EXISTS token_count integer NOT NULL DEFAULT 0;
ALTER TABLE ai_sessions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE ai_sessions ADD COLUMN IF NOT EXISTS parent_session_id uuid REFERENCES ai_sessions(id) ON DELETE SET NULL;
ALTER TABLE ai_sessions ADD COLUMN IF NOT EXISTS context_refs jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ai_sessions DROP CONSTRAINT IF EXISTS ai_sessions_status_check;
ALTER TABLE ai_sessions ADD CONSTRAINT ai_sessions_status_check CHECK (status IN ('active', 'overflow', 'archived'));

CREATE TABLE IF NOT EXISTS ai_tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  tool_name text NOT NULL CHECK (char_length(tool_name) BETWEEN 2 AND 80),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_tool_runs_session_idx ON ai_tool_runs (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_sessions_user_updated_idx ON ai_sessions (school_id, user_id, created_at DESC);

DO $$
DECLARE
  tenant_tables text[] := ARRAY['ai_tool_runs'];
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
