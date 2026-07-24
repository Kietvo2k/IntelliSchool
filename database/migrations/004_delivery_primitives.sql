-- Delivery primitives added after the initial pilot schema. Existing tables and data remain untouched.
CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (char_length(operation) BETWEEN 3 AND 120),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX uq_idempotency_actor_operation_key
  ON idempotency_records(actor_id, operation, idempotency_key);
CREATE INDEX idx_idempotency_school_created
  ON idempotency_records(school_id, created_at DESC);

ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_records TO smartpath_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_records TO smartpath_control;
CREATE POLICY idempotency_records_tenant ON idempotency_records FOR ALL TO smartpath_api
  USING (school_id = app_current_school_id())
  WITH CHECK (school_id = app_current_school_id());
CREATE POLICY idempotency_records_control ON idempotency_records FOR ALL TO smartpath_control
  USING (true) WITH CHECK (true);

-- Correct the original schema defaults to the agreed pilot pricing in VND.
ALTER TABLE subscriptions ALTER COLUMN base_price_vnd SET DEFAULT 10000000;
ALTER TABLE subscriptions ALTER COLUMN extra_class_price_vnd SET DEFAULT 500000;
