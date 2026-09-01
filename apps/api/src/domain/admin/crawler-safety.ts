import { isIP } from 'node:net';

import { AppError } from '../../errors.js';

/** Validates a queue request before the worker resolves or fetches a remote URL. */
export function assertCrawlUrlIsSafe(rawUrl: string, allowedHosts: ReadonlySet<string>): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(422, 'CRAWL_URL_INVALID', 'URL crawl không hợp lệ.');
  }
  if (url.protocol !== 'https:') throw new AppError(422, 'CRAWL_HTTPS_REQUIRED', 'URL crawl phải dùng HTTPS.');
  if (url.username || url.password) throw new AppError(422, 'CRAWL_CREDENTIALS_NOT_ALLOWED', 'URL crawl không được chứa thông tin đăng nhập.');
  if (url.port && url.port !== '443') throw new AppError(422, 'CRAWL_PORT_NOT_ALLOWED', 'URL crawl phải dùng cổng HTTPS mặc định.');
  const host = url.hostname.toLowerCase();
  if (isIP(host) !== 0) throw new AppError(422, 'CRAWL_IP_NOT_ALLOWED', 'URL crawl không được trỏ tới địa chỉ IP.');
  if (!allowedHosts.has(host)) throw new AppError(422, 'CRAWL_HOST_NOT_ALLOWLISTED', 'Tên miền crawl chưa được cho phép.');
  return url;
}

export async function fetchAllowlistedExcerpt(url: URL, fetcher: typeof fetch = fetch): Promise<{ status: 'READY' | 'FAILED'; result: Record<string, unknown> }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const response = await fetcher(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'SmartPathCatalogBot/1.0' },
    });
    clearTimeout(timer);
    if (response.status >= 300 && response.status < 400) {
      return { status: 'FAILED', result: { error: 'Redirect blocked', statusCode: response.status } };
    }
    const text = await response.text();
    const excerpt = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4_000);
    return {
      status: response.ok ? 'READY' : 'FAILED',
      result: { statusCode: response.status, excerpt, fetchedAt: new Date().toISOString(), bytes: text.length },
    };
  } catch (error) {
    return { status: 'FAILED', result: { error: error instanceof Error ? error.message : 'fetch_failed' } };
  }
}
