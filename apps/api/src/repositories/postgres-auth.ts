import type pg from 'pg';
import { verifyPassword } from '../security/passwords.js';
import { createSessionToken, hashToken } from '../security/tokens.js';
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
    return { userId: row.id, email: row.email, displayName: row.display_name, role: 'PLATFORM_ADMIN' };
  }
  if (!row.school_id || !row.school_role) throw new Error('The user has no active Smart Path school membership.');
  return { userId: row.id, email: row.email, displayName: row.display_name, role: row.school_role, schoolId: row.school_id };
}

export class PostgresAuthRepository {
  constructor(private readonly pool: pg.Pool) {}

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
    return this.createSession(toContext(user));
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
    return toContext(user);
  }

  async revokeSession(token: string): Promise<void> {
    await this.pool.query('UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = $1', [hashToken(token)]);
  }

  async close(): Promise<void> {
    await this.pool.end();
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
