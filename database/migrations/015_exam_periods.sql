-- Kỳ thi và trạng thái finalize cho phòng thi CBT. Forward-only.

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS exam_period text NOT NULL DEFAULT 'PRACTICE';

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_exam_period_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_exam_period_check
  CHECK (exam_period IN ('PRACTICE', 'MIDTERM_1', 'FINAL_1', 'MIDTERM_2', 'FINAL_2', 'MOCK_GRADUATION', 'OTHER'));

UPDATE assignments
SET exam_period = 'MOCK_GRADUATION'
WHERE delivery_mode = 'EXAM'
  AND exam_period = 'PRACTICE'
  AND lower(title) LIKE 'thi thử%';

ALTER TABLE exam_sessions
  ADD COLUMN IF NOT EXISTS lock_reason text,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalization_reason text;

CREATE INDEX IF NOT EXISTS assignments_exam_period_idx
  ON assignments (school_id, class_id, delivery_mode, exam_period, status, due_at);
