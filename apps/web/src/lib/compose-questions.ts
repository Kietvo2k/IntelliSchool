export function parseComposeQuestions(text: string): Array<Record<string, unknown>> {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text.match(/\{[\s\S]*"questions"[\s\S]*\}/)?.[0];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { questions?: unknown };
    return Array.isArray(parsed.questions)
      ? parsed.questions.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : [];
  } catch {
    return [];
  }
}
