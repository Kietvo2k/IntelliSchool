import { describe, expect, it } from 'vitest';
import { calculateMonthlyCharge } from '../../src/domain/admin/billing.js';
import { assertCrawlUrlIsSafe } from '../../src/domain/admin/crawler-safety.js';

describe('admin billing and crawler controls', () => {
  it('calculates the configured class overage while respecting a manual free override', () => {
    expect(calculateMonthlyCharge({ classCount: 32, includedClassQuota: 30, basePriceVnd: 10_000_000, extraClassPriceVnd: 500_000, status: 'ACTIVE' })).toEqual({ amountVnd: 11_000_000, extraClassCount: 2, isChargeable: true });
    expect(calculateMonthlyCharge({ classCount: 99, includedClassQuota: 30, basePriceVnd: 10_000_000, extraClassPriceVnd: 500_000, status: 'FREE' })).toEqual({ amountVnd: 0, extraClassCount: 69, isChargeable: false });
  });

  it('fetches an allowlisted HTTPS page excerpt and blocks redirects', async () => {
    const { fetchAllowlistedExcerpt } = await import('../../src/domain/admin/crawler-safety.js');
    const ready = await fetchAllowlistedExcerpt(new URL('https://catalog.example.edu.vn/data'), async () => new Response('<p>Điểm chuẩn 2025</p>', { status: 200 }));
    expect(ready.status).toBe('READY');
    expect(String(ready.result.excerpt)).toContain('Điểm chuẩn 2025');
    const redirected = await fetchAllowlistedExcerpt(new URL('https://catalog.example.edu.vn/data'), async () => new Response('', { status: 302, headers: { location: 'https://evil.example' } }));
    expect(redirected.status).toBe('FAILED');
  });

  it('accepts an allowlisted HTTPS crawl URL but blocks private and unapproved targets before a fetch occurs', () => {
    expect(assertCrawlUrlIsSafe('https://catalog.example.edu.vn/data', new Set(['catalog.example.edu.vn']))).toEqual(new URL('https://catalog.example.edu.vn/data'));
    expect(() => assertCrawlUrlIsSafe('http://catalog.example.edu.vn/data', new Set(['catalog.example.edu.vn']))).toThrowError(expect.objectContaining({ code: 'CRAWL_HTTPS_REQUIRED' }));
    expect(() => assertCrawlUrlIsSafe('https://127.0.0.1/private', new Set(['127.0.0.1']))).toThrowError(expect.objectContaining({ code: 'CRAWL_IP_NOT_ALLOWED' }));
    expect(() => assertCrawlUrlIsSafe('https://evil.example/data', new Set(['catalog.example.edu.vn']))).toThrowError(expect.objectContaining({ code: 'CRAWL_HOST_NOT_ALLOWLISTED' }));
  });

  it('rejects every resolved private address in an allowlisted hostname', async () => {
    const { assertCrawlUrlResolvesToPublic } = await import('../../src/domain/admin/crawler-safety.js');
    const url = new URL('https://catalog.example.edu.vn/data');

    await expect(assertCrawlUrlResolvesToPublic(url, async () => [{ address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }])).rejects.toMatchObject({ code: 'CRAWL_IP_NOT_ALLOWED' });
    await expect(assertCrawlUrlResolvesToPublic(url, async () => [{ address: '2001:db8::1', family: 6 }])).resolves.toEqual(url);
  });
});
