import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider, createAiProvider, OpenAiCompatibleProvider, providerFromModel } from '../src/services/ai/providers.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe('AI provider adapters', () => {
  it('OpenAI-compatible and Anthropic expose the same chat contract', async () => {
    const openai = createAiProvider('OPENAI_COMPATIBLE', { baseUrl: 'https://api.example/v1', apiKey: 'k', modelName: 'gpt' });
    const anthropic = createAiProvider('ANTHROPIC', { baseUrl: 'https://api.anthropic.com/v1', apiKey: 'k', modelName: 'claude' });
    expect(openai).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(anthropic).toBeInstanceOf(AnthropicProvider);
    for (const provider of [openai, anthropic]) {
      expect(typeof provider.chat).toBe('function');
      expect(typeof provider.embed).toBe('function');
    }
  });

  it('parses an OpenAI-compatible chat response and reports token usage', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Xin chào' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 })) as never;
    const provider = new OpenAiCompatibleProvider({ baseUrl: 'https://api.example/v1', apiKey: 'secret-key', modelName: 'gpt' });
    const result = await provider.chat([{ role: 'user', content: 'Hi' }]);
    expect(result.text).toBe('Xin chào');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(call[0])).toContain('/chat/completions');
    // Key chỉ nằm ở header Authorization, tuyệt đối không xuất hiện trong body request.
    expect(String((call[1] as RequestInit).body)).not.toContain('secret-key');
  });

  it('retries once on failure then surfaces a clean error', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    globalThis.fetch = fetchMock as never;
    const provider = new OpenAiCompatibleProvider({ baseUrl: 'https://api.example/v1', apiKey: 'k', modelName: 'gpt' });
    await expect(provider.chat([{ role: 'user', content: 'Hi' }], { timeoutMs: 1000 })).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps Anthropic messages format and content blocks', async () => {
    globalThis.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      expect(body.system).toBe('Bạn là trợ giảng.');
      expect(body.messages[0]).toMatchObject({ role: 'user', content: 'Hỏi' });
      return new Response(JSON.stringify({ content: [{ text: 'Đáp' }], usage: { input_tokens: 3, output_tokens: 2 } }), { status: 200 });
    }) as never;
    const provider = new AnthropicProvider({ baseUrl: 'https://api.anthropic.com/v1', apiKey: 'k', modelName: 'claude' });
    const result = await provider.chat([{ role: 'system', content: 'Bạn là trợ giảng.' }, { role: 'user', content: 'Hỏi' }]);
    expect(result.text).toBe('Đáp');
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 2 });
  });

  it('builds a provider from env aliases and refuses to start without a model name', () => {
    const ready = providerFromModel(
      { provider: 'openai', modelName: '', endpointUrl: null },
      { AI_PROVIDER: 'openai', AI_OPENAI_BASE_URL: 'https://example.com/v1', AI_OPENAI_API_KEY: 'k', AI_OPENAI_MODEL: 'gpt-local' },
    );
    expect(ready).toBeInstanceOf(OpenAiCompatibleProvider);
    const missing = providerFromModel({ provider: 'openai', modelName: '', endpointUrl: null }, { AI_BASE_URL: 'https://example.com/v1', AI_API_KEY: 'k' });
    expect(missing).toBeNull();
  });

  it('retries the fallback model after the primary chat call fails', async () => {
    const { chatWithFallback } = await import('../src/services/ai/providers.js');
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      if (body.model === 'deepseek-v4-flash') return new Response('timeout', { status: 504 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
    });
    globalThis.fetch = fetchMock as never;
    const provider = new OpenAiCompatibleProvider({ baseUrl: 'https://api.example/v1', apiKey: 'k', modelName: 'deepseek-v4-flash' });
    const result = await chatWithFallback(provider, [{ role: 'user', content: 'Hi' }], { timeoutMs: 1000 }, { AI_FALLBACK_MODEL: 'kimi-k2.6' });
    expect(result.text).toBe('OK');
    expect(result.usedModel).toBe('kimi-k2.6');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('skips a same-model retry after abort and uses the fallback model', async () => {
    const { chatWithFallback } = await import('../src/services/ai/providers.js');
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      if (body.model === 'deepseek-v4-flash') {
        const error = new Error('This operation was aborted');
        error.name = 'AbortError';
        throw error;
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
    });
    globalThis.fetch = fetchMock as never;
    const provider = new OpenAiCompatibleProvider({ baseUrl: 'https://api.example/v1', apiKey: 'k', modelName: 'deepseek-v4-flash' });
    const result = await chatWithFallback(provider, [{ role: 'user', content: 'Hi' }], { timeoutMs: 1000 }, { AI_FALLBACK_MODEL: 'kimi-k2.6' });
    expect(result.text).toBe('OK');
    expect(result.usedModel).toBe('kimi-k2.6');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
