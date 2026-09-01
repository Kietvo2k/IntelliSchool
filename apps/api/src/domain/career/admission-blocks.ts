/**
 * Tổ hợp xét tuyển: từ điển 98 mã 2025 + nhận mã ngoài list nếu khớp A00.
 * Điểm ưu tiên tối đa theo quy chế hiện hành là 2.75 (khung 30 điểm).
 */
import { EXAM_BLOCKS_2025, SUBJECT_ALIAS, type ExamBlock as CatalogBlock, type ExamSubjectCode } from './exam-blocks-2025.js';

export const MAX_PRIORITY_BONUS = 2.75;
export { EXAM_BLOCKS_2025, defaultBlocksForMajor } from './exam-blocks-2025.js';

export interface ExamBlock {
  code: string;
  subjects: readonly string[];
  label?: string;
}

export const EXAM_BLOCKS: readonly ExamBlock[] = EXAM_BLOCKS_2025;

const BLOCK_BY_CODE = new Map(EXAM_BLOCKS.map((block) => [block.code, block]));
const BLOCK_CODE_PATTERN = /^[A-Z][0-9]{2}$/;

export function canonicalizeSubject(code: string): string {
  const upper = code.trim();
  return SUBJECT_ALIAS[upper] ?? SUBJECT_ALIAS[upper.toUpperCase()] ?? upper.toUpperCase();
}

export function isValidExamBlock(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return BLOCK_BY_CODE.has(normalized) || BLOCK_CODE_PATTERN.test(normalized);
}

export function getExamBlock(code: string): CatalogBlock | ExamBlock | null {
  return BLOCK_BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

export interface BlockScore {
  block: string;
  score: number;
  subjectScores: Record<string, number>;
}

/**
 * Chọn tổ hợp có tổng điểm cao nhất. Chỉ xét tổ hợp thí sinh đủ ba môn.
 * `allowedBlocks` giới hạn theo ngành–trường. `extraBlocks` cho mã ngoài từ điển.
 */
export function pickBestBlockScore(
  subjectScores: Record<string, number>,
  allowedBlocks?: readonly string[],
  extraBlocks: readonly ExamBlock[] = [],
): BlockScore | null {
  const normalizedScores = Object.fromEntries(Object.entries(subjectScores).map(([key, value]) => [canonicalizeSubject(key), value]));
  const extras = extraBlocks.filter((block) => isValidExamBlock(block.code));
  const catalog = allowedBlocks && allowedBlocks.length > 0
    ? [...EXAM_BLOCKS.filter((block) => allowedBlocks.includes(block.code)), ...extras.filter((block) => allowedBlocks.includes(block.code))]
    : [...EXAM_BLOCKS, ...extras];
  let best: BlockScore | null = null;
  for (const block of catalog) {
    const scores = block.subjects.map((subject) => normalizedScores[canonicalizeSubject(subject)]);
    if (scores.some((score) => typeof score !== 'number' || !Number.isFinite(score))) continue;
    const total = scores.reduce((sum, score) => sum + (score as number), 0);
    if (!best || total > best.score) {
      best = { block: block.code, score: Math.round(total * 100) / 100, subjectScores: Object.fromEntries(block.subjects.map((subject) => [subject, normalizedScores[canonicalizeSubject(subject)] as number])) };
    }
  }
  return best;
}

export function clampPriorityBonus(bonus: number): number {
  if (!Number.isFinite(bonus) || bonus < 0) return 0;
  return Math.min(bonus, MAX_PRIORITY_BONUS);
}

export type { ExamSubjectCode };
