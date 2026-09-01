-- Phase 6B: RAG ingestion. Forward-only.
-- Lưu embedding dạng real[] để chạy được trên PostgreSQL chuẩn (KHÔNG bắt buộc pgvector).
-- Truy hồi cosine chạy ở tầng ứng dụng trên tập chunk đã lọc theo trường/lớp/môn (RLS bảo vệ).
-- pgvector là tối ưu tùy chọn cho quy mô lớn (đưa vào backlog, không cần cho chạy/test local).

-- Cho phép nạp tri thức từ bài giảng hoặc văn bản dán trực tiếp (không bắt buộc phải có file resource đã quét).
ALTER TABLE rag_documents ALTER COLUMN resource_id DROP NOT NULL;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'TEXT' CHECK (source_kind IN ('RESOURCE', 'LESSON', 'TEXT'));
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS chunk_count integer NOT NULL DEFAULT 0 CHECK (chunk_count >= 0);
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- Một nguồn phải có ít nhất một trong: resource / lesson / văn bản thô (source_kind='TEXT').
ALTER TABLE rag_documents DROP CONSTRAINT IF EXISTS rag_documents_source_present;
ALTER TABLE rag_documents ADD CONSTRAINT rag_documents_source_present
  CHECK (resource_id IS NOT NULL OR lesson_id IS NOT NULL OR source_kind = 'TEXT');

ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS embedding real[];
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS embedding_dim integer;

CREATE INDEX IF NOT EXISTS rag_documents_scope_idx ON rag_documents (school_id, class_id, subject_id, status);
