import { chatWithFallback, type AiProvider } from './providers.js';

export const CAREER_AGENT_TYPES = [
  'ACADEMIC_ANALYST',
  'TREND_DETECTOR',
  'SUBJECT_RECOMMENDER',
  'MARKET_ANALYST',
  'ADMISSION_STRATEGIST',
  'COMPETITIVENESS_ANALYST',
  'STUDY_PLAN_ADVISOR',
  'EXTRACURRICULAR_ADVISOR',
  'SCHOLARSHIP_FINDER',
  'RISK_ASSESSOR',
] as const;

export type CareerAgentType = (typeof CAREER_AGENT_TYPES)[number];

export interface CareerAgentConfig {
  type: CareerAgentType;
  name: string;
  description: string;
}

export const CAREER_AGENT_CATALOG: readonly CareerAgentConfig[] = [
  { type: 'ACADEMIC_ANALYST', name: 'Phân tích học tập', description: 'Điểm mạnh/yếu theo môn học trên lớp, không gộp với tổ hợp ĐH.' },
  { type: 'TREND_DETECTOR', name: 'Phát hiện xu hướng', description: 'Môn đang cải thiện hoặc suy giảm qua các kỳ.' },
  { type: 'SUBJECT_RECOMMENDER', name: 'Đề xuất môn học', description: 'Môn cần đầu tư theo ngành mục tiêu.' },
  { type: 'MARKET_ANALYST', name: 'Phân tích thị trường', description: 'Triển vọng việc làm và kỹ năng đang được săn đón.' },
  { type: 'ADMISSION_STRATEGIST', name: 'Chiến lược tuyển sinh', description: 'Chọn trường an toàn / vừa sức / tham vọng.' },
  { type: 'COMPETITIVENESS_ANALYST', name: 'Phân tích cạnh tranh', description: 'So sánh điểm với điểm chuẩn có nguồn.' },
  { type: 'STUDY_PLAN_ADVISOR', name: 'Kế hoạch học tập', description: 'Lộ trình ôn theo tuần và mốc kiểm tra.' },
  { type: 'EXTRACURRICULAR_ADVISOR', name: 'Tư vấn ngoại khóa', description: 'Hoạt động và kỹ năng mềm phù hợp ngành.' },
  { type: 'SCHOLARSHIP_FINDER', name: 'Tìm học bổng', description: 'Gợi ý học bổng theo điểm và ngành.' },
  { type: 'RISK_ASSESSOR', name: 'Đánh giá rủi ro', description: 'Phương án dự phòng nếu không đạt nguyện vọng 1.' },
];

export interface CareerUserData {
  name?: string;
  riasec?: Record<string, number>;
  academic?: Record<string, number>;
  extracurricular?: Record<string, string>;
  simgrResults?: Array<{ career: string; score: number }>;
  targetMajor?: string;
  targetSchools?: string[];
  examHistory?: Array<{ date: string; scores: Record<string, number> }>;
  goals?: string[];
  schoolsSample?: unknown;
}

export interface CareerAnalysisResult {
  report: string;
  findings: Array<{ title: string; description: string; severity: 'positive' | 'neutral' | 'warning' }>;
  nextActions: Array<{ label: string; target: string }>;
  isFallback: boolean;
  subAgentResults: Array<{ agentType: string; success: boolean; data?: Record<string, unknown>; error?: string }>;
}

const SUB_AGENT_TIMEOUT_MS = 30_000;
const ORCHESTRATOR_TIMEOUT_MS = 90_000;

function studentBlurb(userData: CareerUserData): string {
  return [
    `Tên: ${userData.name || 'Không có'}`,
    userData.targetMajor ? `Ngành quan tâm: ${userData.targetMajor}` : '',
    userData.academic ? `Điểm học trên lớp (không phải tổ hợp ĐH): ${JSON.stringify(userData.academic)}` : '',
    userData.riasec ? `RIASEC: ${JSON.stringify(userData.riasec)}` : '',
    userData.goals ? `Mục tiêu: ${JSON.stringify(userData.goals)}` : '',
    userData.extracurricular ? `Ngoại khóa: ${JSON.stringify(userData.extracurricular)}` : '',
    userData.examHistory ? `Điểm thi TN đã lưu: ${JSON.stringify(userData.examHistory)}` : '',
    userData.targetSchools ? `Trường quan tâm: ${userData.targetSchools.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

export function buildAgentPrompt(type: CareerAgentType, userData: CareerUserData): string {
  const blurb = studentBlurb(userData);
  const schools = userData.schoolsSample ? JSON.stringify(userData.schoolsSample).slice(0, 4000) : 'Chưa có dữ liệu trường.';
  const prompts: Record<CareerAgentType, string> = {
    ACADEMIC_ANALYST: `Bạn là chuyên gia phân tích học tập cho học sinh Việt Nam.\n${blurb}\nHãy phân tích điểm mạnh/yếu theo môn học trên lớp, xu hướng nếu có nhiều năm, mức phù hợp với ngành mục tiêu. Không nhầm điểm học với tổ hợp xét tuyển ĐH.\nTrả lời JSON: {"summary":"","strengths":[],"weaknesses":[],"recommendations":[]}`,
    TREND_DETECTOR: `Bạn là chuyên gia phân tích xu hướng học tập.\n${blurb}\nNêu môn đang cải thiện/suy giảm và khuyến nghị điều chỉnh thời gian học.\nTrả lời JSON: {"summary":"","improving":[],"declining":[],"recommendations":[]}`,
    SUBJECT_RECOMMENDER: `Bạn là chuyên gia tư vấn môn học THPT.\n${blurb}\nĐề xuất môn cần đầu tư theo ngành mục tiêu, phân biệt môn học lớp / môn thi TN / tổ hợp ĐH.\nTrả lời JSON: {"summary":"","prioritySubjects":[],"recommendations":[]}`,
    MARKET_ANALYST: `Bạn là chuyên gia thị trường lao động Việt Nam.\n${blurb}\nPhân tích triển vọng việc làm, kỹ năng săn đón, dự báo 3-5 năm. Nếu thiếu dữ liệu crawl, nói rõ đây là nhận định tổng quát.\nTrả lời JSON: {"summary":"","outlook":"","inDemandSkills":[],"recommendations":[]}`,
    ADMISSION_STRATEGIST: `Bạn là chuyên gia tư vấn tuyển sinh ĐH Việt Nam.\n${blurb}\nMẫu trường: ${schools}\nTư vấn an toàn/vừa sức/tham vọng. Nhắc tổ hợp xét tuyển do từng ngành–trường chọn, không có list Bộ duy nhất.\nTrả lời JSON: {"summary":"","safeSchools":[],"targetSchools":[],"reachSchools":[],"recommendations":[]}`,
    COMPETITIVENESS_ANALYST: `Bạn là chuyên gia phân tích năng lực cạnh tranh tuyển sinh.\n${blurb}\nMẫu trường: ${schools}\nSo sánh với điểm chuẩn có nguồn; thiếu nguồn thì không bịa.\nTrả lời JSON: {"summary":"","competitiveness":"","gap":"","improvementPlan":[]}`,
    STUDY_PLAN_ADVISOR: `Bạn là chuyên gia kế hoạch học tập.\n${blurb}\nLộ trình tuần/tháng, phân bổ môn, mốc kiểm tra.\nTrả lời JSON: {"summary":"","weeklyPlan":"","monthlyMilestones":[],"recommendations":[]}`,
    EXTRACURRICULAR_ADVISOR: `Bạn là chuyên gia tư vấn ngoại khóa.\n${blurb}\nGợi ý hoạt động, kỹ năng mềm, cuộc thi, chứng chỉ phù hợp ngành.\nTrả lời JSON: {"summary":"","recommendedActivities":[],"skills":[],"recommendations":[]}`,
    SCHOLARSHIP_FINDER: `Bạn là chuyên gia học bổng trong nước.\n${blurb}\nMẫu trường: ${schools}\nKhông bịa hạn nộp. Thiếu nguồn thì nói chưa có dữ liệu.\nTrả lời JSON: {"summary":"","scholarships":[],"recommendations":[]}`,
    RISK_ASSESSOR: `Bạn là chuyên gia đánh giá rủi ro giáo dục.\n${blurb}\nMẫu trường: ${schools}\nRủi ro không đạt NV1 và phương án dự phòng.\nTrả lời JSON: {"summary":"","riskLevel":"","riskFactors":[],"backupPlans":[],"recommendations":[]}`,
  };
  return prompts[type];
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>; } catch { /* fallthrough */ }
    }
    return { raw: text };
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => { setTimeout(() => resolve(fallback), ms); }),
  ]);
}

export async function analyzeCareerWithAgents(
  provider: AiProvider | null,
  userData: CareerUserData,
  selected: readonly string[],
): Promise<CareerAnalysisResult> {
  const types = (selected.length === 0 ? CAREER_AGENT_TYPES : selected.filter((item): item is CareerAgentType => (CAREER_AGENT_TYPES as readonly string[]).includes(item)));
  const fallback: CareerAnalysisResult = {
    report: provider
      ? 'Phân tích tạm thời không khả dụng. Vui lòng thử lại với ít tác vụ hơn.'
      : 'Chưa cấu hình API key / endpoint AI trên máy chủ. Em vẫn xem được catalog và kết quả đã lưu; hãy nhờ nhà trường cấu hình model.',
    findings: [],
    nextActions: [{ label: 'Mở bảng hướng nghiệp', target: 'dashboard' }],
    isFallback: true,
    subAgentResults: [],
  };

  if (!provider) return { ...fallback, subAgentResults: types.map((type) => ({ agentType: type, success: false, error: 'AI_NOT_CONFIGURED' })) };

  const run = async (): Promise<CareerAnalysisResult> => {
  const subAgentResults: Array<{ agentType: string; success: boolean; data?: Record<string, unknown>; error?: string }> = [];
    for (let index = 0; index < types.length; index += 2) {
      const chunk = types.slice(index, index + 2);
      const chunkResults = await Promise.all(chunk.map(async (type) => {
        try {
          const result = await withTimeout(
            chatWithFallback(provider, [{ role: 'user', content: buildAgentPrompt(type, userData) }], { maxOutputTokens: 700, temperature: 0.4, timeoutMs: SUB_AGENT_TIMEOUT_MS }),
            SUB_AGENT_TIMEOUT_MS,
            { text: '', usage: { inputTokens: 0, outputTokens: 0 }, usedModel: '' },
          );
          if (!result.text.trim()) return { agentType: type, success: false, error: 'TIMEOUT' };
          return { agentType: type, success: true, data: parseJsonObject(result.text) };
        } catch (error) {
          return { agentType: type, success: false, error: error instanceof Error ? error.message : 'AGENT_FAILED' };
        }
      }));
      subAgentResults.push(...chunkResults);
    }
    const successful = subAgentResults.filter((row) => row.success && row.data);
    if (successful.length === 0) return { ...fallback, subAgentResults };

    const synthesis = `Bạn là chuyên gia tư vấn hướng nghiệp cho học sinh Việt Nam. Tổng hợp các phân tích sau thành báo cáo mạch lạc, tiếng Việt. Không trừ credit. Không bịa điểm chuẩn.\n${studentBlurb(userData)}\nKết quả chuyên gia:\n${successful.map((row) => `=== ${row.agentType} ===\n${JSON.stringify(row.data)}`).join('\n')}\nTrả lời JSON: {"report":"...","findings":[{"title":"...","description":"...","severity":"positive|neutral|warning"}]}`;
    try {
      const main = await chatWithFallback(provider, [{ role: 'user', content: synthesis }], { maxOutputTokens: 900, temperature: 0.3, timeoutMs: 40_000 });
      const parsed = parseJsonObject(main.text);
      const findings = Array.isArray(parsed.findings) ? parsed.findings as CareerAnalysisResult['findings'] : [];
      return {
        report: typeof parsed.report === 'string' ? parsed.report : 'Đã nhận phân tích từ các chuyên gia.',
        findings: findings.slice(0, 6),
        nextActions: [{ label: 'Xem kết quả SIMGR', target: 'results' }, { label: 'Mở danh mục trường', target: 'schools' }],
        isFallback: false,
        subAgentResults,
      };
    } catch {
      return {
        report: `Đã hoàn thành phân tích từ: ${successful.map((row) => row.agentType).join(', ')}. Chưa tổng hợp được báo cáo cuối.`,
        findings: [],
        nextActions: [{ label: 'Mở bảng hướng nghiệp', target: 'dashboard' }],
        isFallback: true,
        subAgentResults,
      };
    }
  };

  return withTimeout(run(), ORCHESTRATOR_TIMEOUT_MS, fallback);
}
