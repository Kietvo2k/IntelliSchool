import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().min(1).max(max);

const StructuredFieldSchema = z.union([z.record(z.unknown()), boundedText(20_000)]);

export const TeacherComposeQuestionSchema = z.object({
  type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY']),
  prompt: StructuredFieldSchema,
  answerKey: StructuredFieldSchema,
  rubric: StructuredFieldSchema,
  maxScore: z.number().finite().min(0).max(100),
}).strip();

export const TeacherComposeOutputSchema = z.object({
  questions: z.array(TeacherComposeQuestionSchema).min(5).max(50),
  note: z.string().trim().max(2000).optional(),
}).strip();

export const AptitudeEssayOutputSchema = z.object({
  score: z.number().finite().min(0).max(1),
  rationale: boundedText(1200),
}).strip();

export const InterviewTurnOutputSchema = z.object({
  ask_followup: z.boolean(),
  question: z.string().trim().max(500).optional(),
  extracted_fields: z.record(z.string().trim().max(400)),
}).strip().superRefine((value, context) => {
  if (value.ask_followup && !value.question) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cần question khi ask_followup=true.', path: ['question'] });
});

export const CareerAgentOutputSchema = z.object({
  summary: boundedText(4000),
}).passthrough();

export const CareerFindingSchema = z.object({
  title: boundedText(200),
  description: boundedText(1200),
  severity: z.enum(['positive', 'neutral', 'warning']),
}).strip();

export const CareerSynthesisOutputSchema = z.object({
  report: boundedText(8000),
  findings: z.array(CareerFindingSchema).max(6),
  nextActions: z.array(z.object({ label: boundedText(200), target: boundedText(100) }).strip()).max(10).nullable().optional(),
}).strip();

export type TeacherComposeOutput = z.infer<typeof TeacherComposeOutputSchema>;
export type AptitudeEssayOutput = z.infer<typeof AptitudeEssayOutputSchema>;
export type InterviewTurnOutput = z.infer<typeof InterviewTurnOutputSchema>;
export type CareerAgentOutput = z.infer<typeof CareerAgentOutputSchema>;
export type CareerSynthesisOutput = z.infer<typeof CareerSynthesisOutputSchema>;

export function parseStructuredOutput<T>(raw: string, schema: z.ZodType<T>): { success: true; data: T } | { success: false; error: z.ZodError } {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start && cleaned.slice(start, end + 1) !== cleaned) candidates.push(cleaned.slice(start, end + 1));
  let lastError: z.ZodError | undefined;
  for (const candidate of candidates) {
    try {
      const parsed = schema.safeParse(JSON.parse(candidate));
      if (parsed.success) return { success: true, data: parsed.data };
      lastError = parsed.error;
    } catch {
      lastError = new z.ZodError([{ code: z.ZodIssueCode.custom, path: [], message: 'Model output không phải JSON hợp lệ.' }]);
    }
  }
  return { success: false, error: lastError ?? new z.ZodError([{ code: z.ZodIssueCode.custom, path: [], message: 'Model output không phải JSON hợp lệ.' }]) };
}
