import { isIP } from 'node:net';

/** Validates a queue request before the worker resolves or fetches a remote URL. */
export function assertCrawlUrlIsSafe(rawUrl: string, allowedHosts: ReadonlySet<string>): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Crawl URL is invalid');
  }
  if (url.protocol !== 'https:') throw new Error('HTTPS is required');
  if (url.username || url.password) throw new Error('Crawl URL cannot contain credentials');
  if (url.port && url.port !== '443') throw new Error('Crawl URL must use the default HTTPS port');
  const host = url.hostname.toLowerCase();
  if (isIP(host) !== 0) throw new Error('IP hosts are not allowed');
  if (!allowedHosts.has(host)) throw new Error('Crawl host is not allowlisted');
  return url;
}
