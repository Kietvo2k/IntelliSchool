import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors.js';
import { bootstrapPlatformAdmin } from '../src/services/platform-admin-bootstrap.js';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { PostgresSchoolAdministrationRepository } from '../src/repositories/postgres-school-administration.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const publicUrl = process.env.SMARTPATH_TEST_PUBLIC_DATABASE_URL ?? 'postgres://smartpath_public:smartpath_public_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const publicPool = new pg.Pool({ connectionString: publicUrl });
const apiPool = new pg.Pool({ connectionString: process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass' });
const mailer = { sendActivation: vi.fn(async () => undefined), sendPasswordReset: vi.fn(async () => undefined) };
const email = 'root.bootstrap@smartpath.test';

beforeAll(async () => { await resetAndSeedPilotData(controlPool); });
afterAll(async () => { await Promise.all([controlPool.end(), publicPool.end(), apiPool.end()]); });

describe('platform admin bootstrap', () => {
  it('creates an inactive root admin with a one-time activation invitation and remains idempotent', async () => {
    const created = await bootstrapPlatformAdmin(controlPool, mailer, { email, displayName: 'Root Bootstrap Admin' });
    expect(created).toMatchObject({ status: 'CREATED', email, activationEmailQueued: true });
    expect(mailer.sendActivation).toHaveBeenCalledTimes(1);
    const token = mailer.sendActivation.mock.calls[0]![0].token;
    expect(token).toHaveLength(43);

    const persisted = await controlPool.query<{ is_active: boolean; is_platform_admin: boolean; has_password: boolean; invitation_count: string }>(`
      SELECT u.is_active, EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id) AS is_platform_admin,
             EXISTS (SELECT 1 FROM password_credentials pc WHERE pc.user_id = u.id) AS has_password,
             (SELECT count(*)::text FROM platform_admin_invitations WHERE email = u.email AND status = 'PENDING') AS invitation_count
      FROM users u WHERE u.email = $1
    `, [email]);
    expect(persisted.rows[0]).toEqual({ is_active: false, is_platform_admin: true, has_password: false, invitation_count: '1' });

    const repeated = await bootstrapPlatformAdmin(controlPool, mailer, { email, displayName: 'Root Bootstrap Admin' });
    expect(repeated).toMatchObject({ status: 'PENDING', email, activationEmailQueued: false });
    expect(mailer.sendActivation).toHaveBeenCalledTimes(1);

    const repository = new PostgresSchoolAdministrationRepository({ publicPool, controlPool });
    const activated = await repository.acceptInvitation(token, 'AStrongPassword123');
    expect(activated).toMatchObject({ role: 'PLATFORM_ADMIN', email });
    await expect(repository.acceptInvitation(token, 'AnotherStrongPassword123')).rejects.toMatchObject<AppError>({ code: 'INVITATION_ALREADY_USED' });

    const active = await controlPool.query<{ is_active: boolean; has_password: boolean }>(`
      SELECT u.is_active, EXISTS (SELECT 1 FROM password_credentials pc WHERE pc.user_id = u.id) AS has_password FROM users u WHERE u.email = $1
    `, [email]);
    expect(active.rows[0]).toEqual({ is_active: true, has_password: true });
  });

  it('lets an active platform admin invite another admin without persisting a plaintext token in the response', async () => {
    const actor = await controlPool.query<{ id: string; email: string; display_name: string }>(`
      SELECT u.id, u.email::text, u.display_name FROM users u JOIN platform_admins pa ON pa.user_id = u.id WHERE u.is_active ORDER BY u.created_at LIMIT 1
    `);
    const admin = actor.rows[0]!;
    mailer.sendActivation.mockClear();
    const platformRepository = new PostgresPlatformRepository({ apiPool, controlPool, mailer });
    const invited = await platformRepository.invitePlatformAdmin(
      { userId: admin.id, email: admin.email, displayName: admin.display_name, role: 'PLATFORM_ADMIN' },
      { email: 'second.platform.admin@smartpath.test', displayName: 'Second Platform Admin' },
      'platform-admin-invite-20260725-001',
    ) as Record<string, unknown>;
    expect(invited).toMatchObject({ email: 'second.platform.admin@smartpath.test', status: 'PENDING_ACTIVATION', activationEmailQueued: true });
    expect(JSON.stringify(invited)).not.toContain('token');
    expect(mailer.sendActivation).toHaveBeenCalledTimes(1);
    const token = mailer.sendActivation.mock.calls[0]![0].token;

    const repeated = await platformRepository.invitePlatformAdmin(
      { userId: admin.id, email: admin.email, displayName: admin.display_name, role: 'PLATFORM_ADMIN' },
      { email: 'second.platform.admin@smartpath.test', displayName: 'Second Platform Admin' },
      'platform-admin-invite-20260725-001',
    );
    expect(repeated).toEqual(invited);
    expect(mailer.sendActivation).toHaveBeenCalledTimes(1);

    const repository = new PostgresSchoolAdministrationRepository({ publicPool, controlPool });
    await expect(repository.acceptInvitation(token, 'AnotherStrongPassword123')).resolves.toMatchObject({ role: 'PLATFORM_ADMIN', email: 'second.platform.admin@smartpath.test' });
  });
});
