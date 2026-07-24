import { describe, expect, it } from 'vitest';
import { gradeAnswer, resolveFinalScore } from '../../src/domain/classroom/grading.js';

describe('assignment grading policy', () => {
  it('auto-grades multiple-choice, true-false, and normalized short answers but queues essays for a teacher', () => {
    expect(gradeAnswer({ type: 'MULTIPLE_CHOICE', maxScore: 2, answerKey: { choice: 'B' } }, { choice: 'B' })).toMatchObject({ status: 'AUTO_GRADED', isCorrect: true, score: 2 });
    expect(gradeAnswer({ type: 'TRUE_FALSE', maxScore: 1, answerKey: { value: false } }, { value: true })).toMatchObject({ status: 'AUTO_GRADED', isCorrect: false, score: 0 });
    expect(gradeAnswer({ type: 'SHORT_ANSWER', maxScore: 1, answerKey: { acceptable: ['Đạo hàm', 'dao ham'] } }, { text: '  ĐẠO   HÀM ' })).toMatchObject({ status: 'AUTO_GRADED', isCorrect: true, score: 1 });
    expect(gradeAnswer({ type: 'ESSAY', maxScore: 5, answerKey: {} }, { text: 'Bài làm của học sinh' })).toEqual({ status: 'NEEDS_TEACHER_MARK', maxScore: 5, score: null, isCorrect: null });
  });

  it('uses an approved teacher score in preference to an auto score and rejects scores outside the item range', () => {
    expect(resolveFinalScore({ maxScore: 5, autoScore: 4, teacherScore: 3.5 })).toBe(3.5);
    expect(() => resolveFinalScore({ maxScore: 5, autoScore: 4, teacherScore: 5.1 })).toThrow('Teacher score must be within the item range');
  });
});
