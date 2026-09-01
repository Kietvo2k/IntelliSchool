import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { PostgresAuthRepository } from '../src/repositories/postgres-auth.js';
import { PostgresSchoolAdministrationRepository } from '../src/repositories/postgres-school-administration.js';
import { pilotAccounts, resetAndSeedPilotData } from '../src/seed-pilot.js';

const publicUrl = process.env.SMARTPATH_TEST_PUBLIC_DATABASE_URL ?? 'postgres://smartpath_public:smartpath_public_local_only@127.0.0.1:5433/smartclass';
const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const authRepository = new PostgresAuthRepository(new pg.Pool({ connectionString: controlUrl }));
const schoolAdministrationRepository = new PostgresSchoolAdministrationRepository({ publicPool: new pg.Pool({ connectionString: publicUrl }), controlPool: new pg.Pool({ connectionString: controlUrl }) });
const app = buildApp({ authRepository, schoolAdministrationRepository });

function sessionCookie(response: { headers: Record<string, string | string[] | number | undefined> }): string {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') throw new Error('Missing session cookie.');
  return value.split(';', 1)[0]!;
}

beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
afterAll(async () => { await app.close(); await controlPool.end(); await Promise.all([authRepository.close(), schoolAdministrationRepository.close()]); });

describe('authentication boundary', () => {
  it('creates an httpOnly session cookie for a valid password login', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: pilotAccounts.platformAdmin });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Lax');
    expect(response.headers['set-cookie']).not.toContain(pilotAccounts.platformAdmin.password);
  });

  it('does not authorize a forged legacy role header', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/school-requests', headers: { 'x-smartclass-user-id': 'admin', 'x-smartclass-role': 'PLATFORM_ADMIN' } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('lets only an authenticated platform admin approve a pending school request', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: pilotAccounts.platformAdmin });
    const created = await app.inject({ method: 'POST', url: '/api/v1/public/school-requests', payload: { schoolName: 'THPT Hoàng Văn Thụ', principalName: 'Đặng Minh Châu', principalEmail: 'chau.hoangvanthu@example.test', province: 'Quảng Nam' } });
    expect(created.statusCode).toBe(201);
    const approved = await app.inject({ method: 'POST', url: `/api/v1/admin/school-requests/${created.json().data.id}/approve`, headers: { cookie: sessionCookie(login), origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'school-approve-auth-test-001' }, payload: { reason: 'Duyệt cho pilot mở rộng.' } });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.school.code).toMatch(/^SP-[A-Z0-9]{8}$/);
    const replay = await app.inject({ method: 'POST', url: `/api/v1/admin/school-requests/${created.json().data.id}/approve`, headers: { cookie: sessionCookie(login), origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'school-approve-auth-test-001' }, payload: { reason: 'Duyệt cho pilot mở rộng.' } });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().data.school.id).toBe(approved.json().data.school.id);
  });
});


