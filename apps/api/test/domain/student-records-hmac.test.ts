import { describe, expect, it } from 'vitest';
import { studentRecordsHmacMatches, studentRecordsSignature } from '../../src/domain/records/hmac.js';

describe('internal student-records HMAC', () => {
  it('accepts a matching signature and rejects a truncated one', () => {
    const secret = 'test-secret-not-for-production';
    const signature = studentRecordsSignature(secret, '1710000000', 'sphs-2026-000001');
    expect(studentRecordsHmacMatches(secret, '1710000000', 'SPHS-2026-000001', signature)).toBe(true);
    expect(studentRecordsHmacMatches(secret, '1710000000', 'SPHS-2026-000001', signature.slice(0, 8))).toBe(false);
  });
});
