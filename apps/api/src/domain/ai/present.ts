/** Never leak raw JSON/code fences to students. */

export function presentAssistantText(purpose: string | undefined, raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'Đã ghi nhận.';

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const jsonCandidate = fenced?.[1]?.trim()
    ?? (trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed : null);

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
      if (typeof parsed.question === 'string' && parsed.question.trim()) return parsed.question.trim();
      if (typeof parsed.report === 'string' && parsed.report.trim()) return parsed.report.trim();
      if (typeof parsed.summary === 'string' && parsed.summary.trim()) return parsed.summary.trim();
      if (purpose === 'TEACHER_COMPOSE' || Array.isArray(parsed.questions)) {
        const prose = trimmed.replace(/```json[\s\S]*?```/i, '').trim();
        return prose || 'Đã điền khung câu hỏi. Kiểm tra các thẻ bên dưới rồi lưu vào ngân hàng — không tự xuất bản.';
      }
      return 'Đã ghi nhận câu trả lời.';
    } catch {
      /* fall through */
    }
  }

  if (/^\s*\{[\s\S]*\}\s*$/.test(trimmed)) {
    return 'Đã ghi nhận câu trả lời.';
  }

  return trimmed.replace(/```json[\s\S]*?```/gi, '').trim() || 'Đã ghi nhận.';
}
