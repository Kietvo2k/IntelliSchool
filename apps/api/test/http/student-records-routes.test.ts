import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { studentRecordsSignature } from '../../src/domain/records/hmac.js';

describe('internal student-records stub', () => {
  it('rejects a missing HMAC when a secret is configured, otherwise says disabled', async () => {
    const app = buildApp({
      platformRepository: {
        getInternalStudentRecord: async () => ({ studentCode: 'SPHS-2026-000001', grades: [] }),
      } as never,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/internal/student-records/SPHS-2026-000001' });
    expect([401, 503]).toContain(response.statusCode);
    await app.close();
  });

  it('returns the stub record when HMAC matches a configured secret', async () => {
    const previousRecords = process.env.STUDENT_RECORDS_HMAC_SECRET;
    const previousIdentity = process.env.STUDENT_IDENTITY_HMAC_SECRET;
    process.env.STUDENT_RECORDS_HMAC_SECRET = 'unit-test-student-records';
    process.env.STUDENT_IDENTITY_HMAC_SECRET = '';
    const timestamp = '1710000000';
    const hmac = studentRecordsSignature('unit-test-student-records', timestamp, 'SPHS-2026-000001');
    const app = buildApp({
      platformRepository: {
        getInternalStudentRecord: async (code: string) => ({ studentCode: code, displayName: 'Minh An', className: '12A1', grades: [{ subjectName: 'Toán', score: 8, maxScore: 10 }] }),
      } as never,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/student-records/SPHS-2026-000001',
      headers: { 'x-internal-timestamp': timestamp, 'x-internal-hmac': hmac },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.grades[0].subjectName).toBe('Toán');
    await app.close();
    process.env.STUDENT_RECORDS_HMAC_SECRET = previousRecords;
    process.env.STUDENT_IDENTITY_HMAC_SECRET = previousIdentity;
  });
});
