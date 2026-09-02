import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatOptions {
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  requestId?: string;
  signal?: AbortSignal;
  responseFormat?: Record<string, unknown>;
}

export interface AiChatResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  providerRequestId?: string;
}

export interface AiProvider {
  readonly kind: 'OPENAI_COMPATIBLE' | 'ANTHROPIC';
  chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiChatResult>;
  embed(texts: string[], options?: Pick<AiChatOptions, 'requestId' | 'timeoutMs' | 'signal'>): Promise<number[][]>;
}

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  embeddingModel?: string;
  allowedBaseUrls?: readonly string[];
  enforceNetworkSafety?: boolean;
}

export class AiProviderError extends Error {
  constructor(public readonly code: 'AI_PROVIDER_UNAVAILABLE' | 'AI_CANCELLED' | 'AI_ENDPOINT_NOT_ALLOWED', message: string, public readonly status?: number) {
    super(`${code}: ${message}`);
    this.name = 'AiProviderError';
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2;

export function envTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? Math.min(raw, 120_000) : DEFAULT_TIMEOUT_MS;
}

function ipv4IsPrivate(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0) || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19)) || first >= 224;
}

function isPrivateAddress(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(host) === 4) return ipv4IsPrivate(host);
  if (isIP(host) === 6) {
    return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8')
      || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')
      || (host.startsWith('::ffff:') && ipv4IsPrivate(host.slice('::ffff:'.length)));
  }
  return host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal';
}

function normalizeBaseUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (!url.hostname || isPrivateAddress(url.hostname)) return null;
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}

function configuredAllowedBaseUrls(env: Record<string, string | undefined>, provider: AiProviderKind): string[] {
  const configured = (env.AI_ALLOWED_PROVIDER_BASE_URLS ?? '').split(',').map((item) => normalizeBaseUrl(item)).filter((item): item is string => Boolean(item));
  const primary = provider === 'ANTHROPIC' ? env.AI_ANTHROPIC_BASE_URL : env.AI_OPENAI_BASE_URL ?? env.AI_BASE_URL;
  const normalizedPrimary = primary ? normalizeBaseUrl(primary) : null;
  return [...new Set([...configured, ...(normalizedPrimary ? [normalizedPrimary] : [])])];
}

export interface ProviderEndpointValidation {
  ok: boolean;
  normalizedUrl?: string;
  reason?: 'INVALID_URL' | 'HTTPS_REQUIRED' | 'PRIVATE_IP' | 'NOT_ALLOWLISTED';
}

export function validateProviderEndpoint(raw: string, allowedBaseUrls: readonly string[]): ProviderEndpointValidation {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'INVALID_URL' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'HTTPS_REQUIRED' };
  if (parsed.username || parsed.password || parsed.search || parsed.hash || isPrivateAddress(parsed.hostname)) return { ok: false, reason: 'PRIVATE_IP' };
  const normalizedUrl = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  const normalizedAllowlist = allowedBaseUrls.map(normalizeBaseUrl).filter((item): item is string => Boolean(item));
  if (!normalizedAllowlist.includes(normalizedUrl)) return { ok: false, reason: 'NOT_ALLOWLISTED' };
  return { ok: true, normalizedUrl };
}

async function assertSafeRequestUrl(raw: string, config: AiProviderConfig): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AiProviderError('AI_ENDPOINT_NOT_ALLOWED', 'Endpoint không hợp lệ.');
  }
  if (!config.enforceNetworkSafety) return;
  const baseUrl = new URL(config.baseUrl);
  const base = `${parsed.origin}${baseUrl.pathname.replace(/\/$/, '')}`;
  if (!validateProviderEndpoint(base, config.allowedBaseUrls ?? []).ok) throw new AiProviderError('AI_ENDPOINT_NOT_ALLOWED', 'Endpoint không nằm trong allowlist HTTPS.');
  if (isPrivateAddress(parsed.hostname)) throw new AiProviderError('AI_ENDPOINT_NOT_ALLOWED', 'Endpoint trỏ tới địa chỉ nội bộ.');
  if (!isIP(parsed.hostname)) {
    try {
      const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
      if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
        throw new AiProviderError('AI_ENDPOINT_NOT_ALLOWED', 'Endpoint phân giải tới địa chỉ nội bộ.');
      }
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError('AI_ENDPOINT_NOT_ALLOWED', 'Không thể xác thực DNS của endpoint.');
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /aborted/i.test(error.message));
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number, config: AiProviderConfig, requestId?: string, signal?: AbortSignal): Promise<{ body: unknown; providerRequestId?: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await assertSafeRequestUrl(url, config);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortExternal = () => controller.abort();
    signal?.addEventListener('abort', abortExternal, { once: true });
    let retry = false;
    try {
      if (signal?.aborted) throw new AiProviderError('AI_CANCELLED', 'Yêu cầu AI đã bị hủy.');
      const response = await fetch(url, {
        ...init,
        redirect: 'error',
        signal: controller.signal,
        headers: { ...(init.headers ?? {}), ...(requestId ? { 'x-client-request-id': requestId } : {}) },
      });
      if (!response.ok) throw new AiProviderError('AI_PROVIDER_UNAVAILABLE', `Provider HTTP ${response.status}.`, response.status);
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new AiProviderError('AI_PROVIDER_UNAVAILABLE', 'Provider trả về dữ liệu không đọc được.');
      }
      return { body, providerRequestId: response.headers.get('x-request-id') ?? undefined };
    } catch (error) {
      lastError = error;
      if (error instanceof AiProviderError && error.code === 'AI_CANCELLED') throw error;
      if (signal?.aborted) throw new AiProviderError('AI_CANCELLED', 'Yêu cầu AI đã bị hủy.');
      retry = attempt < MAX_ATTEMPTS && !isAbortError(error) && (!(error instanceof AiProviderError) || error.status === 429 || (error.status !== undefined && error.status >= 500));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortExternal);
    }
    if (!retry) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }
  if (lastError instanceof AiProviderError) throw lastError;
  throw new AiProviderError('AI_PROVIDER_UNAVAILABLE', 'Không thể kết nối provider AI.');
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly kind = 'OPENAI_COMPATIBLE' as const;
  constructor(readonly config: AiProviderConfig) {}

  withModel(modelName: string): OpenAiCompatibleProvider {
    return new OpenAiCompatibleProvider({ ...this.config, modelName });
  }

  async chat(messages: AiMessage[], options: AiChatOptions = {}): Promise<AiChatResult> {
    const payload: Record<string, unknown> = {
      model: this.config.modelName,
      messages,
      max_tokens: options.maxOutputTokens ?? 800,
      temperature: options.temperature ?? 0.3,
    };
    if (options.responseFormat) payload.response_format = options.responseFormat;
    const response = await fetchJson(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(payload),
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS, this.config, options.requestId, options.signal);
    const body = response.body as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return {
      text: typeof body.choices?.[0]?.message?.content === 'string' ? body.choices[0]!.message!.content! : '',
      usage: { inputTokens: Math.max(0, Number(body.usage?.prompt_tokens ?? 0)), outputTokens: Math.max(0, Number(body.usage?.completion_tokens ?? 0)) },
      providerRequestId: response.providerRequestId,
    };
  }

  async embed(texts: string[], options: Pick<AiChatOptions, 'requestId' | 'timeoutMs' | 'signal'> = {}): Promise<number[][]> {
    const response = await fetchJson(`${this.config.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model: this.config.embeddingModel ?? 'text-embedding-3-small', input: texts }),
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS, this.config, options.requestId, options.signal);
    const body = response.body as { data?: Array<{ embedding?: number[] }> };
    return (body.data ?? []).map((row) => Array.isArray(row.embedding) ? row.embedding : []);
  }
}

export class AnthropicProvider implements AiProvider {
  readonly kind = 'ANTHROPIC' as const;
  constructor(readonly config: AiProviderConfig, private readonly embeddingProvider?: AiProvider) {}

  async chat(messages: AiMessage[], options: AiChatOptions = {}): Promise<AiChatResult> {
    const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
    const turns = messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }));
    const response = await fetchJson(`${this.config.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.config.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.config.modelName, system: system || undefined, messages: turns, max_tokens: options.maxOutputTokens ?? 800, temperature: options.temperature ?? 0.3 }),
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS, this.config, options.requestId, options.signal);
    const body = response.body as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    return {
      text: (body.content ?? []).map((block) => block.text ?? '').join(''),
      usage: { inputTokens: Math.max(0, Number(body.usage?.input_tokens ?? 0)), outputTokens: Math.max(0, Number(body.usage?.output_tokens ?? 0)) },
      providerRequestId: response.providerRequestId,
    };
  }

  async embed(texts: string[], options: Pick<AiChatOptions, 'requestId' | 'timeoutMs' | 'signal'> = {}): Promise<number[][]> {
    if (!this.embeddingProvider) throw new AiProviderError('AI_PROVIDER_UNAVAILABLE', 'Anthropic không hỗ trợ embedding trực tiếp.');
    return this.embeddingProvider.embed(texts, options);
  }
}

export type AiProviderKind = 'OPENAI_COMPATIBLE' | 'ANTHROPIC';

export function createAiProvider(kind: AiProviderKind, config: AiProviderConfig, embeddingProvider?: AiProvider): AiProvider {
  return kind === 'ANTHROPIC' ? new AnthropicProvider(config, embeddingProvider) : new OpenAiCompatibleProvider(config);
}

export interface AiModelDescriptor { provider: string; modelName: string; endpointUrl: string | null; }

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
  const apiKey = isAnthropic ? envFlag(env, 'AI_ANTHROPIC_API_KEY') : envFlag(env, 'AI_OPENAI_API_KEY', 'AI_API_KEY');
  const openaiBase = envFlag(env, 'AI_OPENAI_BASE_URL', 'AI_BASE_URL');
  const anthropicBase = envFlag(env, 'AI_ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com/v1';
  const allowedBaseUrls = configuredAllowedBaseUrls(env, kind);
  const configuredBase = isAnthropic ? anthropicBase : openaiBase;
  const baseUrl = model.endpointUrl ?? configuredBase;
  const endpoint = baseUrl ? validateProviderEndpoint(baseUrl, allowedBaseUrls) : { ok: false };
  const modelName = model.modelName || (isAnthropic ? envFlag(env, 'AI_ANTHROPIC_MODEL') : envFlag(env, 'AI_OPENAI_MODEL')) || '';
  if (!apiKey || !endpoint.ok || !modelName) return null;
  const config: AiProviderConfig = { baseUrl: endpoint.normalizedUrl!, apiKey, modelName, embeddingModel: env.AI_EMBEDDING_MODEL, allowedBaseUrls, enforceNetworkSafety: true };
  const embeddingKey = envFlag(env, 'AI_OPENAI_API_KEY', 'AI_API_KEY');
  const embeddingBase = openaiBase ? validateProviderEndpoint(openaiBase, configuredAllowedBaseUrls(env, 'OPENAI_COMPATIBLE')) : { ok: false };
  const embeddingProvider = isAnthropic && embeddingKey && embeddingBase.ok
    ? new OpenAiCompatibleProvider({ baseUrl: embeddingBase.normalizedUrl!, apiKey: embeddingKey, modelName: env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small', embeddingModel: env.AI_EMBEDDING_MODEL, allowedBaseUrls: configuredAllowedBaseUrls(env, 'OPENAI_COMPATIBLE'), enforceNetworkSafety: true })
    : undefined;
  return createAiProvider(kind, config, embeddingProvider);
}

function modelNameOf(provider: AiProvider): string {
  if (provider instanceof OpenAiCompatibleProvider || provider instanceof AnthropicProvider) return provider.config.modelName;
  return '';
}

/** Gọi duy nhất model đã chọn; lỗi provider được giữ nguyên, không fallback giả/model dự phòng. */
export async function chatWithProvider(
  provider: AiProvider,
  messages: AiMessage[],
  options: AiChatOptions = {},
  _env: Record<string, string | undefined> = process.env,
): Promise<AiChatResult & { usedModel: string }> {
  const result = await provider.chat(messages, { ...options, timeoutMs: options.timeoutMs ?? envTimeoutMs(_env) });
  return { ...result, usedModel: modelNameOf(provider) };
}

export interface AiProviderStatus {
  configured: boolean;
  reachable: boolean;
  capabilities: { chat: boolean; embeddings: boolean; structuredOutput: boolean };
  provider: string | null;
  model: string | null;
  checkedAt: string;
  reason?: string;
}

export function buildProviderStatus(input: { configured: boolean; reachable: boolean; provider?: string | null; model?: string | null; checkedAt?: string; capabilities?: Partial<AiProviderStatus['capabilities']>; reason?: string }): AiProviderStatus {
  return {
    configured: input.configured,
    reachable: input.reachable,
    capabilities: {
      chat: input.capabilities?.chat ?? input.configured,
      embeddings: input.capabilities?.embeddings ?? input.configured,
      structuredOutput: input.capabilities?.structuredOutput ?? input.configured,
    },
    provider: input.provider ?? null,
    model: input.model ?? null,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    ...(input.reason ? { reason: input.reason } : {}),
  };
}

export async function checkAiProvider(provider: AiProvider, requestId: string): Promise<AiProviderStatus> {
  const checkedAt = new Date().toISOString();
  try {
    await chatWithProvider(provider, [{ role: 'user', content: 'Trả lời đúng một từ: OK' }], { maxOutputTokens: 5, temperature: 0, requestId });
    return buildProviderStatus({ configured: true, reachable: true, provider: provider.kind, model: modelNameOf(provider), checkedAt, capabilities: { chat: true, embeddings: provider.kind === 'OPENAI_COMPATIBLE', structuredOutput: provider.kind === 'OPENAI_COMPATIBLE' } });
  } catch (error) {
    return buildProviderStatus({ configured: true, reachable: false, provider: provider.kind, model: modelNameOf(provider), checkedAt, capabilities: { chat: true, embeddings: provider.kind === 'OPENAI_COMPATIBLE', structuredOutput: provider.kind === 'OPENAI_COMPATIBLE' }, reason: error instanceof AiProviderError ? error.code : 'AI_PROVIDER_UNAVAILABLE' });
  }
}
