-- Private learner uploads and moderated school-library contributions. Forward-only.
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'CLASS',
  ADD COLUMN IF NOT EXISTS contribution_status text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_visibility_check;
ALTER TABLE resources ADD CONSTRAINT resources_visibility_check
  CHECK (visibility IN ('PRIVATE', 'CLASS', 'SCHOOL'));
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_contribution_status_check;
ALTER TABLE resources ADD CONSTRAINT resources_contribution_status_check
  CHECK (contribution_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS resources_owner_visibility_idx
  ON resources (school_id, owner_user_id, visibility, status, created_at DESC);
