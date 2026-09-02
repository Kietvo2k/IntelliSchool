import { z } from 'zod';
import { chatWithProvider, type AiChatOptions, type AiMessage, type AiProvider } from './providers.js';
import { parseStructuredOutput } from '../../domain/ai/structured.js';

const MAX_STRUCTURED_ATTEMPTS = 3;

export async function chatWithStructured<T>(input: {
  provider: AiProvider;
  messages: AiMessage[];
  schema: z.ZodType<T>;
  options?: AiChatOptions;
  requestId: string;
}): Promise<{ data: T; text: string; usedModel: string; usage: { inputTokens: number; outputTokens: number } }> {
  let messages = input.messages;
  let inputTokens = 0;
  let outputTokens = 0;
  let lastIssuePaths: string[] = [];
  for (let attempt = 0; attempt < MAX_STRUCTURED_ATTEMPTS; attempt += 1) {
    const result = await chatWithProvider(input.provider, messages, {
      ...input.options,
      requestId: input.requestId,
      responseFormat: input.options?.responseFormat ?? { type: 'json_object' },
    });
    inputTokens += result.usage.inputTokens;
    outputTokens += result.usage.outputTokens;
    const parsed = parseStructuredOutput(result.text, input.schema);
    if (parsed.success) return { data: parsed.data, text: result.text, usedModel: result.usedModel, usage: { inputTokens, outputTokens } };
    lastIssuePaths = parsed.error.issues.map((issue) => issue.path.join('.') || 'root').slice(0, 8);
    messages = [...input.messages, { role: 'user', content: 'Output trước không đúng schema. Hãy bắt đầu bằng ký tự { và kết thúc bằng }, trả về duy nhất một JSON object hợp lệ theo schema, không giải thích, không markdown và không thêm trường.' }];
  }
  throw new Error(`AI_OUTPUT_INVALID: structured output (${lastIssuePaths.join(',') || 'json'})`);
}
