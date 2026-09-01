import type pg from 'pg';
import { verifyPassword } from '../security/passwords.js';
import { createSessionToken, hashToken } from '../security/tokens.js';
import { AppError } from '../errors.js';
import type { AccountMailer } from '../services/mailer.js';
import type { AuthContext, AuthSession, Role } from '../types.js';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  locked_until: Date | null;
  is_platform_admin: boolean;
  school_id: string | null;
  school_role: Exclude<Role, 'PLATFORM_ADMIN'> | null;
}

function toContext(row: Omit<UserRow, 'password_hash' | 'is_active' | 'locked_until'>): AuthContext {
  if (row.is_platform_admin) {
    return { userId: row.id, email: row.email, displayName: row.display_name, role: 'PLATFORM_ADMIN', homeroomClassIds: [] };
  }
  if (!row.school_id || !row.school_role) throw new Error('The user has no active Smart Path school membership.');
  return { userId: row.id, email: row.email, displayName: row.display_name, role: row.school_role, schoolId: row.school_id, homeroomClassIds: [] };
}

export class PostgresAuthRepository {
  constructor(private readonly pool: pg.Pool, private readonly mailer?: AccountMailer) {}

  async login(email: string, password: string): Promise<AuthSession | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await this.pool.query<UserRow>(`
      SELECT u.id, u.email::text, u.display_name, u.is_active, pc.password_hash, pc.locked_until,
             EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id) AS is_platform_admin,
             membership.school_id, membership.role AS school_role
      FROM users u
      JOIN password_credentials pc ON pc.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT sm.school_id, sm.role
        FROM school_memberships sm
        WHERE sm.user_id = u.id
        ORDER BY CASE sm.role WHEN 'SCHOOL_OWNER' THEN 1 WHEN 'TEACHER' THEN 2 ELSE 3 END
        LIMIT 1
      ) membership ON true
      WHERE u.email = $1
      LIMIT 1
    `, [normalizedEmail]);
    const user = result.rows[0];
    if (!user || !user.is_active || (user.locked_until && user.locked_until > new Date())) return null;

    if (!(await verifyPassword(password, user.password_hash))) {
      await this.pool.query(`
        UPDATE password_credentials
        SET failed_login_count = failed_login_count + 1,
            locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN now() + ($3 * interval '1 millisecond') ELSE locked_until END
        WHERE user_id = $1
      `, [user.id, LOGIN_LOCK_THRESHOLD, LOGIN_LOCK_MS]);
      return null;
    }

    await this.pool.query('UPDATE password_credentials SET failed_login_count = 0, locked_until = NULL WHERE user_id = $1', [user.id]);
    return this.createSession(await this.withHomeroom(toContext(user)));
  }

  async getSession(token: string): Promise<AuthContext | null> {
    const result = await this.pool.query<Omit<UserRow, 'password_hash' | 'is_active' | 'locked_until'>>(`
      SELECT u.id, u.email::text, u.display_name,
             EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id) AS is_platform_admin,
             CASE WHEN s.active_school_id IS NOT NULL THEN sm.school_id ELSE membership.school_id END AS school_id,
             CASE WHEN s.active_school_id IS NOT NULL THEN sm.role ELSE membership.role END AS school_role
      FROM sessions s
      JOIN users u ON u.id = s.user_id AND u.is_active = true
      LEFT JOIN school_memberships sm ON sm.user_id = u.id AND sm.school_id = s.active_school_id
      LEFT JOIN LATERAL (
        SELECT sm2.school_id, sm2.role
        FROM school_memberships sm2
        WHERE sm2.user_id = u.id
        ORDER BY CASE sm2.role WHEN 'SCHOOL_OWNER' THEN 1 WHEN 'TEACHER' THEN 2 ELSE 3 END
        LIMIT 1
      ) membership ON true
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
      LIMIT 1
    `, [hashToken(token)]);
    const user = result.rows[0];
    if (!user) return null;
    await this.pool.query('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [hashToken(token)]);
    return this.withHomeroom(toContext(user));
  }

  async revokeSession(token: string): Promise<void> {
    await this.pool.query('UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = $1', [hashToken(token)]);
  }

  async listSessions(userId: string, currentToken: string): Promise<Array<{ id: string; current: boolean; createdAt: string; lastSeenAt: string; expiresAt: string }>> {
    const result = await this.pool.query<{ id: string; token_hash: Buffer; created_at: Date; last_seen_at: Date; expires_at: Date }>(`
      SELECT id, token_hash, created_at, last_seen_at, expires_at FROM sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC
    `, [userId]);
    const currentHash = hashToken(currentToken);
    return result.rows.map((row) => ({
      id: row.id, current: row.token_hash.equals(currentHash), createdAt: row.created_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(), expiresAt: row.expires_at.toISOString(),
    }));
  }

  async revokeSessionById(userId: string, sessionId: string): Promise<void> {
    await this.pool.query(`
      UPDATE sessions SET revoked_at = COALESCE(revoked_at, now())
      WHERE id = $1 AND user_id = $2
    `, [sessionId, userId]);
  }

  async revokeOtherSessions(userId: string, currentToken: string): Promise<void> {
    await this.pool.query(`
      UPDATE sessions SET revoked_at = COALESCE(revoked_at, now())
      WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL
    `, [userId, hashToken(currentToken)]);
  }

  async requestPasswordReset(email: string): Promise<string | null> {
    const user = await this.pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1 AND is_active = true LIMIT 1', [email.trim().toLowerCase()]);
    const userId = user.rows[0]?.id;
    if (!userId) return null;
    const token = createSessionToken();
    await this.pool.query(`
      UPDATE password_reset_tokens SET used_at = COALESCE(used_at, now())
      WHERE user_id = $1 AND used_at IS NULL
    `, [userId]);
    await this.pool.query(`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, now() + interval '30 minutes')
    `, [userId, hashToken(token)]);
    if (this.mailer) await this.mailer.sendPasswordReset({ to: email.trim().toLowerCase(), token });
    return token;
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query<{ id: string; user_id: string }>(`
        SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE
      `, [hashToken(token)]);
      const reset = found.rows[0];
      if (!reset) throw new AppError(409, 'RESET_TOKEN_INVALID', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
      const { hashPassword } = await import('../security/passwords.js');
      await client.query(`
        INSERT INTO password_credentials (user_id, password_hash, must_change_password)
        VALUES ($1, $2, false)
        ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = false, password_changed_at = now(), failed_login_count = 0, locked_until = NULL
      `, [reset.user_id, await hashPassword(password)]);
      await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [reset.id]);
      await client.query('UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1', [reset.user_id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async withHomeroom(user: AuthContext): Promise<AuthContext> {
    if (user.role !== 'TEACHER' || !user.schoolId) return { ...user, homeroomClassIds: [] };
    const result = await this.pool.query<{ class_id: string }>(`
      SELECT class_id FROM class_teacher_assignments
      WHERE teacher_id = $1 AND role = 'HOMEROOM_TEACHER'
    `, [user.userId]);
    return { ...user, homeroomClassIds: result.rows.map((row) => row.class_id) };
  }

  private async createSession(user: AuthContext): Promise<AuthSession> {
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.pool.query(
      'INSERT INTO sessions (user_id, token_hash, active_school_id, expires_at) VALUES ($1, $2, $3, $4)',
      [user.userId, hashToken(token), user.schoolId ?? null, expiresAt],
    );
    return { token, expiresAt, user };
  }
}
