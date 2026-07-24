import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { hashToken } from '../security/tokens.js';
import { conflict, forbidden } from '../errors.js';
import type { AuthContext, School, SchoolRequest } from '../types.js';
import type { AcceptedInvitation, CreateStudentInput, InviteTeacherInput, SchoolAdministrationRepository, UpdateProfileInput } from './school-administration.js';

interface RepositoryOptions { publicPool: pg.Pool; controlPool: pg.Pool; }

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertSchoolActor(actor: AuthContext): string {
  if (!actor.schoolId) throw forbidden('Tài khoản này chưa thuộc một trường hợp lệ.');
  return actor.schoolId;
}

function studentCode(): string {
  return `SPHS-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}
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

  async createStudent(actor: AuthContext, input: CreateStudentInput, idempotencyKey: string): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    if (actor.role !== 'SCHOOL_OWNER' && actor.role !== 'TEACHER') throw forbidden('Bạn không có quyền tạo học sinh mới.');
    const client = await this.options.controlPool.connect();
    try {
      await client.query('BEGIN');
      const hash = requestHash(input);
      const existing = await client.query<{ request_hash: string; response: unknown }>(`
        SELECT request_hash, response FROM idempotency_records WHERE actor_id = $1 AND operation = 'STUDENT_CREATE' AND idempotency_key = $2 FOR UPDATE
      `, [actor.userId, idempotencyKey]);
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== hash) throw conflict('IDEMPOTENCY_KEY_REUSED', 'X-Idempotency-Key đã được dùng cho một nội dung khác.');
        await client.query('COMMIT');
        return existing.rows[0].response;
      }
      await client.query(`INSERT INTO idempotency_records (school_id, actor_id, operation, idempotency_key, request_hash) VALUES ($1, $2, 'STUDENT_CREATE', $3, $4)`, [schoolId, actor.userId, idempotencyKey, hash]);

      const user = await client.query<{ id: string }>(`
        INSERT INTO users (id, display_name, email) VALUES ($1, $2, $3) RETURNING id
      `, [randomUUID(), input.displayName, input.email]);
      const studentId = user.rows[0]!.id;
      await client.query(`INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, 'STUDENT')`, [schoolId, studentId]);
      await client.query(`
        INSERT INTO student_profiles (user_id, school_id, student_code) VALUES ($1, $2, $3)
      `, [studentId, schoolId, studentCode()]);
      const response = { id: studentId, displayName: input.displayName, email: input.email };
      await client.query(`
        INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, 'STUDENT_CREATED', 'user', $3, '{}'::jsonb)
      `, [schoolId, actor.userId, studentId]);
      await client.query(`UPDATE idempotency_records SET response = $4::jsonb, completed_at = now() WHERE actor_id = $1 AND operation = 'STUDENT_CREATE' AND idempotency_key = $2 AND school_id = $3`, [actor.userId, idempotencyKey, schoolId, JSON.stringify(response)]);
      await client.query('COMMIT');
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw conflict('EMAIL_ALREADY_EXISTS', 'Email này đã được dùng cho một tài khoản khác.');
      throw error;
    } finally { client.release(); }
  }

  async inviteTeacher(actor: AuthContext, input: InviteTeacherInput, idempotencyKey: string): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    if (actor.role !== 'SCHOOL_OWNER') throw forbidden('Chỉ hiệu trưởng được mời giáo viên mới.');
    const client = await this.options.controlPool.connect();
    try {
      await client.query('BEGIN');
      const hash = requestHash(input);
      const existing = await client.query<{ request_hash: string; response: unknown }>(`
        SELECT request_hash, response FROM idempotency_records WHERE actor_id = $1 AND operation = 'TEACHER_INVITE' AND idempotency_key = $2 FOR UPDATE
      `, [actor.userId, idempotencyKey]);
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== hash) throw conflict('IDEMPOTENCY_KEY_REUSED', 'X-Idempotency-Key đã được dùng cho một nội dung khác.');
        await client.query('COMMIT');
        return existing.rows[0].response;
      }
      await client.query(`INSERT INTO idempotency_records (school_id, actor_id, operation, idempotency_key, request_hash) VALUES ($1, $2, 'TEACHER_INVITE', $3, $4)`, [schoolId, actor.userId, idempotencyKey, hash]);

      const user = await client.query<{ id: string }>(`
        INSERT INTO users (id, display_name, email) VALUES ($1, $2, $3) RETURNING id
      `, [randomUUID(), input.displayName, input.email]);
      const teacherId = user.rows[0]!.id;
      await client.query(`INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, 'TEACHER')`, [schoolId, teacherId]);
      const invitationToken = randomBytes(32).toString('base64url');
      await client.query(`
        INSERT INTO invitations (school_id, user_id, role, token_hash, expires_at, created_by)
        VALUES ($1, $2, 'TEACHER', $3, now() + interval '7 days', $4)
      `, [schoolId, teacherId, hashToken(invitationToken), actor.userId]);
      const response = { id: teacherId, displayName: input.displayName, email: input.email, invitationToken };
      await client.query(`
        INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, 'TEACHER_INVITED', 'user', $3, '{}'::jsonb)
      `, [schoolId, actor.userId, teacherId]);
      await client.query(`UPDATE idempotency_records SET response = $4::jsonb, completed_at = now() WHERE actor_id = $1 AND operation = 'TEACHER_INVITE' AND idempotency_key = $2 AND school_id = $3`, [actor.userId, idempotencyKey, schoolId, JSON.stringify(response)]);
      await client.query('COMMIT');
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw conflict('EMAIL_ALREADY_EXISTS', 'Email này đã được dùng cho một tài khoản khác.');
      throw error;
    } finally { client.release(); }
  }

  async acceptInvitation(token: string, newPassword: string): Promise<AcceptedInvitation> {
    const client = await this.options.controlPool.connect();
    try {
      await client.query('BEGIN');
      const { hashPassword } = await import('../security/passwords.js');
      const invitationResult = await client.query<{ id: string; school_id: string; user_id: string; role: 'SCHOOL_OWNER' | 'TEACHER'; email: string }>(`
        SELECT i.id, i.school_id, i.user_id, i.role, u.email::text AS email
        FROM invitations i
        JOIN users u ON u.id = i.user_id
        WHERE i.token_hash = $1 AND i.status = 'PENDING' AND i.expires_at > now()
        FOR UPDATE
      `, [hashToken(token)]);
      const invitation = invitationResult.rows[0];
      if (!invitation) { await client.query('ROLLBACK'); throw new (await import('../errors.js')).AppError(409, 'INVITATION_NOT_PENDING', 'Lời mời không tồn tại, đã hết hạn hoặc đã được sử dụng.'); }

      const passwordHash = await hashPassword(newPassword);
      await client.query(`
        INSERT INTO password_credentials (user_id, password_hash, must_change_password)
        VALUES ($1, $2, false)
        ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = false, password_changed_at = now()
      `, [invitation.user_id, passwordHash]);
      await client.query(`UPDATE invitations SET status = 'ACCEPTED', accepted_at = now() WHERE id = $1`, [invitation.id]);
      await client.query(`
        INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, 'INVITATION_ACCEPTED', 'invitation', $3, '{}'::jsonb)
      `, [invitation.school_id, invitation.user_id, invitation.id]);
      await client.query('COMMIT');
      return { userId: invitation.user_id, schoolId: invitation.school_id, role: invitation.role, email: invitation.email };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async updateProfile(actor: AuthContext, input: UpdateProfileInput, idempotencyKey: string): Promise<unknown> {
    const client = await this.options.controlPool.connect();
    try {
      await client.query('BEGIN');
      const hash = requestHash(input);
      const existing = await client.query<{ request_hash: string; response: unknown }>(`
        SELECT request_hash, response FROM idempotency_records WHERE actor_id = $1 AND operation = 'PROFILE_UPDATE' AND idempotency_key = $2 FOR UPDATE
      `, [actor.userId, idempotencyKey]);
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== hash) throw conflict('IDEMPOTENCY_KEY_REUSED', 'X-Idempotency-Key đã được dùng cho một nội dung khác.');
        await client.query('COMMIT');
        return existing.rows[0].response;
      }
      await client.query(`INSERT INTO idempotency_records (school_id, actor_id, operation, idempotency_key, request_hash) VALUES ($1, $2, 'PROFILE_UPDATE', $3, $4)`, [actor.schoolId ?? null, actor.userId, idempotencyKey, hash]);

      const result = await client.query<{ id: string; display_name: string; email: string; avatar_object_key: string | null }>(`
        UPDATE users SET
          display_name = COALESCE($2, display_name),
          email = COALESCE($3, email),
          avatar_object_key = CASE WHEN $4 THEN $5 ELSE avatar_object_key END
        WHERE id = $1
        RETURNING id, display_name, email::text, avatar_object_key
      `, [actor.userId, input.displayName ?? null, input.email ?? null, input.avatarObjectKey !== undefined, input.avatarObjectKey ?? null]);
      const updated = result.rows[0]!;
      const response = { id: updated.id, displayName: updated.display_name, email: updated.email, avatarObjectKey: updated.avatar_object_key };
      await client.query(`
        INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, 'PROFILE_UPDATED', 'user', $2, '{}'::jsonb)
      `, [actor.schoolId ?? null, actor.userId]);
      await client.query(`UPDATE idempotency_records SET response = $3::jsonb, completed_at = now() WHERE actor_id = $1 AND operation = 'PROFILE_UPDATE' AND idempotency_key = $2`, [actor.userId, idempotencyKey, JSON.stringify(response)]);
      await client.query('COMMIT');
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw conflict('EMAIL_ALREADY_EXISTS', 'Email này đã được dùng cho một tài khoản khác.');
      throw error;
    } finally { client.release(); }
  }

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


