-- Phase 5A: catalog hướng nghiệp. Forward-only, không đụng dữ liệu cũ.
-- Bổ sung tổ hợp thi cho điểm chuẩn và trường chi tiết cho trường ĐH/CĐ.

ALTER TABLE admission_scores ADD COLUMN IF NOT EXISTS exam_block text
  CHECK (exam_block IS NULL OR exam_block ~ '^[A-Z][0-9]{2}$');

-- Cho phép nhiều tổ hợp cho cùng (ngành, năm). Nới UNIQUE cũ nếu còn tồn tại.
DO $$ BEGIN
  ALTER TABLE admission_scores DROP CONSTRAINT IF EXISTS admission_scores_institution_major_id_year_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS admission_scores_program_year_block_idx
  ON admission_scores (institution_major_id, year, coalesce(exam_block, ''));

ALTER TABLE education_institutions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE education_institutions ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE education_institutions ADD COLUMN IF NOT EXISTS admission_method text;

CREATE INDEX IF NOT EXISTS admission_scores_program_idx ON admission_scores (institution_major_id, year DESC);
CREATE INDEX IF NOT EXISTS education_institutions_province_idx ON education_institutions (province);
