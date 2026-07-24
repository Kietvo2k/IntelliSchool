import { describe, expect, it } from 'vitest';
import { estimateAdmissionProbability, rankCareerMatches, scoreRiasecAnswers } from '../../src/domain/career/scoring.js';

describe('career guidance scoring', () => {
  it('produces a stable RIASEC code and ranks a matching career without presenting it as a decision', () => {
    const riasec = scoreRiasecAnswers({ I1: 5, I2: 4, R1: 4, C1: 3, A1: 1 });
    const ranked = rankCareerMatches([
      { id: 'software', title: 'Kỹ sư phần mềm', riasecProfile: 'IRC', academicGroup: 'SCIENCE', marketDemand: 0.9, risk: 0.2, aptitudeWeights: { logical: 0.6, numerical: 0.4 } },
      { id: 'journalism', title: 'Nhà báo', riasecProfile: 'ASE', academicGroup: 'SOCIAL', marketDemand: 0.6, risk: 0.4, aptitudeWeights: { verbal: 0.7, social: 0.3 } },
    ], { riasec, academics: { science: 0.86, social: 0.51, overall: 0.69 }, aptitude: { numerical: 0.82, verbal: 0.4, logical: 0.9, spatial: 0.5, social: 0.4 } });

    expect(riasec.code).toBe('IRC');
    expect(ranked[0]).toMatchObject({ id: 'software', advisory: true });
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it('estimates admission probability from historical cutoffs with a visible uncertainty disclaimer', () => {
    const result = estimateAdmissionProbability({ applicantScore: 26, cutoffs: [24.5, 25, 25.5] });
    expect(result).toMatchObject({ category: 'SAFE', yearsOfData: 3 });
    expect(result.probability).toBeGreaterThan(0.8);
    expect(result.disclaimer).toContain('không phải cam kết');
  });
});
