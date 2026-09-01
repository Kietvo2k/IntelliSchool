export const MAX_EXTRACURRICULAR_FOLLOWUPS = 5;

export interface InterviewTurn {
  ask_followup: boolean;
  question?: string;
  extracted_fields: Record<string, string>;
}

export interface InterviewContextInput {
  profile: Record<string, unknown>;
  answers: Record<string, string>;
  goal?: string;
}

export function buildInterviewContext(input: InterviewContextInput): string {
  const profileLines = Object.entries(input.profile)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim().length > 0)
    .map(([key, value]) => `${key}: ${String(value).slice(0, 240)}`);
  const answerLines = Object.entries(input.answers)
    .map(([key, value]) => `${key}: ${value.slice(0, 400)}`);
  return ['HỒ SƠ HỌC SINH:', ...profileLines, input.goal ? `MỤC TIÊU BÀI PHỎNG VẤN: ${input.goal}` : '', 'CÂU TRẢ LỜI ĐÃ GHI:', ...answerLines]
    .filter(Boolean)
    .join('\n')
    .slice(0, 8_000);
}

export function parseInterviewModelOutput(raw: string): InterviewTurn {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { ask_followup: false, extracted_fields: {} };
  try {
    const parsed = JSON.parse(match[0]) as InterviewTurn;
    const fields = parsed.extracted_fields && typeof parsed.extracted_fields === 'object' ? parsed.extracted_fields : {};
    const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
    return {
      ask_followup: Boolean(parsed.ask_followup) && question.length > 0,
      question: question || undefined,
      extracted_fields: Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    };
  } catch {
    return { ask_followup: false, extracted_fields: {} };
  }
}

export function presentInterviewTurn(raw: string): string {
  const parsed = parseInterviewModelOutput(raw);
  if (!parsed.ask_followup || !parsed.question) return 'Cảm ơn em. Mình đã đủ thông tin cho phần Hoạt động & trải nghiệm.';
  const normalized = parsed.question.replace(/\s+/g, ' ').trim();
  const firstQuestion = normalized.match(/^(.+?[?？])/);
  return (firstQuestion?.[1] ?? normalized).slice(0, 500);
}

export const INTERVIEW_SYSTEM_PROMPT = [
  'Bạn phỏng vấn ngoại khóa học sinh THPT. Sau mỗi câu trả lời, CHỈ trả JSON:',
  '{"ask_followup":boolean,"question":"string","extracted_fields":{"category":"short fact"}}',
  `Hỏi thêm tối đa ${MAX_EXTRACURRICULAR_FOLLOWUPS} câu. Nếu đủ thông tin, ask_followup=false.`,
  'Không chấm điểm tự do: chỉ trích field chuẩn (thể thao, CLB, giải thưởng, lãnh đạo, tình nguyện).',
].join(' ');
