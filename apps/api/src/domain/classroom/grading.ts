export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';

export interface QuestionForGrading {
  type: QuestionType;
  maxScore: number;
  answerKey: Record<string, unknown>;
}

export interface GradingResult {
  status: 'AUTO_GRADED' | 'NEEDS_TEACHER_MARK';
  maxScore: number;
  score: number | null;
  isCorrect: boolean | null;
}

function assertScoreRange(maxScore: number): void {
  if (!Number.isFinite(maxScore) || maxScore <= 0) throw new Error('maxScore must be a positive number');
}

function normalizeText(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function autoResult(maxScore: number, isCorrect: boolean): GradingResult {
  return { status: 'AUTO_GRADED', maxScore, score: isCorrect ? maxScore : 0, isCorrect };
}

/** Deterministic grading only; essay content always remains for teacher review. */
export function gradeAnswer(question: QuestionForGrading, answer: Record<string, unknown>): GradingResult {
  assertScoreRange(question.maxScore);

  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      return autoResult(question.maxScore, typeof question.answerKey.choice === 'string' && answer.choice === question.answerKey.choice);
    case 'TRUE_FALSE':
      return autoResult(question.maxScore, typeof question.answerKey.value === 'boolean' && answer.value === question.answerKey.value);
    case 'SHORT_ANSWER': {
      const acceptable = Array.isArray(question.answerKey.acceptable)
        ? question.answerKey.acceptable.filter((value): value is string => typeof value === 'string')
        : [];
      const text = typeof answer.text === 'string' ? normalizeText(answer.text) : '';
      return autoResult(question.maxScore, acceptable.some((candidate) => normalizeText(candidate) === text));
    }
    case 'ESSAY':
      return { status: 'NEEDS_TEACHER_MARK', maxScore: question.maxScore, score: null, isCorrect: null };
  }
}

export function resolveFinalScore(input: { maxScore: number; autoScore: number | null; teacherScore: number | null }): number | null {
  assertScoreRange(input.maxScore);
  const score = input.teacherScore ?? input.autoScore;
  if (score === null) return null;
  if (!Number.isFinite(score) || score < 0 || score > input.maxScore) {
    if (input.teacherScore !== null) throw new Error('Teacher score must be within the item range');
    throw new Error('Auto score must be within the item range');
  }
  return score;
}
