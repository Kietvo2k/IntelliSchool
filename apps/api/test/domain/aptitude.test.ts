import { describe, expect, it } from 'vitest';
import { APTITUDE_QUESTIONS, publicAptitudeQuestions, scoreAptitude } from '../../src/domain/career/aptitude.js';

describe('aptitude scoring', () => {
  it('has exactly 20 reasoning questions without leaking the answer key', () => {
    const questions = publicAptitudeQuestions();
    expect(questions).toHaveLength(20);
    expect(APTITUDE_QUESTIONS).toHaveLength(20);
    expect(JSON.stringify(questions)).not.toContain('correctIndex');
    expect(questions.filter((question) => question.kind === 'essay')).toHaveLength(5);
    expect(questions.filter((question) => question.difficulty === 'EASY')).toHaveLength(5);
    expect(questions.filter((question) => question.difficulty === 'MEDIUM')).toHaveLength(5);
    expect(questions.filter((question) => question.difficulty === 'HARD')).toHaveLength(10);
    expect(questions.every((question) => question.track === 'iq')).toBe(true);
  });

  it('scores each dimension by MCQ fraction, not a hardcoded ratio', () => {
    const mcq = APTITUDE_QUESTIONS.filter((question) => question.kind === 'mcq');
    const answers: Record<string, number> = {};
    for (const question of mcq) answers[question.id] = question.correctIndex;
    const scores = scoreAptitude(answers);
    expect(scores.numerical).toBe(1);
    expect(scores.logical).toBe(1);
    expect(scores.pendingEssay).toBeFalsy();

    const numericalMcq = mcq.filter((question) => question.dimension === 'numerical');
    const first = numericalMcq[0]!;
    const halfWrong = { ...answers, [first.id]: (first.correctIndex + 1) % first.choices.length };
    expect(scoreAptitude(halfWrong).numerical).toBeCloseTo((numericalMcq.length - 1) / numericalMcq.length);
  });

  it('treats unanswered dimensions as neutral 0.5', () => {
    expect(scoreAptitude({ V1: 1 }).numerical).toBe(0.5);
  });

  it('keeps essays pending until a rubric score exists', () => {
    const pending = scoreAptitude({ H7e: 'Vận tốc trung bình phải tính theo tổng quãng đường chia tổng thời gian.' });
    expect(pending.pendingEssay).toBe(true);
    expect(pending.numerical).toBe(0.5);
    const scored = scoreAptitude({ H7e: 'Vận tốc trung bình phải tính theo tổng quãng đường chia tổng thời gian.' }, { essayScores: { H7e: 1 } });
    expect(scored.numerical).toBe(1);
    expect(scored.pendingEssay).toBeFalsy();
  });
});
