-- Immutable encrypted exam snapshots and session pinning. Forward-only.
-- Key material is intentionally not stored in PostgreSQL; application code reads
-- it from an external keyring before publishing/backfilling/rotating a snapshot.

CREATE TABLE IF NOT EXISTS exam_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  snapshot_version integer NOT NULL CHECK (snapshot_version > 0),
  encryption_revision integer NOT NULL DEFAULT 1 CHECK (encryption_revision > 0),
  ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) > 0),
  nonce bytea NOT NULL CHECK (octet_length(nonce) = 12),
  auth_tag bytea NOT NULL CHECK (octet_length(auth_tag) = 16),
  key_version text NOT NULL CHECK (char_length(key_version) BETWEEN 1 AND 120),
  metadata_hash char(64) NOT NULL CHECK (metadata_hash ~ '^[a-f0-9]{64}$'),
  metadata jsonb NOT NULL,
  supersedes_snapshot_id uuid REFERENCES exam_snapshots(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, snapshot_version, encryption_revision),
  UNIQUE (assignment_id, snapshot_version, key_version, encryption_revision)
);

CREATE INDEX IF NOT EXISTS exam_snapshots_assignment_idx
  ON exam_snapshots (school_id, assignment_id, snapshot_version, encryption_revision DESC);

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS active_exam_snapshot_id uuid REFERENCES exam_snapshots(id) ON DELETE RESTRICT;

ALTER TABLE exam_sessions
  ADD COLUMN IF NOT EXISTS exam_snapshot_id uuid REFERENCES exam_snapshots(id) ON DELETE RESTRICT;

GRANT SELECT, INSERT ON exam_snapshots TO smartpath_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON exam_snapshots TO smartpath_control;
REVOKE UPDATE, DELETE ON exam_snapshots FROM smartpath_api;

ALTER TABLE exam_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_snapshots_tenant ON exam_snapshots;
CREATE POLICY exam_snapshots_tenant ON exam_snapshots FOR ALL TO smartpath_api
  USING (school_id = app_current_school_id())
  WITH CHECK (school_id = app_current_school_id());
DROP POLICY IF EXISTS exam_snapshots_control ON exam_snapshots;
CREATE POLICY exam_snapshots_control ON exam_snapshots FOR ALL TO smartpath_control
  USING (true) WITH CHECK (true);
