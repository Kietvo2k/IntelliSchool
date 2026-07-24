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
  aptitude: Record<AptitudeDimension, number>;
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
    return [dimension, group.count === 0 ? 0 : clamp(group.total / (group.count * 5))];
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

function aptitudeFit(weights: CareerDefinition['aptitudeWeights'], aptitude: CareerInput['aptitude']): number {
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
    const interests = riasecMatch(input.riasec.code, career.riasecProfile);
    const academic = academicFit(career.academicGroup, input.academics);
    const aptitude = aptitudeFit(career.aptitudeWeights, input.aptitude);
    const strengths = clamp(0.55 * academic + 0.45 * aptitude);
    const market = clamp(career.marketDemand);
    const risk = clamp(career.risk);
    const growth = clamp(0.55 * market + 0.25 * clamp(input.academics.overall) + 0.2 * interests);
    const score = clamp(SIMGR_WEIGHTS.strengths * strengths + SIMGR_WEIGHTS.interests * interests + SIMGR_WEIGHTS.market * market + SIMGR_WEIGHTS.growth * growth - SIMGR_WEIGHTS.risk * risk);
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
  const mean = cutoffs.reduce((sum, score) => sum + score, 0) / cutoffs.length;
  const variance = cutoffs.reduce((sum, score) => sum + ((score - mean) ** 2), 0) / cutoffs.length;
  const sigma = Math.max(Math.sqrt(variance), 1);
  const probability = clamp(normalCdf((input.applicantScore - mean) / sigma));
  const category: AdmissionCategory = probability >= 0.8 ? 'SAFE' : probability >= 0.5 ? 'CONSIDER' : probability >= 0.2 ? 'REACH' : 'RISKY';
  return { predictedCutoff: Math.round(mean * 100) / 100, sigma: Math.round(sigma * 100) / 100, probability: Math.round(probability * 1000) / 1000, category, yearsOfData: cutoffs.length, disclaimer };
}

