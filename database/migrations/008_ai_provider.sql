-- Phase 6A: cấu hình giá token cho model AI (VND / 1.000 token). Forward-only.
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS input_vnd_per_1k integer NOT NULL DEFAULT 0 CHECK (input_vnd_per_1k >= 0);
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS output_vnd_per_1k integer NOT NULL DEFAULT 0 CHECK (output_vnd_per_1k >= 0);
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ai_usage_logs_school_created_idx ON ai_usage_logs (school_id, created_at DESC);
