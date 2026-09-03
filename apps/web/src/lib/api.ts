import { beginTrackedRequest } from './requestTracker.js';

const CACHE_KEY = 'smartpath-api-base';
const HEALTH_TIMEOUT_MS = 700;
const EXTRA_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 5173] as const;
const envBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

let resolvedBase: string | null = null;
let resolving: Promise<string> | null = null;

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function isSmartPathHealth(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const data = (payload as { data?: { status?: string; product?: string } }).data;
  return data?.status === 'ok' && typeof data.product === 'string' && (data.product.includes('Smart Path') || data.product.includes('IntelliSchool'));
}

async function probe(base: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/healthz`, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) return false;
    return isSmartPathHealth(await response.json().catch(() => null));
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

function hostOrigin(protocol: string, hostname: string, port: string | number): string {
  return `${protocol}//${hostname}:${port}`;
}

function preferredBases(): string[] {
  if (typeof window === 'undefined') return unique([envBase, '']);
  const { protocol, hostname, origin, port } = window.location;
  return unique([
    envBase,
    '',
    origin,
    port ? hostOrigin(protocol, hostname, port) : origin,
    hostOrigin(protocol, hostname, 8080),
    hostOrigin(protocol, hostname, 5176),
  ]);
}

function extraBases(): string[] {
  if (typeof window === 'undefined') return [];
  const { protocol, hostname } = window.location;
  const skip = new Set(preferredBases());
  return EXTRA_PORTS.map((item) => hostOrigin(protocol, hostname, item)).filter((base) => !skip.has(base));
}

async function discoverApiBase(): Promise<string> {
  if (typeof window === 'undefined') return envBase;
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached !== null && await probe(cached)) return cached;
  } catch {
    /* private mode */
  }

  for (const base of unique(preferredBases())) {
    if (await probe(base)) return base;
  }

  const extras = extraBases();
  const found = await Promise.all(extras.map(async (base) => ({ base, ok: await probe(base) })));
  const hit = extras.find((base) => found.some((item) => item.base === base && item.ok));
  return hit ?? envBase;
}

export async function ensureApiBase(): Promise<string> {
  if (resolvedBase !== null) return resolvedBase;
  resolving ??= discoverApiBase().then((base) => {
    resolvedBase = base;
    try { sessionStorage.setItem(CACHE_KEY, base); } catch { /* quota / private mode */ }
    return base;
  });
  return resolving;
}

export function apiUrl(path: string): string {
  return `${resolvedBase ?? envBase}${path}`;
}

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export class ApiRequestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string | undefined>;
}

function withQuery(path: string, query?: Record<string, string | undefined>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const endTrack = beginTrackedRequest();
  try {
    await ensureApiBase();
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.idempotencyKey) headers['x-idempotency-key'] = options.idempotencyKey;
    const response = await fetch(apiUrl(withQuery(path, options.query)), {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => null) as { data?: T; error?: { code: string; message: string } } | null;
    if (!response.ok) {
      throw new ApiRequestError(payload?.error?.code ?? 'UNKNOWN_ERROR', payload?.error?.message ?? 'Có lỗi không mong muốn. Vui lòng thử lại.');
    }
    return (payload?.data ?? null) as T;
  } finally {
    endTrack();
  }
}

export async function downloadFile(path: string): Promise<{ blob: Blob; filename: string }> {
  await ensureApiBase();
  const response = await fetch(apiUrl(path), { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new ApiRequestError(payload?.error?.code ?? 'DOWNLOAD_FAILED', payload?.error?.message ?? 'Không thể tải file.');
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return { blob: await response.blob(), filename: encoded ? decodeURIComponent(encoded) : (plain ?? 'smartpath-download') };
}

export function triggerDownload(file: { blob: Blob; filename: string }): void {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
