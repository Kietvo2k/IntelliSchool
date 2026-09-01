export const EXAM_PERIOD_CODES = [
  'PRACTICE',
  'MIDTERM_1',
  'FINAL_1',
  'MIDTERM_2',
  'FINAL_2',
  'MOCK_GRADUATION',
  'OTHER',
] as const;

export type ExamPeriodCode = (typeof EXAM_PERIOD_CODES)[number];

export const EXAM_PERIOD_LABELS: Record<ExamPeriodCode, string> = {
  PRACTICE: 'Luyện tập',
  MIDTERM_1: 'Giữa kỳ I',
  FINAL_1: 'Cuối kỳ I',
  MIDTERM_2: 'Giữa kỳ II',
  FINAL_2: 'Cuối kỳ II',
  MOCK_GRADUATION: 'Thi thử tốt nghiệp',
  OTHER: 'Kỳ khác',
};

const PERIOD_SET = new Set<string>(EXAM_PERIOD_CODES);

export function normalizeExamPeriod(value: unknown): ExamPeriodCode {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return PERIOD_SET.has(normalized) ? normalized as ExamPeriodCode : 'PRACTICE';
}
