/**
 * Dự báo điểm chuẩn bằng hồi quy tuyến tính theo năm và ước tính xác suất trúng tuyển.
 * Thuần, không phụ thuộc pg. Luôn kèm disclaimer; thiếu dữ liệu thì trả INSUFFICIENT_DATA.
 */
export type AdmissionCategory = 'SAFE' | 'CONSIDER' | 'REACH' | 'RISKY' | 'INSUFFICIENT_DATA';

export interface AdmissionHistoryPoint { year: number; score: number; }

export interface AdmissionEstimate {
  predictedCutoff: number | null;
  sigma: number | null;
  probability: number | null;
  category: AdmissionCategory;
  yearsOfData: number;
  disclaimer: string;
}

const DISCLAIMER = 'Ước tính dựa trên dữ liệu điểm chuẩn lịch sử, chỉ mang tính tham khảo, không phải cam kết trúng tuyển.';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const probability = 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? probability : 1 - probability;
}

function categorize(probability: number): AdmissionCategory {
  return probability >= 0.8 ? 'SAFE' : probability >= 0.5 ? 'CONSIDER' : probability >= 0.2 ? 'REACH' : 'RISKY';
}

/**
 * Hồi quy tuyến tính tối thiểu bình phương trên tối đa 3 năm gần nhất. Một điểm dữ
 * liệu chỉ được báo thiếu dữ liệu để tránh hiển thị phần trăm giả. σ = max(RMSE, 1.0).
 */
export function estimateAdmissionProbability(input: { applicantScore: number; history: readonly AdmissionHistoryPoint[]; priorityBonus?: number }): AdmissionEstimate {
  const bonus = Math.max(0, Math.min(input.priorityBonus ?? 0, 2.75));
  const effectiveScore = input.applicantScore + bonus;
  const points = input.history
    .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.score) && point.score > 0)
    .sort((left, right) => left.year - right.year)
    .slice(-3);
  if (points.length === 0) return { predictedCutoff: null, sigma: null, probability: null, category: 'INSUFFICIENT_DATA', yearsOfData: 0, disclaimer: DISCLAIMER };
  if (points.length < 2) return { predictedCutoff: null, sigma: null, probability: null, category: 'INSUFFICIENT_DATA', yearsOfData: points.length, disclaimer: DISCLAIMER };

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
  const nextYear = points[points.length - 1]!.year + 1;
  const predicted = slope * nextYear + intercept;

  const residualVariance = points.reduce((sum, point) => sum + (point.score - (slope * point.year + intercept)) ** 2, 0) / n;
  const sigma = Math.max(Math.sqrt(residualVariance), 1);
  const probability = clamp01(normalCdf((effectiveScore - predicted) / sigma));

  return {
    predictedCutoff: Math.round(predicted * 100) / 100,
    sigma: Math.round(sigma * 100) / 100,
    probability: Math.round(probability * 1000) / 1000,
    category: categorize(probability),
    yearsOfData: n,
    disclaimer: DISCLAIMER,
  };
}
