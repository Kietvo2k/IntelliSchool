/**
 * Khớp học bổng với hồ sơ học sinh. Tiêu chí cứng vi phạm -> loại thẳng. Tiêu chí mềm
 * tính điểm; dữ liệu thiếu -> trung tính 0.5. Thuần, không phụ thuộc pg.
 */
export interface ScholarshipCriteria {
  maxIncome?: number;
  minGpa?: number;
  provinces?: string[];
  majorCodes?: string[];
}

export interface StudentScholarshipProfile {
  householdIncomeVnd?: number;
  gpa?: number;
  province?: string;
  majorCodes?: string[];
}

export interface ScholarshipCandidate {
  id: string;
  title: string;
  criteria: ScholarshipCriteria;
}

export interface ScholarshipMatch {
  id: string;
  title: string;
  matchScore: number;
  reasons: string[];
}

function neutralOrScore(known: boolean, satisfied: boolean): number {
  if (!known) return 0.5;
  return satisfied ? 1 : 0;
}

export function matchScholarships(scholarships: readonly ScholarshipCandidate[], profile: StudentScholarshipProfile): ScholarshipMatch[] {
  const matches: ScholarshipMatch[] = [];
  for (const scholarship of scholarships) {
    const criteria = scholarship.criteria ?? {};
    const reasons: string[] = [];

    // Tiêu chí cứng: vượt trần thu nhập, sai vùng, sai ngành -> loại.
    if (typeof criteria.maxIncome === 'number' && typeof profile.householdIncomeVnd === 'number' && profile.householdIncomeVnd > criteria.maxIncome) continue;
    if (Array.isArray(criteria.provinces) && criteria.provinces.length > 0 && profile.province && !criteria.provinces.includes(profile.province)) continue;
    if (Array.isArray(criteria.majorCodes) && criteria.majorCodes.length > 0 && profile.majorCodes && profile.majorCodes.length > 0 && !criteria.majorCodes.some((code) => profile.majorCodes!.includes(code))) continue;

    const components: number[] = [];
    if (typeof criteria.minGpa === 'number') {
      const known = typeof profile.gpa === 'number';
      const satisfied = known && (profile.gpa as number) >= criteria.minGpa;
      components.push(neutralOrScore(known, satisfied));
      if (satisfied) reasons.push('Đạt GPA yêu cầu');
      else if (known) reasons.push('Chưa đạt GPA yêu cầu');
    }
    if (typeof criteria.maxIncome === 'number') {
      const known = typeof profile.householdIncomeVnd === 'number';
      components.push(neutralOrScore(known, true));
      if (known) reasons.push('Trong ngưỡng thu nhập');
    }
    if (Array.isArray(criteria.provinces) && criteria.provinces.length > 0 && profile.province) reasons.push('Đúng khu vực');

    const matchScore = components.length === 0 ? 0.5 : components.reduce((sum, value) => sum + value, 0) / components.length;
    matches.push({ id: scholarship.id, title: scholarship.title, matchScore: Math.round(matchScore * 1000) / 1000, reasons });
  }
  return matches.sort((left, right) => right.matchScore - left.matchScore || left.title.localeCompare(right.title, 'vi'));
}
