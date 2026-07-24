DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartpath_api') THEN
    CREATE ROLE smartpath_api LOGIN PASSWORD 'smartpath_api_local_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartpath_public') THEN
    CREATE ROLE smartpath_public LOGIN PASSWORD 'smartpath_public_local_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartpath_control') THEN
    CREATE ROLE smartpath_control LOGIN PASSWORD 'smartpath_control_local_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_current_school_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.school_id', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO smartpath_api, smartpath_public, smartpath_control;
GRANT INSERT ON school_requests TO smartpath_public;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO smartpath_control;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO smartpath_control;
GRANT SELECT ON careers, majors, education_institutions, institution_majors, admission_scores, scholarships TO smartpath_api;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON schools TO smartpath_api;
CREATE POLICY schools_tenant ON schools FOR ALL TO smartpath_api
  USING (id = app_current_school_id()) WITH CHECK (id = app_current_school_id());
CREATE POLICY schools_control ON schools FOR ALL TO smartpath_control USING (true) WITH CHECK (true);

DO $$
DECLARE
  tenant_tables text[] := ARRAY[
    'school_settings','school_memberships','invitations','subjects','classes','class_teacher_assignments','student_profiles','class_enrollments',
    'lessons','resources','question_banks','questions','question_versions','assignments','assignment_items','assignment_attempts','submission_answers','gradebook_entries',
    'skill_graphs','skill_item_mappings','learning_events','adaptive_diagnoses','teacher_overrides','offline_outbox',
    'career_profiles','career_assessments','career_results','career_share_grants','aspirations','saved_items','goals','reminders',
    'ai_models','rag_documents','rag_chunks','ai_sessions','ai_messages','ai_usage_logs','subscriptions','billing_events','audit_events'
  ];
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO smartpath_api', table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO smartpath_api USING (school_id = app_current_school_id()) WITH CHECK (school_id = app_current_school_id())', table_name || '_tenant', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO smartpath_control USING (true) WITH CHECK (true)', table_name || '_control', table_name);
  END LOOP;
END $$;

ALTER TABLE school_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY school_requests_public_insert ON school_requests FOR INSERT TO smartpath_public
  WITH CHECK (status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_reason IS NULL);
CREATE POLICY school_requests_control ON school_requests FOR ALL TO smartpath_control USING (true) WITH CHECK (true);



