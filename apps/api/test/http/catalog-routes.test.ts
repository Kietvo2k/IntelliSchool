import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const admin = { userId: 'admin-1', role: 'PLATFORM_ADMIN' as const, email: 'admin@example.test', displayName: 'Platform Admin' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };

function buildStub(calls: string[]) {
  return {
    listCareers: async () => [{ id: 'c1', code: 'SOFTWARE_ENGINEER', name: 'Kỹ sư phần mềm', description: '', riasecWeights: {}, majorCount: 1 }],
    listInstitutions: async () => [{ id: 'i1', code: 'DUT', name: 'ĐH Bách khoa Đà Nẵng', province: 'Đà Nẵng', type: 'UNIVERSITY', programCount: 1 }],
    getInstitutionDetail: async (_actor: unknown, id: string) => ({ id, code: 'DUT', name: 'ĐH Bách khoa Đà Nẵng', programs: [], scholarships: [] }),
    listScholarships: async () => [{ id: 's1', title: 'Học bổng STEM', criteria: {}, deadlineAt: null, sourceUrl: 'https://example.test', institutionName: 'DUT' }],
    adminUpsertCareer: async (_actor: unknown, input: { code: string }, key: string) => { calls.push(`career:${key}`); return { id: 'c1', code: input.code }; },
    adminImportAdmissionScores: async (_actor: unknown, input: { rows: unknown[] }, key: string) => { calls.push(`import:${key}`); return { imported: input.rows.length }; },
  };
}

function buildTestApp(currentUser: typeof admin | typeof student = admin) {
  const calls: string[] = [];
  const app = buildApp({ authRepository: { getSession: async () => currentUser } as never, platformRepository: buildStub(calls) as never });
  return { app, calls };
}

describe('career catalog API surface', () => {
  it('lets any authenticated user browse careers, institutions and scholarships', async () => {
    const { app } = buildTestApp(student);
    const careers = await app.inject({ method: 'GET', url: '/api/v1/careers', headers: { cookie: 'smartpath_session=test' } });
    expect(careers.statusCode).toBe(200);
    expect(careers.json().data[0]).toMatchObject({ code: 'SOFTWARE_ENGINEER' });
    const scholarships = await app.inject({ method: 'GET', url: '/api/v1/scholarships', headers: { cookie: 'smartpath_session=test' } });
    expect(scholarships.statusCode).toBe(200);
    await app.close();
  });

  it('only lets a platform admin manage the catalog and import admission scores', async () => {
    const { app, calls } = buildTestApp(admin);
    const created = await app.inject({ method: 'POST', url: '/api/v1/admin/careers', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'career-upsert-1' }, payload: { code: 'DATA_SCIENTIST', name: 'Nhà khoa học dữ liệu' } });
    expect(created.statusCode).toBe(201);
    expect(calls).toContain('career:career-upsert-1');
    await app.close();

    const studentApp = buildTestApp(student).app;
    const forbidden = await studentApp.inject({ method: 'POST', url: '/api/v1/admin/careers', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'career-upsert-2' }, payload: { code: 'X', name: 'Y' } });
    expect(forbidden.statusCode).toBe(403);
    await studentApp.close();
  });

  it('rejects an admission score import with an invalid exam block before it reaches the repository', async () => {
    const { app } = buildTestApp(admin);
    const response = await app.inject({ method: 'POST', url: '/api/v1/admin/admission-scores/import', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'import-1' }, payload: { rows: [{ institutionCode: 'DUT', majorCode: 'CS', year: 2026, examBlock: 'ZZZZZ', score: 25 }] } });
    expect(response.statusCode).toBe(422);
    await app.close();
  });

  it('accepts an extra A00-style exam block that is not in the 98-code dictionary', async () => {
    const { app, calls } = buildTestApp(admin);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/admission-scores/import',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'import-d02' },
      payload: { rows: [{ institutionCode: 'DUT', majorCode: 'CS', year: 2026, examBlock: 'D02', score: 25, sourceUrl: 'https://example.test/score' }] },
    });
    expect(response.statusCode).toBe(201);
    expect(calls).toContain('import:import-d02');
    await app.close();
  });
});
