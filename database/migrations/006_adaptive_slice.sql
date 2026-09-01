-- Phase 4A: adaptive learning authoring slice. Forward-only.
-- Bổ sung quy trình soạn/duyệt bốn mắt cho skill_graphs mà không đụng dữ liệu cũ.

DO $$ BEGIN
  CREATE TYPE skill_graph_status AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE skill_graphs ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE skill_graphs ADD COLUMN IF NOT EXISTS status skill_graph_status NOT NULL DEFAULT 'DRAFT';
ALTER TABLE skill_graphs ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE skill_graphs ADD COLUMN IF NOT EXISTS review_reason text CHECK (review_reason IS NULL OR char_length(review_reason) <= 2000);
ALTER TABLE skill_graphs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Đồ thị đã duyệt trước migration này (nếu có) coi là APPROVED để giữ nguyên hành vi cũ.
UPDATE skill_graphs SET status = 'APPROVED' WHERE approved_at IS NOT NULL AND status = 'DRAFT';

-- Duyệt bốn mắt vẫn được kiểm ở tầng API; ràng buộc DB chỉ đảm bảo metadata nhất quán.
ALTER TABLE skill_graphs DROP CONSTRAINT IF EXISTS skill_graphs_approval_metadata_check;
ALTER TABLE skill_graphs ADD CONSTRAINT skill_graphs_approval_metadata_check CHECK (
  (status = 'APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  OR (status <> 'APPROVED' AND approved_by IS NULL AND approved_at IS NULL)
);

CREATE INDEX IF NOT EXISTS skill_graphs_subject_status_idx ON skill_graphs (school_id, subject_id, status, version DESC);
CREATE INDEX IF NOT EXISTS skill_item_mappings_graph_idx ON skill_item_mappings (school_id, skill_graph_id, skill_code);
