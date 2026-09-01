import { numericMatches, scaleTrueFalseScore } from './questions.js';

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

export interface AttemptScoreSummary {
  status: 'GRADED' | 'PROVISIONAL';
  score: number;
  maxScore: number;
  gradedMaxScore: number;
  pendingCount: number;
}

export type AssignmentGradingPolicy = 'HIGHEST' | 'LATEST' | 'AVERAGE';

export interface GradedAttemptForGradebook {
  attemptNumber: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'RETURNED';
  submittedAt: string | null;
  score: number | null;
  maxScore: number;
  isLate: boolean;
}

export interface OfficialAssignmentGrade {
  score: number;
  maxScore: number;
  attemptNumber: number | null;
  isLate: boolean;
}

function assertScoreRange(maxScore: number): void {
  if (!Number.isFinite(maxScore) || maxScore <= 0) throw new Error('maxScore must be a positive number');
}

export function nextAttemptNumber(existingAttemptCount: number, maxAttempts: number): number {
  if (!Number.isInteger(existingAttemptCount) || existingAttemptCount < 0) throw new Error('existingAttemptCount must be a non-negative integer');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new Error('maxAttempts must be an integer between 1 and 10');
  if (existingAttemptCount >= maxAttempts) throw new Error('Maximum attempt count reached');
  return existingAttemptCount + 1;
}

function normalizeText(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function autoResult(maxScore: number, isCorrect: boolean, score?: number): GradingResult {
  return { status: 'AUTO_GRADED', maxScore, score: score ?? (isCorrect ? maxScore : 0), isCorrect };
}

function statementMap(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const next: Record<string, boolean> = {};
  for (const key of ['a', 'b', 'c', 'd'] as const) {
    if (typeof record[key] !== 'boolean') return null;
    next[key] = record[key];
  }
  return next;
}

/** Deterministic grading only; essay content always remains for teacher review. */
export function gradeAnswer(question: QuestionForGrading, answer: Record<string, unknown>): GradingResult {
  assertScoreRange(question.maxScore);

  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      return autoResult(question.maxScore, typeof question.answerKey.choice === 'string' && answer.choice === question.answerKey.choice);
    case 'TRUE_FALSE': {
      const expected = statementMap(question.answerKey.values);
      const given = statementMap(answer.values);
      if (expected && given) {
        const correctCount = (['a', 'b', 'c', 'd'] as const).filter((key) => expected[key] === given[key]).length;
        const score = scaleTrueFalseScore(question.maxScore, correctCount);
        return autoResult(question.maxScore, correctCount === 4, score);
      }
      return autoResult(question.maxScore, typeof question.answerKey.value === 'boolean' && answer.value === question.answerKey.value);
    }
    case 'SHORT_ANSWER': {
      const numericExpected = typeof question.answerKey.numeric === 'string' ? question.answerKey.numeric : '';
      const numericAnswer = typeof answer.numeric === 'string' ? answer.numeric : typeof answer.text === 'string' ? answer.text : '';
      const tolerance = typeof question.answerKey.tolerance === 'number' ? question.answerKey.tolerance : 0;
      if (numericExpected) {
        return autoResult(question.maxScore, numericMatches(numericAnswer, numericExpected, tolerance));
      }
      const acceptable = Array.isArray(question.answerKey.acceptable)
        ? question.answerKey.acceptable.filter((value): value is string => typeof value === 'string')
        : [];
      const text = typeof answer.text === 'string' ? normalizeText(answer.text) : normalizeText(numericAnswer);
      return autoResult(question.maxScore, acceptable.some((candidate) => normalizeText(candidate) === text || numericMatches(numericAnswer, candidate, tolerance)));
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

export function summarizeAttemptScores(results: readonly GradingResult[]): AttemptScoreSummary {
  const summary = results.reduce((acc, result) => ({
    score: acc.score + (result.score ?? 0),
    maxScore: acc.maxScore + result.maxScore,
    gradedMaxScore: acc.gradedMaxScore + (result.status === 'AUTO_GRADED' ? result.maxScore : 0),
    pendingCount: acc.pendingCount + (result.status === 'NEEDS_TEACHER_MARK' ? 1 : 0),
  }), { score: 0, maxScore: 0, gradedMaxScore: 0, pendingCount: 0 });
  return { ...summary, status: summary.pendingCount > 0 ? 'PROVISIONAL' : 'GRADED' };
}

/**
 * Chooses the official mark after an attempt is fully graded. Attempts waiting
 * for essay marking are deliberately excluded so a partial submission cannot
 * lower a learner's gradebook score.
 */
export function resolveAssignmentGrade(
  policy: AssignmentGradingPolicy,
  attempts: readonly GradedAttemptForGradebook[],
): OfficialAssignmentGrade | null {
  const graded = attempts.filter((attempt) =>
    (attempt.status === 'GRADED' || attempt.status === 'RETURNED')
    && attempt.score !== null
    && Number.isFinite(attempt.score)
    && Number.isFinite(attempt.maxScore)
    && attempt.maxScore > 0,
  );
  if (graded.length === 0) return null;

  const percentage = (attempt: GradedAttemptForGradebook) => (attempt.score! / attempt.maxScore) * 100;
  if (policy === 'HIGHEST') {
    const selected = graded.reduce((best, attempt) => percentage(attempt) > percentage(best) ? attempt : best);
    return { score: selected.score!, maxScore: selected.maxScore, attemptNumber: selected.attemptNumber, isLate: selected.isLate };
  }
  if (policy === 'LATEST') {
    const selected = graded.reduce((latest, attempt) => {
      const latestAt = latest.submittedAt ?? '';
      const currentAt = attempt.submittedAt ?? '';
      return currentAt > latestAt || (currentAt === latestAt && attempt.attemptNumber > latest.attemptNumber) ? attempt : latest;
    });
    return { score: selected.score!, maxScore: selected.maxScore, attemptNumber: selected.attemptNumber, isLate: selected.isLate };
  }
  if (policy === 'AVERAGE') {
    const maxScore = graded[0].maxScore;
    const score = graded.reduce((sum, attempt) => sum + percentage(attempt), 0) / graded.length;
    return { score: (score / 100) * maxScore, maxScore, attemptNumber: null, isLate: graded.some((attempt) => attempt.isLate) };
  }
  const exhaustive: never = policy;
  throw new Error(`Unsupported grading policy: ${exhaustive}`);
}
