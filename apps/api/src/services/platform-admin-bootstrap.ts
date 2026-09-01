import type pg from 'pg';
import { AppError } from '../errors.js';
import { createSessionToken, hashToken } from '../security/tokens.js';
import type { AccountMailer } from './mailer.js';

export interface PlatformAdminBootstrapInput {
  email: string;
  displayName: string;
}

export interface PlatformAdminBootstrapResult {
  status: 'CREATED' | 'PENDING' | 'ALREADY_ACTIVE';
  email: string;
  activationEmailQueued: boolean;
}

/**
 * Provision exactly one root administrator from deployment configuration.
 * The password is never generated or logged: activation is the only way to set it.
 */
export async function bootstrapPlatformAdmin(pool: pg.Pool, mailer: AccountMailer, input: PlatformAdminBootstrapInput): Promise<PlatformAdminBootstrapResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length === 0 || displayName.length > 120) {
    throw new AppError(422, 'PLATFORM_ADMIN_BOOTSTRAP_INVALID', 'PLATFORM_ADMIN_EMAIL hoặc PLATFORM_ADMIN_DISPLAY_NAME không hợp lệ.');
  }

  const client = await pool.connect();
  let activation: { token: string; displayName: string } | null = null;
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ id: string; is_active: boolean; is_platform_admin: boolean }>(`
      SELECT u.id, u.is_active, EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id) AS is_platform_admin
      FROM users u WHERE u.email = $1 FOR UPDATE
    `, [email]);
    const user = existing.rows[0];
    if (user && !user.is_platform_admin) throw new AppError(409, 'PLATFORM_ADMIN_EMAIL_IN_USE', 'Email bootstrap đã thuộc về một tài khoản không phải admin nền tảng.');
    if (user?.is_active) {
      await client.query('COMMIT');
      return { status: 'ALREADY_ACTIVE', email, activationEmailQueued: false };
    }

    const pending = await client.query<{ id: string }>(`
      SELECT id FROM platform_admin_invitations
      WHERE email = $1 AND status = 'PENDING' AND expires_at > now()
      FOR UPDATE
    `, [email]);
    if (pending.rows[0]) {
      await client.query('COMMIT');
      return { status: 'PENDING', email, activationEmailQueued: false };
    }

    await client.query(`UPDATE platform_admin_invitations SET status = 'EXPIRED' WHERE email = $1 AND status = 'PENDING'`, [email]);
    const userId = user?.id ?? (await client.query<{ id: string }>(`
      INSERT INTO users (email, display_name, is_active) VALUES ($1, $2, false) RETURNING id
    `, [email, displayName])).rows[0]!.id;
    await client.query('INSERT INTO platform_admins (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const token = createSessionToken();
    await client.query(`
      INSERT INTO platform_admin_invitations (email, display_name, token_hash, expires_at)
      VALUES ($1, $2, $3, now() + interval '30 minutes')
    `, [email, displayName, hashToken(token)]);
    await client.query(`
      INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata)
      VALUES (NULL, 'PLATFORM_ADMIN_BOOTSTRAPPED', 'user', $1, '{}'::jsonb)
    `, [userId]);
    activation = { token, displayName };
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (!activation) throw new Error('Platform admin bootstrap did not produce an activation token.');
  await mailer.sendActivation({ to: email, displayName: activation.displayName, token: activation.token });
  return { status: 'CREATED', email, activationEmailQueued: true };
}
