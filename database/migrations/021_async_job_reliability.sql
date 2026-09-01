-- Durable lease and retry metadata for asynchronous AI/report work. Forward-only.
ALTER TABLE ai_jobs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS requested_model text,
  ADD COLUMN IF NOT EXISTS used_model text,
  ADD COLUMN IF NOT EXISTS is_fallback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  ADD COLUMN IF NOT EXISTS output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  ADD COLUMN IF NOT EXISTS estimated_cost_vnd bigint NOT NULL DEFAULT 0 CHECK (estimated_cost_vnd >= 0),
  ADD COLUMN IF NOT EXISTS tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS requested_model text,
  ADD COLUMN IF NOT EXISTS used_model text,
  ADD COLUMN IF NOT EXISTS is_fallback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES ai_jobs(id) ON DELETE SET NULL;

ALTER TABLE career_assessment_drafts DROP CONSTRAINT IF EXISTS career_assessment_drafts_assessment_kind_check;
ALTER TABLE career_assessment_drafts ADD CONSTRAINT career_assessment_drafts_assessment_kind_check
  CHECK (assessment_kind IN ('APTITUDE', 'RIASEC', 'EXTRACURRICULAR'));
ALTER TABLE career_assessment_drafts DROP CONSTRAINT IF EXISTS career_assessment_drafts_current_index_check;
ALTER TABLE career_assessment_drafts ADD CONSTRAINT career_assessment_drafts_current_index_check CHECK (current_index BETWEEN 0 AND 200);

CREATE INDEX IF NOT EXISTS ai_jobs_claim_idx ON ai_jobs (status, next_attempt_at, created_at)
  WHERE status IN ('QUEUED', 'RUNNING');
