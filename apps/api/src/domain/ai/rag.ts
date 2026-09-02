/**
 * RAG thuần (không phụ thuộc pg/mạng): tách chunk, embedding cục bộ tất định, và xếp hạng cosine.
 *
 * Embedding cục bộ dùng "hashing trick" trên bag-of-words để có vector tất định, chạy offline,
 * miễn phí — đủ tốt cho truy hồi trong phạm vi một lớp/môn và bảo đảm chạy/test được local mà
 * không cần key provider. Khi cần chất lượng cao hơn có thể thay bằng embedding của provider
 * (cùng số chiều) — coi như tối ưu tùy chọn (backlog).
 */
export const EMBEDDING_DIM = 256;

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

/** Tách văn bản theo đoạn, gộp tới ~maxChars, có overlap để không mất ngữ cảnh ở ranh giới chunk. */
export function chunkText(raw: string, options: ChunkOptions = {}): string[] {
  const maxChars = Math.max(200, options.maxChars ?? 1200);
  const overlap = Math.max(0, Math.min(options.overlapChars ?? 150, Math.floor(maxChars / 2)));
  // eslint-disable-next-line no-control-regex -- NUL is removed before chunking untrusted text.
  const normalized = (raw ?? '').replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
  if (normalized.length === 0) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
  const chunks: string[] = [];
  let current = '';

  const flush = (): void => {
    const trimmed = current.trim();
    if (trimmed.length > 0) chunks.push(trimmed);
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush();
      for (let start = 0; start < paragraph.length; start += maxChars - overlap) {
        chunks.push(paragraph.slice(start, start + maxChars).trim());
        if (start + maxChars >= paragraph.length) break;
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > maxChars) flush();
    current = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
  }
  flush();
  return chunks.filter((chunk) => chunk.length > 0);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Chuẩn hóa: bỏ dấu tiếng Việt để tăng khớp, tách token chữ-số, loại token quá ngắn. */
export function tokenize(text: string): string[] {
  const lowered = (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  return lowered.match(/[a-z0-9]+/g)?.filter((token) => token.length >= 2) ?? [];
}

/** Embedding cục bộ tất định (hashing trick, chuẩn hóa L2). Cùng input → cùng vector. */
export function localEmbed(text: string, dim = EMBEDDING_DIM): number[] {
  const vector = new Array<number>(dim).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const bucket = hashToken(token) % dim;
    const sign = (hashToken(`${token}#`) % 2) === 0 ? 1 : -1;
    vector[bucket] += sign;
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RankableChunk {
  id: string;
  embedding: readonly number[];
}

export interface RankedChunk {
  id: string;
  score: number;
}

/** Xếp hạng chunk theo cosine với vector truy vấn; lọc theo ngưỡng tối thiểu và giới hạn topK. */
export const DEFAULT_MIN_RETRIEVAL_SCORE = 0.3;

export function rankChunks(queryVector: readonly number[], chunks: readonly RankableChunk[], topK = 5, minScore = DEFAULT_MIN_RETRIEVAL_SCORE): RankedChunk[] {
  return chunks
    .map((chunk) => ({ id: chunk.id, score: cosineSimilarity(queryVector, chunk.embedding) }))
    .filter((ranked) => ranked.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK));
}

/** Trích văn bản đọc được từ nội dung bài giảng (jsonb). Hỗ trợ cấu trúc {blocks:[{text}]} hoặc {text}. */
export function extractLessonText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const record = content as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.summary === 'string') parts.push(record.summary);
  if (typeof record.text === 'string') parts.push(record.text);
  if (typeof record.body === 'string') parts.push(record.body);
  if (Array.isArray(record.blocks)) {
    for (const block of record.blocks) {
      if (block && typeof block === 'object' && typeof (block as Record<string, unknown>).text === 'string') {
        parts.push((block as Record<string, unknown>).text as string);
      } else if (typeof block === 'string') {
        parts.push(block);
      }
    }
  }
  if (Array.isArray(record.sections)) {
    for (const section of record.sections) {
      if (section && typeof section === 'object') {
        const s = section as Record<string, unknown>;
        if (typeof s.title === 'string') parts.push(s.title);
        if (typeof s.content === 'string') parts.push(s.content);
      }
    }
  }
  return parts.join('\n\n').trim();
}
