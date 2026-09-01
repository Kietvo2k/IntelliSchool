import { describe, expect, it } from 'vitest';
import {
  EXAM_PERIOD_LABELS,
  normalizeExamPeriod,
  type ExamPeriodCode,
} from '../../src/domain/exam/period.js';

describe('exam period metadata', () => {
  it('normalizes known period codes and exposes human labels', () => {
    expect(normalizeExamPeriod('midterm_1')).toBe('MIDTERM_1');
    expect(EXAM_PERIOD_LABELS.MIDTERM_1).toBe('Giữa kỳ I');
  });

  it('falls back to practice for unknown or blank values', () => {
    expect(normalizeExamPeriod('')).toBe('PRACTICE');
    expect(normalizeExamPeriod('not-a-period')).toBe('PRACTICE');
    const code: ExamPeriodCode = normalizeExamPeriod('FINAL_2');
    expect(code).toBe('FINAL_2');
  });
});
