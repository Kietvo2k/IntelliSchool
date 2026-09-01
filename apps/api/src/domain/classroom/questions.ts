export const STATEMENT_KEYS = ['a', 'b', 'c', 'd'] as const;
export type StatementKey = (typeof STATEMENT_KEYS)[number];
export const MIN_PUBLISHED_ASSIGNMENT_ITEMS = 5;

export function trueFalseBandScore(correctCount: number): number {
  if (correctCount >= 4) return 1;
  if (correctCount === 3) return 0.5;
  if (correctCount === 2) return 0.25;
  if (correctCount === 1) return 0.1;
  return 0;
}

export function scaleTrueFalseScore(maxScore: number, correctCount: number): number {
  return Math.round(maxScore * trueFalseBandScore(correctCount) * 1000) / 1000;
}

export function normalizeNumericInput(value: string): number | null {
  const parsed = Number(value.trim().replaceAll(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function numericMatches(answer: string, expected: string, tolerance = 0): boolean {
  const left = normalizeNumericInput(answer);
  const right = normalizeNumericInput(expected);
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= Math.max(0, tolerance);
}
