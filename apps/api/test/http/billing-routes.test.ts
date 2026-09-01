import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const admin = { userId: 'admin-1', role: 'PLATFORM_ADMIN' as const, schoolId: null, email: 'admin@example.test', displayName: 'Admin' };
const owner = { userId: 'owner-1', role: 'SCHOOL_OWNER' as const, schoolId: 'school-a', email: 'owner@example.test', displayName: 'Cô Lan' };
const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const schoolUuid = '11111111-1111-1111-1111-111111111111';

function buildStub(calls: string[]) {
  return {
    getSchoolBillingOverview: async () => ({ status: 'ACTIVE', classCount: 32, includedClassQuota: 30, basePriceVnd: 1000000000, extraClassPriceVnd: 50000000, extraClassCount: 2, monthlyChargeVnd: 1100000000, isChargeable: true, trialEndsAt: null, manualOverrideReason: null, events: [] }),
    adminListSubscriptions: async () => [{ schoolId: schoolUuid, schoolName: 'THPT A', status: 'ACTIVE', classCount: 32, includedClassQuota: 30, basePriceVnd: 1000000000, extraClassPriceVnd: 50000000, extraClassCount: 2, monthlyChargeVnd: 1100000000, trialEndsAt: null, manualOverrideReason: null }],
    adminUpdateSubscription: async (_actor: unknown, id: string, _input: unknown, key: string) => { calls.push(`sub:${id}:${key}`); return { schoolId: id, status: 'ACTIVE' }; },
    adminRecordBillingEvent: async (_actor: unknown, id: string, _input: unknown, key: string) => { calls.push(`evt:${id}:${key}`); return { id: 'e1' }; },
    adminListBillingEvents: async () => [{ id: 'e1', kind: 'INVOICE', amountVnd: 1000000000, note: '', createdAt: '2026-01-01T00:00:00.000Z' }],
  };
}

function buildTestApp(currentUser: typeof admin | typeof owner | typeof teacher) {
  const calls: string[] = [];
  const app = buildApp({ authRepository: { getSession: async () => currentUser } as never, platformRepository: buildStub(calls) as never });
  return { app, calls };
}

describe('Billing API surface', () => {
  it('lets an owner read their billing overview but not admin subscription list', async () => {
    const { app } = buildTestApp(owner);
    const overview = await app.inject({ method: 'GET', url: '/api/v1/billing/overview', headers: { cookie: 'smartpath_session=test' } });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().data).toMatchObject({ status: 'ACTIVE' });
    const denied = await app.inject({ method: 'GET', url: '/api/v1/admin/billing/subscriptions', headers: { cookie: 'smartpath_session=test' } });
    expect(denied.statusCode).toBe(403);
    await app.close();
  });

  it('lets an admin update a subscription and record an event', async () => {
    const { app, calls } = buildTestApp(admin);
    const list = await app.inject({ method: 'GET', url: '/api/v1/admin/billing/subscriptions', headers: { cookie: 'smartpath_session=test' } });
    expect(list.statusCode).toBe(200);
    const updated = await app.inject({ method: 'PUT', url: `/api/v1/admin/schools/${schoolUuid}/subscription`, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'sub-key-1' }, payload: { status: 'ACTIVE', includedClassQuota: 30, basePriceVnd: 1000000000, extraClassPriceVnd: 50000000 } });
    expect(updated.statusCode).toBe(200);
    expect(calls).toContain(`sub:${schoolUuid}:sub-key-1`);
    const event = await app.inject({ method: 'POST', url: `/api/v1/admin/schools/${schoolUuid}/billing-events`, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'evt-key-1' }, payload: { kind: 'PAYMENT', amountVnd: 1000000000, note: 'chuyển khoản' } });
    expect(event.statusCode).toBe(201);
    expect(calls).toContain(`evt:${schoolUuid}:evt-key-1`);
    await app.close();
  });

  it('blocks teachers from billing overview', async () => {
    const { app } = buildTestApp(teacher);
    const denied = await app.inject({ method: 'GET', url: '/api/v1/billing/overview', headers: { cookie: 'smartpath_session=test' } });
    expect(denied.statusCode).toBe(403);
    await app.close();
  });
});
