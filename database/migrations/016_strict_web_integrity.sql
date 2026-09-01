-- Strict web integrity policy and incident classification. Forward-only.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS integrity_mode text NOT NULL DEFAULT 'PRACTICE';

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_integrity_mode_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_integrity_mode_check
  CHECK (integrity_mode IN ('PRACTICE', 'STRICT_WEB'));

UPDATE assignments
SET integrity_mode = 'STRICT_WEB'
WHERE delivery_mode = 'EXAM' AND integrity_mode = 'PRACTICE';

ALTER TABLE exam_integrity_events
  ADD COLUMN IF NOT EXISTS incident_id text,
  ADD COLUMN IF NOT EXISTS counted boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reason text;

CREATE INDEX IF NOT EXISTS exam_integrity_events_session_incident_idx
  ON exam_integrity_events (session_id, incident_id, occurred_at);
