import { randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { hashToken } from '../security/tokens.js';
import type { School, SchoolRequest } from '../types.js';
import type { SchoolAdministrationRepository } from './school-administration.js';

interface RepositoryOptions { publicPool: pg.Pool; controlPool: pg.Pool; }
interface SchoolRequestRow {
  id: string; school_name: string; principal_name: string; principal_email: string; province: string;
  status: SchoolRequest['status']; created_at: Date; reviewed_at: Date | null; reviewed_by: string | null; review_reason: string | null;
}
function toSchoolRequest(row: SchoolRequestRow): SchoolRequest {
  return {
    id: row.id, schoolName: row.school_name, principalName: row.principal_name, principalEmail: row.principal_email,
    province: row.province, status: row.status, createdAt: row.created_at.toISOString(),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at.toISOString() } : {}),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
    ...(row.review_reason ? { reviewReason: row.review_reason } : {}),
  };
}
function schoolCode(): string { return `SP-${randomBytes(4).toString('hex').toUpperCase()}`; }

export class PostgresSchoolAdministrationRepository implements SchoolAdministrationRepository {
  constructor(private readonly options: RepositoryOptions) {}

  async createSchoolRequest(input: Omit<SchoolRequest, 'id' | 'status' | 'createdAt'>): Promise<SchoolRequest> {
    const request: SchoolRequest = { ...input, id: randomUUID(), status: 'PENDING', createdAt: new Date().toISOString() };
    await this.options.publicPool.query(`
      INSERT INTO school_requests (id, school_name, principal_name, principal_email, province, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [request.id, request.schoolName, request.principalName, request.principalEmail, request.province, request.status, request.createdAt]);
    return request;
  }
  async listSchoolRequests(): Promise<SchoolRequest[]> {
    const result = await this.options.controlPool.query<SchoolRequestRow>(`
      SELECT id, school_name, principal_name, principal_email::text, province, status, created_at, reviewed_at, reviewed_by, review_reason
      FROM school_requests ORDER BY created_at DESC
    `);
    return result.rows.map(toSchoolRequest);
  }

  async approveSchoolRequest(requestId: string, reviewedBy: string, reason: string): Promise<{ request: SchoolRequest; school: School } | null> {
    const client = await this.options.controlPool.connect();
    try {
      await client.query('BEGIN');
      const requestResult = await client.query<SchoolRequestRow>(`
        SELECT id, school_name, principal_name, principal_email::text, province, status, created_at, reviewed_at, reviewed_by, review_reason
        FROM school_requests WHERE id = $1 AND status = 'PENDING' FOR UPDATE
      `, [requestId]);
      const request = requestResult.rows[0];
      if (!request) { await client.query('ROLLBACK'); return null; }

      const ownerResult = await client.query<{ id: string }>(`
        INSERT INTO users (id, display_name, email)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
      `, [randomUUID(), request.principal_name, request.principal_email]);
      const ownerId = ownerResult.rows[0]?.id;
      if (!ownerId) throw new Error('Could not create the school owner.');
      const school = await this.insertSchool(client, request, ownerId);

      await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, $3)', [school.id, ownerId, 'SCHOOL_OWNER']);
      await client.query('INSERT INTO school_settings (school_id, trial_ends_at) VALUES ($1, now() + interval \'30 days\')', [school.id]);
      await client.query(`
        INSERT INTO subscriptions (school_id, status, included_class_quota, base_price_vnd, extra_class_price_vnd, trial_ends_at)
        VALUES ($1, 'TRIAL', 30, 10000000, 500000, now() + interval '30 days')
      `, [school.id]);
      const invitationToken = randomBytes(32).toString('base64url');
      await client.query(`
        INSERT INTO invitations (school_id, user_id, role, token_hash, expires_at, created_by)
        VALUES ($1, $2, 'SCHOOL_OWNER', $3, now() + interval '7 days', $4)
      `, [school.id, ownerId, hashToken(invitationToken), reviewedBy]);
      const reviewed = await client.query<SchoolRequestRow>(`
        UPDATE school_requests SET status = 'APPROVED', reviewed_by = $2, reviewed_at = now(), review_reason = $3
        WHERE id = $1
        RETURNING id, school_name, principal_name, principal_email::text, province, status, created_at, reviewed_at, reviewed_by, review_reason
      `, [requestId, reviewedBy, reason]);
      await client.query(`
        INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata)
        VALUES ($1, $2, 'SCHOOL_REQUEST_APPROVED', 'school_request', $3, $4::jsonb)
      `, [school.id, reviewedBy, requestId, JSON.stringify({ schoolCode: school.code, invitationPrepared: true })]);
      await client.query('COMMIT');
      return { request: toSchoolRequest(reviewed.rows[0]!), school };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async close(): Promise<void> { await Promise.all([this.options.publicPool.end(), this.options.controlPool.end()]); }

  private async insertSchool(client: pg.PoolClient, request: SchoolRequestRow, ownerId: string): Promise<School> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const school: School = { id: randomUUID(), code: schoolCode(), name: request.school_name, province: request.province, ownerId };
      try {
        await client.query('INSERT INTO schools (id, code, name, province, owner_id) VALUES ($1, $2, $3, $4, $5)', [school.id, school.code, school.name, school.province, school.ownerId]);
        return school;
      } catch (error) { if ((error as { code?: string }).code !== '23505' || attempt === 4) throw error; }
    }
    throw new Error('Could not allocate a unique school code.');
  }
}


