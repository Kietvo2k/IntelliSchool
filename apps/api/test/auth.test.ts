import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

  it('requires idempotency for school-request rejection', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: pilotAccounts.platformAdmin });
    const created = await app.inject({ method: 'POST', url: '/api/v1/public/school-requests', payload: { schoolName: 'THPT Trần Phú', principalName: 'Nguyễn Minh Hải', principalEmail: 'hai.tranphu@example.test', province: 'Hà Nội' } });
    const missing = await app.inject({ method: 'POST', url: `/api/v1/admin/school-requests/${created.json().data.id}/reject`, headers: { cookie: sessionCookie(login), origin: 'http://127.0.0.1:5176' }, payload: { reason: 'Chưa đủ hồ sơ xác minh.' } });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('updates a profile with text-safe SQL parameters and writes one audit event', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: pilotAccounts.student });
    expect(login.statusCode, login.body).toBe(200);
    const actor = await authRepository.getSession(sessionCookie(login).split('=', 2)[1]!);
    expect(actor).toBeTruthy();
    const updated = await schoolAdministrationRepository.updateProfile(actor!, { displayName: 'Minh An đã cập nhật' }, 'profile-sql-regression-1') as { displayName: string };
    expect(updated.displayName).toBe('Minh An đã cập nhật');
    const audit = await controlPool.query<{ action: string; target_id: string }>("SELECT action, target_id FROM audit_events WHERE action = 'PROFILE_UPDATED' AND actor_id = $1 ORDER BY created_at DESC LIMIT 1", [actor!.userId]);
    expect(audit.rows[0]).toEqual({ action: 'PROFILE_UPDATED', target_id: actor!.userId });
  });

  it('sends the school-owner activation email after approval commits', async () => {
    const admin = (await controlPool.query<{ id: string }>('SELECT user_id AS id FROM platform_admins LIMIT 1')).rows[0]!;
    const mailer = { sendActivation: vi.fn(async () => undefined), sendPasswordReset: vi.fn(async () => undefined) };
    const repository = new PostgresSchoolAdministrationRepository({ publicPool: new pg.Pool({ connectionString: publicUrl }), controlPool: new pg.Pool({ connectionString: controlUrl }), mailer });
    const created = await repository.createSchoolRequest({ schoolName: 'THPT Activation Test', principalName: 'Phạm Minh Khoa', principalEmail: 'activation-owner@example.test', province: 'Hải Phòng' });
    const approved = await repository.approveSchoolRequest(created.id, admin.id, 'Đủ hồ sơ xác minh.', 'school-activation-email-1');
    expect(approved?.activationEmailQueued).toBe(true);
    expect(mailer.sendActivation).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(approved)).not.toContain('token');
    await repository.close?.();
  });
});


