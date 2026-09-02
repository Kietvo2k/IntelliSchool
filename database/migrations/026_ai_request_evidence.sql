-- AI runtime evidence and cancellation correlation. Forward-only.
ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS request_id text;
UPDATE ai_jobs SET request_id = gen_random_uuid()::text WHERE request_id IS NULL;
ALTER TABLE ai_jobs ALTER COLUMN request_id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE ai_jobs ALTER COLUMN request_id SET NOT NULL;

ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS request_id text;
CREATE INDEX IF NOT EXISTS ai_jobs_request_idx ON ai_jobs (request_id);
CREATE INDEX IF NOT EXISTS ai_usage_logs_request_idx ON ai_usage_logs (school_id, request_id);
