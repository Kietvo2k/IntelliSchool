-- Server-authoritative integrity incidents. Forward-only; event history is retained.

CREATE TABLE IF NOT EXISTS exam_integrity_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('GRACE', 'WARNING', 'LOCKED')),
  started_at timestamptz NOT NULL,
  last_signal_at timestamptz NOT NULL,
  grace_ends_at timestamptz NOT NULL,
  lock_at timestamptz NOT NULL,
  locked_at timestamptz,
  closed_at timestamptz,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  close_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (grace_ends_at >= started_at),
  CHECK (lock_at >= grace_ends_at)
);

CREATE INDEX IF NOT EXISTS exam_integrity_incidents_open_idx
  ON exam_integrity_incidents (session_id, closed_at, started_at DESC);

ALTER TABLE exam_integrity_events
  ADD COLUMN IF NOT EXISTS signal_id text,
  ADD COLUMN IF NOT EXISTS server_now timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS exam_integrity_events_signal_idx
  ON exam_integrity_events (session_id, signal_id)
  WHERE signal_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON exam_integrity_incidents TO smartpath_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON exam_integrity_incidents TO smartpath_control;
GRANT SELECT, INSERT ON exam_integrity_events TO smartpath_api;
REVOKE DELETE, UPDATE ON exam_integrity_events FROM smartpath_api;

ALTER TABLE exam_integrity_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_integrity_incidents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_integrity_incidents_tenant ON exam_integrity_incidents;
CREATE POLICY exam_integrity_incidents_tenant ON exam_integrity_incidents FOR ALL TO smartpath_api
  USING (school_id = app_current_school_id())
  WITH CHECK (school_id = app_current_school_id());
DROP POLICY IF EXISTS exam_integrity_incidents_control ON exam_integrity_incidents;
CREATE POLICY exam_integrity_incidents_control ON exam_integrity_incidents FOR ALL TO smartpath_control
  USING (true) WITH CHECK (true);

