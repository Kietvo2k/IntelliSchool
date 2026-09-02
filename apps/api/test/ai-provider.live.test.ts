import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { chatWithProvider, OpenAiCompatibleProvider, providerFromModel } from '../src/services/ai/providers.js';

const liveConfigured = Boolean(process.env.AI_OPENAI_API_KEY && process.env.AI_OPENAI_BASE_URL && process.env.AI_OPENAI_MODEL);

describe('AI provider live evidence', () => {
  it('requires live configuration when the release gate requests it', () => {
    if (process.env.AI_LIVE_REQUIRED === 'true') expect(liveConfigured).toBe(true);
  });

  it.skipIf(!liveConfigured)('calls the configured OpenAI-compatible endpoint with server-only credentials', async () => {
    const provider = providerFromModel({ provider: 'openai', modelName: '', endpointUrl: null }, process.env);
    expect(provider).toBeInstanceOf(OpenAiCompatibleProvider);
    const requestId = randomUUID();
    const result = await chatWithProvider(provider!, [{ role: 'user', content: 'Trả lời đúng một từ: OK' }], { maxOutputTokens: 5, temperature: 0, requestId });
    expect(result.usedModel).toBe(process.env.AI_OPENAI_MODEL);
    expect(result.text.trim().length).toBeGreaterThan(0);
    expect(result.usage.inputTokens).toBeGreaterThanOrEqual(0);
    expect(result.usage.outputTokens).toBeGreaterThanOrEqual(0);
    expect(result.text).not.toContain(process.env.AI_OPENAI_API_KEY ?? '__missing__');
  });
});
