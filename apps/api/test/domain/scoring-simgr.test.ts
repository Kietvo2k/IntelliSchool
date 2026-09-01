import { describe, expect, it } from 'vitest';
import { rankCareerMatches, scoreRiasecAnswers, riasecCompatibility, type CareerDefinition } from '../../src/domain/career/scoring.js';
import { scoreAptitude } from '../../src/domain/career/aptitude.js';

const careers: CareerDefinition[] = [
  { id: 'swe', title: 'Kỹ sư phần mềm', riasecProfile: 'ICR', academicGroup: 'SCIENCE', marketDemand: 0.9, risk: 0.2, aptitudeWeights: { logical: 0.6, numerical: 0.4 } },
  { id: 'artist', title: 'Họa sĩ tự do', riasecProfile: 'AES', academicGroup: 'BROAD', marketDemand: 0.3, risk: 0.8, aptitudeWeights: { spatial: 0.8 } },
];

describe('SIMGR scoring', () => {
  it('still ranks when every quiz step is skipped', () => {
    const matches = rankCareerMatches(careers, {
      riasec: scoreRiasecAnswers({}),
      academics: { science: 0.5, social: 0.5, overall: 0.5 },
      aptitude: null,
    });
    expect(matches).toHaveLength(2);
    expect(matches[0]!.advisory).toBe(true);
    expect(Object.values(scoreRiasecAnswers({}).scores).every((value) => value === 0.5)).toBe(true);
  });

  it('uses RIASEC-only input without requiring aptitude', () => {
    const riasec = scoreRiasecAnswers({ I1: 5, I2: 5, C1: 4, R1: 3, A1: 2, S1: 2, E1: 2 });
    const matches = rankCareerMatches(careers, {
      riasec,
      academics: { science: 0.5, social: 0.5, overall: 0.5 },
      aptitude: null,
    });
    expect(matches[0]!.id).toBe('swe');
  });

  it('ranks a strong-fit career above a weak-fit one when all inputs exist', () => {
    const riasec = scoreRiasecAnswers({ I1: 5, I2: 5, C1: 4, R1: 3, A1: 2, S1: 2, E1: 2 });
    const matches = rankCareerMatches(careers, {
      riasec,
      academics: { science: 0.85, social: 0.5, overall: 0.8 },
      aptitude: { numerical: 0.8, verbal: 0.6, logical: 0.9, spatial: 0.4, social: 0.5 },
    });
    expect(matches[0]!.id).toBe('swe');
    expect(matches[0]!.score).toBeGreaterThan(matches[1]!.score);
    expect(matches[0]!.components.strengths).toBeGreaterThan(0.5);
  });

  it('blends scored essays into aptitude without treating pending text as a dimension hit', () => {
    const pending = scoreAptitude({ E1: 1, H7e: 'Trình bày đủ bước.' });
    expect(pending.pendingEssay).toBe(true);
    const scored = scoreAptitude({ E1: 1, H7e: 'Trình bày đủ bước.' }, { essayScores: { H7e: 0 } });
    expect(scored.numerical).toBeLessThan(pending.numerical);
    const matches = rankCareerMatches(careers, {
      riasec: scoreRiasecAnswers({ I1: 5 }),
      academics: { science: 0.7, social: 0.5, overall: 0.6 },
      aptitude: scored,
    });
    expect(matches[0]!.advisory).toBe(true);
  });

  it('scores RIASEC compatibility from the full vector and top-three order', () => {
    const result = scoreRiasecAnswers({ I1: 5, C1: 5, R1: 5 });
    expect(riasecCompatibility(result, 'ICR')).toBeGreaterThan(riasecCompatibility(result, 'ASE'));
  });
});
