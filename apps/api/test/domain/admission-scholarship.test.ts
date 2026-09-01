import { describe, expect, it } from 'vitest';
import { estimateAdmissionProbability } from '../../src/domain/career/admission.js';
import { matchScholarships } from '../../src/domain/career/scholarship.js';

describe('admission probability', () => {
  it('returns INSUFFICIENT_DATA with a disclaimer when there is no history', () => {
    const estimate = estimateAdmissionProbability({ applicantScore: 25, history: [] });
    expect(estimate.category).toBe('INSUFFICIENT_DATA');
    expect(estimate.probability).toBeNull();
    expect(estimate.disclaimer).toContain('tham khảo');
  });

  it('does not present a percentage from a single year of cutoff history', () => {
    const estimate = estimateAdmissionProbability({ applicantScore: 28, history: [{ year: 2026, score: 24 }] });
    expect(estimate.yearsOfData).toBe(1);
    expect(estimate.category).toBe('INSUFFICIENT_DATA');
    expect(estimate.probability).toBeNull();
  });

  it('projects a rising cutoff with linear regression and applies priority bonus', () => {
    const rising = estimateAdmissionProbability({ applicantScore: 26, history: [{ year: 2024, score: 24 }, { year: 2025, score: 25 }, { year: 2026, score: 26 }] });
    // predicted 2027 ~ 27, applicant 26 => below cutoff => not SAFE
    expect(rising.predictedCutoff).toBeGreaterThan(26);
    const withBonus = estimateAdmissionProbability({ applicantScore: 26, history: [{ year: 2024, score: 24 }, { year: 2025, score: 25 }, { year: 2026, score: 26 }], priorityBonus: 2 });
    expect(withBonus.probability!).toBeGreaterThan(rising.probability!);
  });

  it('clamps priority bonus to 2.75', () => {
    const capped = estimateAdmissionProbability({ applicantScore: 20, history: [{ year: 2026, score: 20 }], priorityBonus: 10 });
    const atMax = estimateAdmissionProbability({ applicantScore: 20, history: [{ year: 2026, score: 20 }], priorityBonus: 2.75 });
    expect(capped.probability).toBe(atMax.probability);
  });
});

describe('scholarship matching', () => {
  const scholarships = [
    { id: 'a', title: 'Học bổng khu vực', criteria: { provinces: ['Đà Nẵng'], minGpa: 8 } },
    { id: 'b', title: 'Học bổng thu nhập thấp', criteria: { maxIncome: 10_000_000 } },
    { id: 'c', title: 'Học bổng ngành CNTT', criteria: { majorCodes: ['CS'] } },
  ];

  it('excludes scholarships whose hard criteria are violated', () => {
    const matches = matchScholarships(scholarships, { province: 'Hà Nội', householdIncomeVnd: 20_000_000, majorCodes: ['MED'] });
    expect(matches.map((match) => match.id)).not.toContain('a'); // sai vùng
    expect(matches.map((match) => match.id)).not.toContain('b'); // vượt thu nhập
    expect(matches.map((match) => match.id)).not.toContain('c'); // sai ngành
  });

  it('keeps eligible scholarships and treats missing data as neutral', () => {
    const matches = matchScholarships(scholarships, { province: 'Đà Nẵng', gpa: 8.5, householdIncomeVnd: 8_000_000, majorCodes: ['CS'] });
    expect(matches.map((match) => match.id).sort()).toEqual(['a', 'b', 'c']);
    const regional = matches.find((match) => match.id === 'a');
    expect(regional?.reasons).toContain('Đạt GPA yêu cầu');
  });
});
