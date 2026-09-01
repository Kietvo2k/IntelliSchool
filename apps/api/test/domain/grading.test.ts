import { describe, expect, it } from 'vitest';
import { gradeAnswer, nextAttemptNumber, resolveAssignmentGrade, resolveFinalScore, summarizeAttemptScores } from '../../src/domain/classroom/grading.js';

describe('assignment grading policy', () => {
  it('allocates the next attempt number and refuses submissions once the limit is reached', () => {
    expect(nextAttemptNumber(0, 3)).toBe(1);
    expect(nextAttemptNumber(2, 3)).toBe(3);
    expect(() => nextAttemptNumber(3, 3)).toThrow('Maximum attempt count reached');
  });

  it('auto-grades multiple-choice, true-false 4-ý (QĐ 764), numeric short answers, and queues essays', () => {
    expect(gradeAnswer({ type: 'MULTIPLE_CHOICE', maxScore: 2, answerKey: { choice: 'B' } }, { choice: 'B' })).toMatchObject({ status: 'AUTO_GRADED', isCorrect: true, score: 2 });
    const key = { values: { a: true, b: false, c: true, d: false } };
    expect(gradeAnswer({ type: 'TRUE_FALSE', maxScore: 1, answerKey: key }, { values: { a: true, b: false, c: true, d: false } })).toMatchObject({ isCorrect: true, score: 1 });
    expect(gradeAnswer({ type: 'TRUE_FALSE', maxScore: 1, answerKey: key }, { values: { a: true, b: false, c: true, d: true } })).toMatchObject({ isCorrect: false, score: 0.5 });
    expect(gradeAnswer({ type: 'TRUE_FALSE', maxScore: 1, answerKey: key }, { values: { a: true, b: true, c: false, d: true } })).toMatchObject({ isCorrect: false, score: 0.1 });
    expect(gradeAnswer({ type: 'SHORT_ANSWER', maxScore: 0.5, answerKey: { numeric: '2,5', tolerance: 0.01 } }, { numeric: '2.5' })).toMatchObject({ isCorrect: true, score: 0.5 });
    expect(gradeAnswer({ type: 'ESSAY', maxScore: 5, answerKey: {} }, { text: 'Bài làm của học sinh' })).toEqual({ status: 'NEEDS_TEACHER_MARK', maxScore: 5, score: null, isCorrect: null });
  });

  it('uses an approved teacher score in preference to an auto score and rejects scores outside the item range', () => {
    expect(resolveFinalScore({ maxScore: 5, autoScore: 4, teacherScore: 3.5 })).toBe(3.5);
    expect(() => resolveFinalScore({ maxScore: 5, autoScore: 4, teacherScore: 5.1 })).toThrow('Teacher score must be within the item range');
  });

  it('resolves official gradebook scores from graded attempts only', () => {
    const attempts = [
      { attemptNumber: 1, status: 'GRADED' as const, submittedAt: '2026-07-24T10:00:00.000Z', score: 6, maxScore: 10, isLate: false },
      { attemptNumber: 2, status: 'GRADED' as const, submittedAt: '2026-07-24T12:00:00.000Z', score: 8, maxScore: 10, isLate: true },
      { attemptNumber: 3, status: 'SUBMITTED' as const, submittedAt: '2026-07-24T14:00:00.000Z', score: null, maxScore: 10, isLate: false },
    ];

    expect(resolveAssignmentGrade('HIGHEST', attempts)).toMatchObject({ score: 8, maxScore: 10, attemptNumber: 2, isLate: true });
    expect(resolveAssignmentGrade('LATEST', attempts)).toMatchObject({ score: 8, maxScore: 10, attemptNumber: 2 });
    expect(resolveAssignmentGrade('AVERAGE', attempts)).toMatchObject({ score: 7, maxScore: 10, attemptNumber: null });
    expect(resolveAssignmentGrade('HIGHEST', [{ ...attempts[2] }])).toBeNull();
  });

  it('keeps an objective provisional score while essays are pending', () => {
    expect(summarizeAttemptScores([
      { status: 'AUTO_GRADED', maxScore: 8, score: 6, isCorrect: false },
      { status: 'NEEDS_TEACHER_MARK', maxScore: 2, score: null, isCorrect: null },
    ])).toEqual({ status: 'PROVISIONAL', score: 6, maxScore: 10, gradedMaxScore: 8, pendingCount: 1 });
    expect(summarizeAttemptScores([{ status: 'AUTO_GRADED', maxScore: 10, score: 8, isCorrect: true }])).toMatchObject({ status: 'GRADED', score: 8, pendingCount: 0 });
  });
});
