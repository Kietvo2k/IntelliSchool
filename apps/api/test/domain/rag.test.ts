import { describe, expect, it } from 'vitest';
import {
  chunkText,
  cosineSimilarity,
  EMBEDDING_DIM,
  extractLessonText,
  localEmbed,
  rankChunks,
  tokenize,
} from '../../src/domain/ai/rag.js';

describe('RAG chunking', () => {
  it('splits text into chunks bounded by maxChars', () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Đoạn ${i} `.repeat(40)).join('\n\n');
    const chunks = chunkText(paragraphs, { maxChars: 400, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(400);
  });

  it('returns empty array for blank input', () => {
    expect(chunkText('   \n\n  ')).toEqual([]);
  });
});

describe('local embedding', () => {
  it('is deterministic and L2-normalized', () => {
    const a = localEmbed('quang hợp là quá trình cây xanh tạo chất hữu cơ');
    const b = localEmbed('quang hợp là quá trình cây xanh tạo chất hữu cơ');
    expect(a).toEqual(b);
    expect(a.length).toBe(EMBEDDING_DIM);
    const norm = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('ranks semantically closer chunk higher for a query', () => {
    const query = localEmbed('phương trình bậc hai có nghiệm khi nào');
    const relevant = { id: 'math', embedding: localEmbed('phương trình bậc hai có nghiệm khi delta không âm') };
    const irrelevant = { id: 'bio', embedding: localEmbed('tế bào thực vật có thành xenlulozo') };
    const ranked = rankChunks(query, [irrelevant, relevant], 2, 0);
    expect(ranked[0]!.id).toBe('math');
  });

  it('cosine of identical vectors is 1', () => {
    const vector = localEmbed('kiểm tra cosine');
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 5);
  });
});

describe('tokenize + lesson extraction', () => {
  it('strips Vietnamese accents and short tokens', () => {
    expect(tokenize('Hóa học đường')).toEqual(['hoa', 'hoc', 'duong']);
  });

  it('extracts readable text from lesson json blocks', () => {
    const text = extractLessonText({ summary: 'Tóm tắt', blocks: [{ text: 'Nội dung 1' }, 'Nội dung 2'] });
    expect(text).toContain('Tóm tắt');
    expect(text).toContain('Nội dung 1');
    expect(text).toContain('Nội dung 2');
  });
});
