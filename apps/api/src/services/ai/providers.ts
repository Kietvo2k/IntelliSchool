/**
 * Adapter provider AI. Một interface chung cho OpenAI-compatible và Anthropic để đổi
 * provider chỉ bằng cấu hình. Không đưa key vào response/log. Có retry + timeout.
 */
export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatOptions {
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AiChatResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AiProvider {
  readonly kind: 'OPENAI_COMPATIBLE' | 'ANTHROPIC';
  chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiChatResult>;
  embed(texts: string[]): Promise<number[][]>;
}

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  embeddingModel?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2;

export function envTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? raw : DEFAULT_TIMEOUT_MS;
}

export function envFallbackModel(env: Record<string, string | undefined> = process.env): string | undefined {
  const value = env.AI_FALLBACK_MODEL?.trim();
  return value || undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /aborted/i.test(error.message));
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`AI provider trả về ${response.status}: ${body.slice(0, 200)}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      // Timeout/abort: chuyển ngay sang model dự phòng, không đợi lần retry cùng model.
      if (isAbortError(error) || attempt === MAX_ATTEMPTS) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI provider request failed');
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly kind = 'OPENAI_COMPATIBLE' as const;
  constructor(readonly config: AiProviderConfig) {}

  withModel(modelName: string): OpenAiCompatibleProvider {
    return new OpenAiCompatibleProvider({ ...this.config, modelName });
  }

  async chat(messages: AiMessage[], options: AiChatOptions = {}): Promise<AiChatResult> {
    const payload = await fetchJson(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model: this.config.modelName, messages, max_tokens: options.maxOutputTokens ?? 800, temperature: options.temperature ?? 0.3 }),
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return {
      text: payload.choices?.[0]?.message?.content ?? '',
      usage: { inputTokens: payload.usage?.prompt_tokens ?? 0, outputTokens: payload.usage?.completion_tokens ?? 0 },
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const payload = await fetchJson(`${this.config.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model: this.config.embeddingModel ?? 'text-embedding-3-small', input: texts }),
    }, DEFAULT_TIMEOUT_MS) as { data?: Array<{ embedding?: number[] }> };
    return (payload.data ?? []).map((row) => row.embedding ?? []);
  }
}

export class AnthropicProvider implements AiProvider {
  readonly kind = 'ANTHROPIC' as const;
  constructor(readonly config: AiProviderConfig, private readonly embeddingProvider?: AiProvider) {}

  withModel(modelName: string): AnthropicProvider {
    return new AnthropicProvider({ ...this.config, modelName }, this.embeddingProvider);
  }

  async chat(messages: AiMessage[], options: AiChatOptions = {}): Promise<AiChatResult> {
    const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
    const turns = messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }));
    const payload = await fetchJson(`${this.config.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.config.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.config.modelName, system: system || undefined, messages: turns, max_tokens: options.maxOutputTokens ?? 800, temperature: options.temperature ?? 0.3 }),
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS) as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    return {
      text: (payload.content ?? []).map((block) => block.text ?? '').join(''),
      usage: { inputTokens: payload.usage?.input_tokens ?? 0, outputTokens: payload.usage?.output_tokens ?? 0 },
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.embeddingProvider) throw new Error('Anthropic không hỗ trợ embedding trực tiếp; cần cấu hình provider embedding OpenAI-compatible.');
    return this.embeddingProvider.embed(texts);
  }
}

export type AiProviderKind = 'OPENAI_COMPATIBLE' | 'ANTHROPIC';

export function createAiProvider(kind: AiProviderKind, config: AiProviderConfig, embeddingProvider?: AiProvider): AiProvider {
  return kind === 'ANTHROPIC' ? new AnthropicProvider(config, embeddingProvider) : new OpenAiCompatibleProvider(config);
}

export interface AiModelDescriptor { provider: string; modelName: string; endpointUrl: string | null; }

/**
 * Dựng provider từ cấu hình model + biến môi trường. Key chỉ lấy từ env, không bao giờ
 * lưu trong DB. Trả null nếu thiếu key/endpoint để tầng gọi báo "chưa cấu hình".
 */
function envFlag(env: Record<string, string | undefined>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function providerFromModel(model: AiModelDescriptor, env: Record<string, string | undefined>): AiProvider | null {
  const providerHint = (env.AI_PROVIDER ?? model.provider).toLowerCase();
  const isAnthropic = providerHint.includes('anthropic') || providerHint.includes('claude') || model.provider.toLowerCase().includes('anthropic') || model.provider.toLowerCase().includes('claude');
  const kind: AiProviderKind = isAnthropic ? 'ANTHROPIC' : 'OPENAI_COMPATIBLE';
  const apiKey = isAnthropic
    ? envFlag(env, 'AI_ANTHROPIC_API_KEY')
    : envFlag(env, 'AI_OPENAI_API_KEY', 'AI_API_KEY');
  const openaiBase = envFlag(env, 'AI_OPENAI_BASE_URL', 'AI_BASE_URL');
  const anthropicBase = envFlag(env, 'AI_ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com/v1';
  const baseUrl = model.endpointUrl ?? (isAnthropic ? anthropicBase : openaiBase);
  const modelName = model.modelName || (isAnthropic ? envFlag(env, 'AI_ANTHROPIC_MODEL') : envFlag(env, 'AI_OPENAI_MODEL')) || '';
  if (!apiKey || !baseUrl || !modelName) return null;
  const config: AiProviderConfig = { baseUrl, apiKey, modelName, embeddingModel: env.AI_EMBEDDING_MODEL };
  const embeddingKey = envFlag(env, 'AI_OPENAI_API_KEY', 'AI_API_KEY');
  const embeddingProvider = isAnthropic && embeddingKey && openaiBase
    ? new OpenAiCompatibleProvider({ baseUrl: openaiBase, apiKey: embeddingKey, modelName: env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small', embeddingModel: env.AI_EMBEDDING_MODEL })
    : undefined;
  return createAiProvider(kind, config, embeddingProvider);
}

function modelNameOf(provider: AiProvider): string {
  if (provider instanceof OpenAiCompatibleProvider || provider instanceof AnthropicProvider) return provider.config.modelName;
  return '';
}

function cloneWithModel(provider: AiProvider, modelName: string): AiProvider {
  if (provider instanceof OpenAiCompatibleProvider) return provider.withModel(modelName);
  if (provider instanceof AnthropicProvider) return provider.withModel(modelName);
  return provider;
}

/** Gọi chat; timeout mặc định 10s; abort/5xx thì thử AI_FALLBACK_MODEL. */
export async function chatWithFallback(
  provider: AiProvider,
  messages: AiMessage[],
  options: AiChatOptions = {},
  env: Record<string, string | undefined> = process.env,
): Promise<AiChatResult & { usedModel: string }> {
  const timeoutMs = options.timeoutMs ?? envTimeoutMs(env);
  const primary = modelNameOf(provider);
  try {
    const result = await provider.chat(messages, { ...options, timeoutMs });
    return { ...result, usedModel: primary };
  } catch (error) {
    const fallback = envFallbackModel(env);
    if (!fallback || fallback === primary) throw error;
    const result = await cloneWithModel(provider, fallback).chat(messages, { ...options, timeoutMs });
    return { ...result, usedModel: fallback };
  }
}
