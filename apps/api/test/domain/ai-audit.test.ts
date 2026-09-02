import { describe, expect, it } from 'vitest';
import { buildAiAuditMetadata } from '../../src/domain/ai/audit.js';

describe('AI audit metadata', () => {
  it('keeps operational evidence while excluding prompts, answers, and secrets', () => {
    const metadata = buildAiAuditMetadata({
      operation: 'CHAT',
      purpose: 'PERSONAL_STUDY',
      status: 'COMPLETED',
      provider: 'OPENAI_COMPATIBLE',
      requestedModel: 'deepseek-v4-flash',
      usedModel: 'deepseek-v4-flash',
      executionMode: 'MODEL',
      inputTokens: 120,
      outputTokens: 80,
      estimatedCostVnd: 0,
      citationsCount: 2,
      requestId: 'request-123',
      jobId: null,
      prompt: 'Bí mật học tập của học sinh',
      apiKey: 'secret-must-never-appear',
    });

    expect(metadata).toMatchObject({
      category: 'AI',
      operation: 'CHAT',
      purpose: 'PERSONAL_STUDY',
      status: 'COMPLETED',
      provider: 'OPENAI_COMPATIBLE',
      requestedModel: 'deepseek-v4-flash',
      usedModel: 'deepseek-v4-flash',
      executionMode: 'MODEL',
      inputTokens: 120,
      outputTokens: 80,
      citationsCount: 2,
      requestId: 'request-123',
      jobId: null,
    });
    expect(JSON.stringify(metadata)).not.toContain('Bí mật học tập');
    expect(JSON.stringify(metadata)).not.toContain('secret-must-never-appear');
  });
});
