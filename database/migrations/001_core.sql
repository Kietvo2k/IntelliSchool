CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE smart_path_role AS ENUM ('PLATFORM_ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT');
CREATE TYPE school_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
CREATE TYPE class_teacher_role AS ENUM ('SUBJECT_TEACHER', 'HOMEROOM_TEACHER');
CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE resource_status AS ENUM ('QUARANTINED', 'PROCESSING', 'READY', 'REJECTED');
CREATE TYPE question_type AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY');
CREATE TYPE assignment_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'RETURNED');
CREATE TYPE assessment_mark_source AS ENUM ('AUTO', 'TEACHER', 'OVERRIDE');
CREATE TYPE billing_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE job_status AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'REJECTED');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  avatar_object_key text,
  profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE password_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL, must_change_password boolean NOT NULL DEFAULT false,
  password_changed_at timestamptz NOT NULL DEFAULT now(), failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0), locked_until timestamptz
);
CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_admins (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE school_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_name text NOT NULL CHECK (char_length(school_name) BETWEEN 3 AND 160),
  principal_name text NOT NULL CHECK (char_length(principal_name) BETWEEN 3 AND 120), principal_email citext NOT NULL,
  province text NOT NULL CHECK (char_length(province) BETWEEN 2 AND 100), status school_request_status NOT NULL DEFAULT 'PENDING',
  review_reason text, reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK (code ~ '^SP-[A-Z0-9]{8}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 160), province text NOT NULL CHECK (char_length(province) BETWEEN 2 AND 100),
  owner_id uuid NOT NULL REFERENCES users(id), approved_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE, active_school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  revoked_at timestamptz, ip_hash bytea, user_agent_hash bytea
);
CREATE TABLE school_settings (
  school_id uuid PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE, class_quota integer NOT NULL DEFAULT 30 CHECK (class_quota >= 0),
  trial_ends_at timestamptz, ai_enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE school_memberships (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role smart_path_role NOT NULL CHECK (role IN ('SCHOOL_OWNER', 'TEACHER', 'STUDENT')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (school_id, user_id)
);
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role smart_path_role NOT NULL CHECK (role IN ('SCHOOL_OWNER', 'TEACHER')),
  token_hash bytea NOT NULL UNIQUE, status invitation_status NOT NULL DEFAULT 'PENDING', expires_at timestamptz NOT NULL,
  accepted_at timestamptz, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{2,32}$'), name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (school_id, code)
);
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (char_length(code) BETWEEN 2 AND 64), name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  grade_level integer CHECK (grade_level BETWEEN 10 AND 12), school_year text NOT NULL CHECK (char_length(school_year) BETWEEN 4 AND 24),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (school_id, code, school_year)
);
CREATE TABLE class_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE, role class_teacher_role NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'SUBJECT_TEACHER' AND subject_id IS NOT NULL) OR (role = 'HOMEROOM_TEACHER' AND subject_id IS NULL)),
  UNIQUE (class_id, teacher_id, subject_id, role)
);
CREATE TABLE student_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_code text NOT NULL CHECK (student_code ~ '^[A-Z0-9-]{8,64}$'), roster_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  identity_fingerprint bytea, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (school_id, student_code)
);
CREATE TABLE class_enrollments (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, status enrollment_status NOT NULL DEFAULT 'ACTIVE', enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);
CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200), content jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz, created_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL, subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL, object_key text NOT NULL UNIQUE, original_name text NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL, byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 52428800), sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  status resource_status NOT NULL DEFAULT 'QUARANTINED', uploaded_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE question_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 160),
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE questions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, bank_id uuid NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE, current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0), created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE question_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE, version integer NOT NULL CHECK (version > 0), type question_type NOT NULL,
  prompt jsonb NOT NULL, answer_key jsonb NOT NULL DEFAULT '{}'::jsonb, rubric jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_score numeric(6,2) NOT NULL CHECK (max_score > 0), is_approved boolean NOT NULL DEFAULT false, created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (question_id, version)
);
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200), instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 10000),
  status assignment_status NOT NULL DEFAULT 'DRAFT', due_at timestamptz, created_by uuid NOT NULL REFERENCES users(id), published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE assignment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE, question_version_id uuid NOT NULL REFERENCES question_versions(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0), points numeric(6,2) NOT NULL CHECK (points > 0), UNIQUE (assignment_id, position)
);
CREATE TABLE assignment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE, student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status attempt_status NOT NULL DEFAULT 'IN_PROGRESS', attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 200), started_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
  UNIQUE (student_id, assignment_id, attempt_number), UNIQUE (student_id, idempotency_key)
);
CREATE TABLE submission_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES assignment_attempts(id) ON DELETE CASCADE, assignment_item_id uuid NOT NULL REFERENCES assignment_items(id) ON DELETE CASCADE,
  answer jsonb NOT NULL DEFAULT '{}'::jsonb, auto_score numeric(6,2), teacher_score numeric(6,2), feedback text NOT NULL DEFAULT '' CHECK (char_length(feedback) <= 10000),
  marked_by uuid REFERENCES users(id), marked_at timestamptz, UNIQUE (attempt_id, assignment_item_id)
);
CREATE TABLE gradebook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  score numeric(6,2) NOT NULL CHECK (score >= 0), max_score numeric(6,2) NOT NULL CHECK (max_score > 0), source assessment_mark_source NOT NULL,
  recorded_by uuid REFERENCES users(id), recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE skill_graphs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, version integer NOT NULL CHECK (version > 0), definition jsonb NOT NULL,
  approved_at timestamptz, approved_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (school_id, subject_id, version)
);
CREATE TABLE skill_item_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  skill_graph_id uuid NOT NULL REFERENCES skill_graphs(id) ON DELETE CASCADE, question_version_id uuid NOT NULL REFERENCES question_versions(id) ON DELETE CASCADE,
  skill_code text NOT NULL CHECK (char_length(skill_code) BETWEEN 1 AND 120), weight numeric(5,4) NOT NULL CHECK (weight > 0 AND weight <= 1),
  UNIQUE (skill_graph_id, question_version_id, skill_code)
);
CREATE TABLE learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL, event_key text NOT NULL CHECK (char_length(event_key) BETWEEN 8 AND 200),
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 100), payload jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, event_key)
);
CREATE TABLE adaptive_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  skill_graph_id uuid REFERENCES skill_graphs(id) ON DELETE SET NULL, diagnosis jsonb NOT NULL, evidence jsonb NOT NULL,
  is_actionable boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teacher_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 2000),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE offline_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, client_event_id text NOT NULL CHECK (char_length(client_event_id) BETWEEN 8 AND 200),
  payload jsonb NOT NULL, status job_status NOT NULL DEFAULT 'QUEUED', conflict jsonb, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  UNIQUE (user_id, client_event_id)
);

CREATE TABLE careers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{2,64}$'), name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160), description text NOT NULL DEFAULT '', riasec_weights jsonb NOT NULL DEFAULT '{}'::jsonb, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE majors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{2,64}$'), name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160), career_id uuid REFERENCES careers(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE education_institutions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{2,64}$'), name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 240), province text, type text NOT NULL DEFAULT 'UNIVERSITY', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE institution_majors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL REFERENCES education_institutions(id) ON DELETE CASCADE, major_id uuid NOT NULL REFERENCES majors(id) ON DELETE CASCADE, program_code text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (institution_id, major_id, program_code));
CREATE TABLE admission_scores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_major_id uuid NOT NULL REFERENCES institution_majors(id) ON DELETE CASCADE, year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100), score numeric(6,2) NOT NULL CHECK (score >= 0 AND score <= 100), source_url text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (institution_major_id, year));
CREATE TABLE scholarships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid REFERENCES education_institutions(id) ON DELETE SET NULL, title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 240), criteria jsonb NOT NULL DEFAULT '{}'::jsonb, deadline_at timestamptz, source_url text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE career_profiles (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, academic_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, consent_to_share boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE career_assessments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind text NOT NULL CHECK (kind IN ('RIASEC', 'APTITUDE')), answers jsonb NOT NULL, scores jsonb NOT NULL, completed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE career_results (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, career_id uuid REFERENCES careers(id) ON DELETE SET NULL, score numeric(7,4) NOT NULL, evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE career_share_grants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, scope text NOT NULL CHECK (scope IN ('PROFILE', 'RESULTS', 'FULL')), granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, UNIQUE (school_id, user_id, scope));
CREATE TABLE aspirations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, institution_major_id uuid REFERENCES institution_majors(id) ON DELETE SET NULL, priority integer NOT NULL CHECK (priority > 0), note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, priority));
CREATE TABLE saved_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_type text NOT NULL CHECK (item_type IN ('CAREER', 'MAJOR', 'INSTITUTION', 'SCHOLARSHIP')), item_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, item_type, item_id));
CREATE TABLE goals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 240), target_at timestamptz, status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE reminders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, goal_id uuid REFERENCES goals(id) ON DELETE CASCADE, due_at timestamptz NOT NULL, message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500), completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE ai_models (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid REFERENCES schools(id) ON DELETE CASCADE, provider text NOT NULL CHECK (char_length(provider) BETWEEN 2 AND 80), model_name text NOT NULL CHECK (char_length(model_name) BETWEEN 2 AND 160), tier text NOT NULL CHECK (tier IN ('LOCAL_FAST', 'LOCAL_QUALITY', 'CLOUD')), endpoint_url text, is_enabled boolean NOT NULL DEFAULT true, monthly_cost_limit_vnd bigint, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE rag_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, class_id uuid REFERENCES classes(id) ON DELETE SET NULL, subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL, resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE, status job_status NOT NULL DEFAULT 'QUEUED', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE rag_chunks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, document_id uuid NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE, class_id uuid REFERENCES classes(id) ON DELETE SET NULL, subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL, ordinal integer NOT NULL CHECK (ordinal >= 0), content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000), embedding_reference text, citation jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (document_id, ordinal));
CREATE TABLE ai_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose text NOT NULL CHECK (char_length(purpose) BETWEEN 2 AND 100), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ai_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, session_id uuid NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')), content text NOT NULL CHECK (char_length(content) <= 20000), citations jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ai_usage_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid REFERENCES schools(id) ON DELETE SET NULL, user_id uuid REFERENCES users(id) ON DELETE SET NULL, model_id uuid REFERENCES ai_models(id) ON DELETE SET NULL, operation text NOT NULL, input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0), output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0), estimated_cost_vnd bigint NOT NULL DEFAULT 0 CHECK (estimated_cost_vnd >= 0), created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE, status billing_status NOT NULL DEFAULT 'TRIAL', included_class_quota integer NOT NULL DEFAULT 30 CHECK (included_class_quota >= 0), base_price_vnd bigint NOT NULL DEFAULT 1000000000 CHECK (base_price_vnd >= 0), extra_class_price_vnd bigint NOT NULL DEFAULT 50000000 CHECK (extra_class_price_vnd >= 0), trial_ends_at timestamptz, manual_override_reason text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE billing_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, actor_id uuid REFERENCES users(id) ON DELETE SET NULL, kind text NOT NULL CHECK (char_length(kind) BETWEEN 2 AND 100), amount_vnd bigint NOT NULL DEFAULT 0, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE platform_contact_settings (id boolean PRIMARY KEY DEFAULT true CHECK (id), zalo_url text, facebook_url text, updated_by uuid REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE data_import_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid REFERENCES schools(id) ON DELETE SET NULL, kind text NOT NULL, status job_status NOT NULL DEFAULT 'QUEUED', source_reference text, requested_by uuid REFERENCES users(id) ON DELETE SET NULL, result jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz);
CREATE TABLE crawl_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), host text NOT NULL UNIQUE CHECK (host ~ '^[a-z0-9.-]+$'), is_enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE crawl_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES crawl_sources(id) ON DELETE CASCADE, requested_url text NOT NULL, status job_status NOT NULL DEFAULT 'QUEUED', requested_by uuid REFERENCES users(id) ON DELETE SET NULL, result jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz);
CREATE TABLE audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid REFERENCES schools(id) ON DELETE SET NULL, actor_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL CHECK (char_length(action) BETWEEN 2 AND 120), target_type text NOT NULL CHECK (char_length(target_type) BETWEEN 2 AND 120), target_id text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER lessons_set_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER assignments_set_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER school_settings_set_updated_at BEFORE UPDATE ON school_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON platform_contact_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_sessions_token_active ON sessions (token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_school_requests_status_created ON school_requests (status, created_at DESC);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE UNIQUE INDEX uq_student_identity_fingerprint ON student_profiles(school_id, identity_fingerprint) WHERE identity_fingerprint IS NOT NULL;
CREATE INDEX idx_teacher_assignment ON class_teacher_assignments(school_id, teacher_id);
CREATE INDEX idx_gradebook_student ON gradebook_entries(school_id, student_id, subject_id, recorded_at DESC);
CREATE INDEX idx_learning_events_student ON learning_events(school_id, student_id, occurred_at DESC);
CREATE INDEX idx_career_results_student ON career_results(school_id, user_id, created_at DESC);
CREATE INDEX idx_rag_chunks_scope ON rag_chunks(school_id, class_id, subject_id);
CREATE INDEX idx_audit_events_scope ON audit_events(school_id, created_at DESC);



