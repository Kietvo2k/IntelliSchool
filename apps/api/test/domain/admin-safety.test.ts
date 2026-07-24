import { describe, expect, it } from 'vitest';
import { calculateMonthlyCharge } from '../../src/domain/admin/billing.js';
import { assertCrawlUrlIsSafe } from '../../src/domain/admin/crawler-safety.js';

describe('admin billing and crawler controls', () => {
  it('calculates the configured class overage while respecting a manual free override', () => {
    expect(calculateMonthlyCharge({ classCount: 32, includedClassQuota: 30, basePriceVnd: 10_000_000, extraClassPriceVnd: 500_000, status: 'ACTIVE' })).toEqual({ amountVnd: 11_000_000, extraClassCount: 2, isChargeable: true });
    expect(calculateMonthlyCharge({ classCount: 99, includedClassQuota: 30, basePriceVnd: 10_000_000, extraClassPriceVnd: 500_000, status: 'FREE' })).toEqual({ amountVnd: 0, extraClassCount: 69, isChargeable: false });
  });

  it('accepts an allowlisted HTTPS crawl URL but blocks private and unapproved targets before a fetch occurs', () => {
    expect(assertCrawlUrlIsSafe('https://catalog.example.edu.vn/data', new Set(['catalog.example.edu.vn']))).toEqual(new URL('https://catalog.example.edu.vn/data'));
    expect(() => assertCrawlUrlIsSafe('http://catalog.example.edu.vn/data', new Set(['catalog.example.edu.vn']))).toThrow('HTTPS is required');
    expect(() => assertCrawlUrlIsSafe('https://127.0.0.1/private', new Set(['127.0.0.1']))).toThrow('IP hosts are not allowed');
    expect(() => assertCrawlUrlIsSafe('https://evil.example/data', new Set(['catalog.example.edu.vn']))).toThrow('Crawl host is not allowlisted');
  });
});
