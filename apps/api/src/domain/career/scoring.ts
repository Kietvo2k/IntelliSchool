export type RiasecDimension = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
export type AptitudeDimension = 'numerical' | 'verbal' | 'logical' | 'spatial' | 'social';

const RIASC_ORDER: readonly RiasecDimension[] = ['R', 'I', 'A', 'S', 'E', 'C'];
const SIMGR_WEIGHTS = { strengths: 0.3, interests: 0.15, market: 0.15, growth: 0.3, risk: 0.1 } as const;

export interface RiasecResult {
  scores: Record<RiasecDimension, number>;
  code: string;
}

export interface CareerDefinition {
  id: string;
  title: string;
  riasecProfile: string;
  academicGroup: 'SCIENCE' | 'SOCIAL' | 'BROAD';
  marketDemand: number;
  risk: number;
  aptitudeWeights: Partial<Record<AptitudeDimension, number>>;
}

export interface CareerInput {
  riasec: RiasecResult;
  academics: { science: number; social: number; overall: number };
  aptitude: Record<AptitudeDimension, number> | null;
  extraBonus?: number;
}

export interface CareerMatch extends CareerDefinition {
  score: number;
  advisory: true;
  components: { strengths: number; interests: number; market: number; growth: number; risk: number };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function validNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

export function scoreRiasecAnswers(answers: Record<string, number>): RiasecResult {
  const totals = Object.fromEntries(RIASC_ORDER.map((dimension) => [dimension, { total: 0, count: 0 }])) as Record<RiasecDimension, { total: number; count: number }>;
  for (const [questionId, rawValue] of Object.entries(answers)) {
    const dimension = questionId.slice(0, 1).toUpperCase() as RiasecDimension;
    if (!RIASC_ORDER.includes(dimension)) continue;
    const value = validNumber(rawValue, `RIASEC answer ${questionId}`);
    if (value < 1 || value > 5) throw new Error(`RIASEC answer ${questionId} must be between 1 and 5`);
    totals[dimension].total += value;
    totals[dimension].count += 1;
  }
  const scores = Object.fromEntries(RIASC_ORDER.map((dimension) => {
    const group = totals[dimension];
    return [dimension, group.count === 0 ? 0.5 : clamp(group.total / (group.count * 5))];
  })) as Record<RiasecDimension, number>;
  const code = [...RIASC_ORDER]
    .sort((left, right) => scores[right] - scores[left] || RIASC_ORDER.indexOf(left) - RIASC_ORDER.indexOf(right))
    .slice(0, 3)
    .join('');
  return { scores, code };
}

function riasecMatch(code: string, profile: string): number {
  const desired = profile.slice(0, 3).toUpperCase();
  let matches = 0;
  for (let index = 0; index < 3; index += 1) if (code[index] === desired[index]) matches += 1;
  return matches / 3;
}

/** Full-vector compatibility with a small bonus for the ordered Holland code. */
export function riasecCompatibility(result: RiasecResult, profile: string): number {
  const letters = [...RIASC_ORDER];
  const weights = profile.slice(0, 3).toUpperCase().split('').reduce<Record<string, number>>((map, letter, index) => {
    map[letter] = Math.max(map[letter] ?? 0, [1, 0.7, 0.4][index] ?? 0.4);
    return map;
  }, {});
  const student = letters.map((letter) => clamp(result.scores[letter] ?? 0.5));
  const career = letters.map((letter) => weights[letter] ?? 0);
  const studentNorm = Math.sqrt(student.reduce((sum, value) => sum + value ** 2, 0));
  const careerNorm = Math.sqrt(career.reduce((sum, value) => sum + value ** 2, 0));
  const cosine = studentNorm > 0 && careerNorm > 0
    ? student.reduce((sum, value, index) => sum + value * career[index]!, 0) / (studentNorm * careerNorm)
    : 0.5;
  const ordered = riasecMatch(result.code, profile);
  return clamp(0.7 * cosine + 0.3 * ordered);
}

function aptitudeFit(weights: CareerDefinition['aptitudeWeights'], aptitude: CareerInput['aptitude']): number {
  if (!aptitude) return 0.5;
  const weighted = Object.entries(weights).reduce((total, [key, weight]) => total + aptitude[key as AptitudeDimension] * (weight ?? 0), 0);
  const totalWeight = Object.values(weights).reduce((total, weight) => total + (weight ?? 0), 0);
  return totalWeight > 0 ? clamp(weighted / totalWeight) : 0.5;
}

function academicFit(group: CareerDefinition['academicGroup'], academics: CareerInput['academics']): number {
  return clamp(group === 'SCIENCE' ? academics.science : group === 'SOCIAL' ? academics.social : academics.overall);
}

/** A transparent ranking aid; it never decides a learner's career on their behalf. */
export function rankCareerMatches(careers: readonly CareerDefinition[], input: CareerInput): CareerMatch[] {
  return careers.map((career) => {
    const interests = riasecCompatibility(input.riasec, career.riasecProfile);
    const academic = academicFit(career.academicGroup, input.academics);
    const aptitude = aptitudeFit(career.aptitudeWeights, input.aptitude);
    const strengths = input.aptitude ? clamp(0.55 * academic + 0.45 * aptitude) : clamp(academic);
    const market = clamp(career.marketDemand);
    const risk = clamp(career.risk);
    const growth = clamp(0.55 * market + 0.25 * clamp(input.academics.overall) + 0.2 * interests);
    const score = clamp(
      SIMGR_WEIGHTS.strengths * strengths
      + SIMGR_WEIGHTS.interests * interests
      + SIMGR_WEIGHTS.market * market
      + SIMGR_WEIGHTS.growth * growth
      - SIMGR_WEIGHTS.risk * risk
      + (input.extraBonus ?? 0),
    );
    return { ...career, score, advisory: true as const, components: { strengths, interests, market, growth, risk } };
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'vi'));
}

export type AdmissionCategory = 'SAFE' | 'CONSIDER' | 'REACH' | 'RISKY' | 'INSUFFICIENT_DATA';

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const probability = 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? probability : 1 - probability;
}

export function computeAcademicScores(grades: Record<string, number>): { science: number; social: number; overall: number } {
  const value = (keys: string[]) => {
    const scores = keys.map((key) => grades[key]).filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    if (scores.length === 0) return 0.5;
    return clamp(scores.reduce((sum, score) => sum + clamp(score / 10), 0) / scores.length);
  };
  const science = value(['math', 'physics', 'chemistry', 'biology', 'TOAN', 'LY', 'HOA', 'SINH']);
  const social = value(['literature', 'history', 'geography', 'civicEducation', 'VAN', 'SU', 'DIA', 'GDKTPL', 'GDCD']);
  return { science, social, overall: clamp((science + social) / 2) };
}

const POSITIVE_KEYWORDS = [
  'lãnh đạo', 'trưởng nhóm', 'quản lý', 'điều hành',
  'giải nhất', 'giải nhì', 'giải ba', 'huy chương', 'vô địch',
  'chứng chỉ', 'bằng khen', 'đạt', 'hoàn thành',
  'thường xuyên', 'đều đặn', 'hàng ngày', 'hàng tuần',
  'tích cực', 'nhiệt tình', 'đam mê',
  'dự án', 'tổ chức', 'sáng lập', 'khởi xướng',
  'thực tập', 'làm thêm', 'kinh nghiệm',
  'ngoại ngữ', 'ielts', 'toeic', 'toefl', 'tiếng anh', 'tiếng nhật',
  'lập trình', 'python', 'javascript', 'java', 'c++',
  'thuyết trình', 'diễn thuyết', 'tranh biện',
  'tình nguyện',
];

export function scoreExtracurricularText(answers: Record<string, string>): number {
  const values = Object.values(answers).filter((text) => text.trim().length >= 10);
  if (values.length === 0) return 0;
  const participation = clamp(values.length / Math.max(Object.keys(answers).length, 1));
  let keywordBonus = 0;
  for (const answer of values) {
    const lower = answer.toLowerCase();
    if (POSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword))) keywordBonus += 0.02;
  }
  return clamp((participation * 0.6 + clamp(keywordBonus, 0, 0.5) * 0.4) * 0.2, 0, 0.2);
}

export function estimateAdmissionProbability(input: { applicantScore: number; cutoffs: readonly number[] }): {
  predictedCutoff: number | null;
  sigma: number | null;
  probability: number | null;
  category: AdmissionCategory;
  yearsOfData: number;
  disclaimer: string;
} {
  const cutoffs = input.cutoffs.filter((score) => Number.isFinite(score) && score > 0).slice(-3);
  const disclaimer = 'Ước tính dựa trên dữ liệu điểm chuẩn lịch sử, không phải cam kết trúng tuyển.';
  if (cutoffs.length === 0) return { predictedCutoff: null, sigma: null, probability: null, category: 'INSUFFICIENT_DATA', yearsOfData: 0, disclaimer };
  if (cutoffs.length < 2) return { predictedCutoff: null, sigma: null, probability: null, category: 'INSUFFICIENT_DATA', yearsOfData: cutoffs.length, disclaimer };
  const points = cutoffs.map((score, index) => ({ year: 2024 + index, score }));
  const n = points.length;
  const meanYear = points.reduce((sum, point) => sum + point.year, 0) / n;
  const meanScore = points.reduce((sum, point) => sum + point.score, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.year - meanYear) * (point.score - meanScore);
    denominator += (point.year - meanYear) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanScore - slope * meanYear;
  const rawPredicted = slope * (points[n - 1]!.year + 1) + intercept;
  const predicted = Math.max(Math.min(...cutoffs) - 1, Math.min(Math.max(...cutoffs) + 1, rawPredicted));
  const residualVariance = points.reduce((sum, point) => sum + (point.score - (slope * point.year + intercept)) ** 2, 0) / n;
  const sigma = Math.max(Math.sqrt(residualVariance), 1);
  const probability = clamp(normalCdf((input.applicantScore - predicted) / sigma));
  const category: AdmissionCategory = probability >= 0.8 ? 'SAFE' : probability >= 0.5 ? 'CONSIDER' : probability >= 0.2 ? 'REACH' : 'RISKY';
  return { predictedCutoff: Math.round(predicted * 100) / 100, sigma: Math.round(sigma * 100) / 100, probability: Math.round(probability * 1000) / 1000, category, yearsOfData: cutoffs.length, disclaimer };
}
