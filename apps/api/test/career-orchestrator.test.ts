import { describe, expect, it } from 'vitest';
import { buildAgentPrompt, CAREER_AGENT_TYPES, analyzeCareerWithAgents } from '../src/services/ai/career-orchestrator.js';

describe('career orchestrator', () => {
  it('exposes ten sub-agent types and builds Vietnamese prompts', () => {
    expect(CAREER_AGENT_TYPES).toHaveLength(10);
    const prompt = buildAgentPrompt('ACADEMIC_ANALYST', { name: 'Minh An', academic: { TOAN: 8 } });
    expect(prompt).toContain('không phải tổ hợp');
    expect(prompt).toContain('Minh An');
  });

  it('fails clearly when no provider is configured instead of returning a fallback report', async () => {
    await expect(analyzeCareerWithAgents(null, { name: 'Minh An' }, ['ACADEMIC_ANALYST'])).rejects.toThrow('AI_PROVIDER_UNAVAILABLE');
  });
});
