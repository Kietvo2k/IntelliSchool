import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
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

type ResolvedAddress = { address: string; family: 4 | 6 };
type AddressResolver = (hostname: string, options: { all: true }) => Promise<ResolvedAddress[]>;
const defaultAddressResolver: AddressResolver = (hostname, options) => lookup(hostname, options) as Promise<ResolvedAddress[]>;
const MAX_CRAWL_RESPONSE_BYTES = 1_000_000;

function privateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 || (first === 100 && second! >= 64 && second! <= 127)
    || (first === 169 && second === 254) || (first === 172 && second! >= 16 && second! <= 31)
    || (first === 192 && (second === 0 || second === 168)) || (first === 198 && second! >= 18 && second! <= 19)
    || (first === 198 && second === 51) || (first === 203 && second === 0)
    || first! >= 224;
}

function ipv6Words(address: string): number[] | null {
  const withoutZone = address.toLowerCase().split('%', 1)[0]!;
  const pieces = withoutZone.split('::');
  if (pieces.length > 2) return null;
  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const segments = side.split(':');
    const result: number[] = [];
    for (const segment of segments) {
      if (segment.includes('.')) {
        if (segment !== segments.at(-1)) return null;
        const octets = segment.split('.').map(Number);
        if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
        result.push((octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(segment)) return null;
        result.push(Number.parseInt(segment, 16));
      }
    }
    return result;
  };
  const left = parseSide(pieces[0]!);
  const right = parseSide(pieces.length === 2 ? pieces[1]! : '');
  if (!left || !right) return null;
  if (pieces.length === 1) return left.length === 8 ? left : null;
  const zeros = 8 - left.length - right.length;
  return zeros > 0 ? [...left, ...Array.from({ length: zeros }, () => 0), ...right] : null;
}

function privateIp(address: string): boolean {
  if (isIP(address) === 4) return privateIpv4(address);
  if (isIP(address) !== 6) return true;
  const words = ipv6Words(address);
  if (!words) return true;
  const mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (mapped) return privateIpv4(`${words[6]! >> 8}.${words[6]! & 255}.${words[7]! >> 8}.${words[7]! & 255}`);
  const first = words[0]!;
  return words.every((word) => word === 0) || (words.slice(0, 7).every((word) => word === 0) && words[7] === 1)
    || (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00
    || (first === 0x2001 && (words[1] === 0x0002 || words[1] === 0x0db8));
}

async function resolvePublicAddresses(url: URL, resolver: AddressResolver = defaultAddressResolver): Promise<ResolvedAddress[]> {
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(url.hostname, { all: true });
  } catch {
    throw new AppError(422, 'CRAWL_DNS_RESOLUTION_FAILED', 'Không thể xác minh địa chỉ của URL crawl.');
  }
  if (!addresses.length || addresses.some((item) => privateIp(item.address))) {
    throw new AppError(422, 'CRAWL_IP_NOT_ALLOWED', 'URL crawl không được trỏ tới địa chỉ mạng riêng hoặc dành riêng.');
  }
  return addresses;
}

/** Resolves every DNS record and rejects the hostname if any address is non-public. */
export async function assertCrawlUrlResolvesToPublic(url: URL, resolver: AddressResolver = defaultAddressResolver): Promise<URL> {
  await resolvePublicAddresses(url, resolver);
  return url;
}

async function fetchPinned(url: URL): Promise<{ status: number; ok: boolean; text(): Promise<string> }> {
  const addresses = await resolvePublicAddresses(url);
  const address = addresses[0]!.address;
  return new Promise((resolve, reject) => {
    const request = httpsRequest({
      hostname: address,
      port: url.port ? Number(url.port) : 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: { host: url.host, 'user-agent': 'SmartPathCatalogBot/1.0' },
      servername: url.hostname,
      rejectUnauthorized: true,
      timeout: 8_000,
    }, (response) => {
      const declaredLength = Number(response.headers['content-length'] ?? 0);
      if (declaredLength > MAX_CRAWL_RESPONSE_BYTES) {
        response.resume();
        request.destroy();
        reject(new Error('crawl_response_too_large'));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_CRAWL_RESPONSE_BYTES) {
          response.destroy(new Error('crawl_response_too_large'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode ?? 502, ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300, text: async () => Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('timeout', () => request.destroy(new Error('crawl_timeout')));
    request.on('error', reject);
    request.end();
  });
}

export async function fetchAllowlistedExcerpt(url: URL, fetcher?: typeof fetch): Promise<{ status: 'READY' | 'FAILED'; result: Record<string, unknown> }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 8_000);
    const response = fetcher
      ? await fetcher(url.toString(), { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { 'user-agent': 'SmartPathCatalogBot/1.0' } })
      : await fetchPinned(url);
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
  } finally {
    if (timer) clearTimeout(timer);
  }
}
