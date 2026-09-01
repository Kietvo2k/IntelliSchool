-- Phase 3: identity completion, LMS delivery, durable resource processing and exports.
-- This migration is forward-only. Existing Phase 1/2 endpoint contracts remain valid.

DO $$ BEGIN
  CREATE TYPE registration_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE lesson_progress_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE assignment_grading_policy AS ENUM ('HIGHEST', 'LATEST', 'AVERAGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE report_export_kind AS ENUM ('GRADEBOOK', 'PROGRESS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE report_export_format AS ENUM ('CSV', 'XLSX');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email citext NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  requested_role smart_path_role NOT NULL CHECK (requested_role IN ('TEACHER', 'STUDENT')),
  status registration_request_status NOT NULL DEFAULT 'PENDING',
  review_reason text CHECK (review_reason IS NULL OR char_length(review_reason) <= 2000),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, email, requested_role)
);
CREATE INDEX registration_requests_school_status_created_idx ON registration_requests (school_id, status, created_at DESC);

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('SCHOOL_OWNER', 'TEACHER', 'STUDENT'));

CREATE TABLE platform_admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  token_hash bytea NOT NULL UNIQUE,
  status invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, status)
);

CREATE TABLE lesson_progress (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status lesson_progress_status NOT NULL DEFAULT 'NOT_STARTED',
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, student_id),
  CHECK ((status = 'NOT_STARTED' AND completed_at IS NULL) OR status IN ('IN_PROGRESS', 'COMPLETED'))
);
CREATE INDEX lesson_progress_school_student_idx ON lesson_progress (school_id, student_id, status);

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE question_versions ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE question_versions ADD COLUMN IF NOT EXISTS approved_at timestamptz;
-- Preserve historical approvals while all new approvals are checked in the API.
UPDATE question_versions
  SET approved_by = created_by, approved_at = created_at
  WHERE is_approved = true AND (approved_by IS NULL OR approved_at IS NULL);
ALTER TABLE question_versions ADD CONSTRAINT question_versions_approval_metadata_check CHECK (
  (is_approved = false AND approved_by IS NULL AND approved_at IS NULL)
  OR (is_approved = true AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
);

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 10);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS grading_policy assignment_grading_policy NOT NULL DEFAULT 'HIGHEST';
ALTER TABLE assignment_attempts ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false;
ALTER TABLE assignment_attempts ADD COLUMN IF NOT EXISTS graded_at timestamptz;
ALTER TABLE assignment_attempts ADD COLUMN IF NOT EXISTS overall_feedback text NOT NULL DEFAULT '' CHECK (char_length(overall_feedback) <= 10000);
CREATE UNIQUE INDEX assignment_attempts_assignment_student_number_idx
  ON assignment_attempts (assignment_id, student_id, attempt_number);
CREATE UNIQUE INDEX gradebook_entries_official_assignment_student_idx
  ON gradebook_entries (assignment_id, student_id) WHERE assignment_id IS NOT NULL;

CREATE TABLE gradebook_entry_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gradebook_entry_id uuid NOT NULL REFERENCES gradebook_entries(id) ON DELETE CASCADE,
  previous_score numeric(6,2) NOT NULL CHECK (previous_score >= 0),
  next_score numeric(6,2) NOT NULL CHECK (next_score >= 0),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 2000),
  overridden_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gradebook_entry_revisions_school_entry_idx ON gradebook_entry_revisions (school_id, gradebook_entry_id, created_at DESC);

CREATE TABLE resource_scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  status job_status NOT NULL DEFAULT 'QUEUED',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id)
);
CREATE INDEX resource_scan_jobs_claim_idx ON resource_scan_jobs (status, created_at) WHERE status IN ('QUEUED', 'FAILED');

CREATE TABLE report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id),
  kind report_export_kind NOT NULL,
  format report_export_format NOT NULL,
  status job_status NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  object_key text UNIQUE,
  error_message text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  UNIQUE (school_id, requested_by, idempotency_key)
);
CREATE INDEX report_exports_school_requested_idx ON report_exports (school_id, requested_by, created_at DESC);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['registration_requests', 'lesson_progress', 'gradebook_entry_revisions', 'resource_scan_jobs', 'report_exports'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO smartpath_api', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE %I TO smartpath_control', table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO smartpath_api USING (school_id = app_current_school_id()) WITH CHECK (school_id = app_current_school_id())', table_name || '_tenant', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO smartpath_control USING (true) WITH CHECK (true)', table_name || '_control', table_name);
  END LOOP;
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON platform_admin_invitations TO smartpath_control;
END $$;

ALTER TABLE platform_admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_admin_invitations_control ON platform_admin_invitations FOR ALL TO smartpath_control USING (true) WITH CHECK (true);

-- `users` is global identity data. The API may resolve only people who belong to its
-- current school; platform/auth control-plane access continues to use smartpath_control.
GRANT SELECT ON users TO smartpath_api;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_directory ON users FOR SELECT TO smartpath_api
  USING (EXISTS (
    SELECT 1 FROM school_memberships sm
    WHERE sm.user_id = users.id AND sm.school_id = app_current_school_id()
  ));
CREATE POLICY users_control ON users FOR ALL TO smartpath_control USING (true) WITH CHECK (true);
