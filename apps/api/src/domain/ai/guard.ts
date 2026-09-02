/**
 * Guard đầu vào AI TỐI THIỂU (viết lại tinh thần AiInputGuard của SCDP). Mục tiêu là
 * chặn lạm dụng rõ ràng và giới hạn độ dài, KHÔNG chặn trước câu trả lời hợp lệ — để
 * model trả lời tự nhiên, tránh việc siết quá gây từ chối/hallucination. Thuần.
 */
export const MAX_PROMPT_LENGTH = 4000;

const INJECTION_PATTERNS: RegExp[] = [
  /bỏ qua .{0,30}(chỉ dẫn|hướng dẫn|quy tắc)/i,
  /ignore .{0,30}(instructions|rules|prompts)/i,
  /(reveal|show|print|lộ|tiết lộ).{0,30}(system prompt|api key|khóa api|prompt hệ thống)/i,
  /you are now|bây giờ bạn là|act as (an?|the) (unfiltered|jailbroken)/i,
  /developer mode|system override|bypass .{0,30}(approval|safety|check)|\b(delete|drop|exec|execute)\b.{0,30}\b(tool|table|file|data)\b/i,
];

export interface GuardResult {
  ok: boolean;
  sanitized: string;
  reason?: 'EMPTY' | 'TOO_LONG' | 'INJECTION';
}

export function guardUserPrompt(raw: string): GuardResult {
  // eslint-disable-next-line no-control-regex -- NUL is removed from untrusted user input.
  const sanitized = (raw ?? '').replace(/\u0000/g, '').trim();
  if (sanitized.length === 0) return { ok: false, sanitized, reason: 'EMPTY' };
  if (sanitized.length > MAX_PROMPT_LENGTH) return { ok: false, sanitized: sanitized.slice(0, MAX_PROMPT_LENGTH), reason: 'TOO_LONG' };
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(sanitized))) return { ok: false, sanitized, reason: 'INJECTION' };
  return { ok: true, sanitized };
}

function foldVi(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/** Phát hiện ý định xin đáp án của một bài đang mở (chặn gian lận), tách khỏi hỏi học thuật thường. */
export function looksLikeAnswerFishing(prompt: string): boolean {
  const folded = foldVi(prompt);
  const requestsDirectAnswer = /(dap an|loi giai|answer key|giai giup)/i.test(folded);
  const namesAssessment = /(bai kiem tra|bai thi|de thi|bai dang mo|assignment|quiz)/i.test(folded);
  const signalsActiveAttempt = /(dang mo|dang lam|hien tai|hom nay|chua nop|con thoi gian)/i.test(folded);
  return requestsDirectAnswer && namesAssessment && signalsActiveAttempt;
}
