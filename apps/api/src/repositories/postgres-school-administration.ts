import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { hashToken } from '../security/tokens.js';
import { conflict, forbidden, notFound } from '../errors.js';
import type { AuthContext, School, SchoolRequest } from '../types.js';
import type { AcceptedInvitation, CreateRegistrationRequestInput, CreateStudentInput, InviteTeacherInput, ReviewRegistrationRequestInput, SchoolAdministrationRepository, UpdateProfileInput } from './school-administration.js';
import type { AccountMailer } from '../services/mailer.js';

interface RepositoryOptions { publicPool: pg.Pool; controlPool: pg.Pool; mailer?: AccountMailer; }

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
interface RegistrationRequestRow {
  id: string; school_id: string; school_code: string; email: string; display_name: string;
  requested_role: 'TEACHER' | 'STUDENT'; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  review_reason: string | null; reviewed_by: string | null; reviewed_at: Date | null; created_at: Date;
}
function toRegistrationRequest(row: RegistrationRequestRow) {
  return {
    id: row.id, schoolId: row.school_id, schoolCode: row.school_code, email: row.email, displayName: row.display_name,
    requestedRole: row.requested_role, status: row.status, createdAt: row.created_at.toISOString(),
    ...(row.review_reason ? { reviewReason: row.review_reason } : {}),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at.toISOString() } : {}),
  };
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

  async createSchoolRequest(input: Omit<SchoolRequest, 'id' | 'status' | 'createdAt'>): Promise<SchoolRequest & { duplicate?: boolean }> {
    const client = await this.options.controlPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended(lower($1), 0))', [input.principalEmail.trim()]);
      const existing = await client.query<SchoolRequestRow>(`
        SELECT id, school_name, principal_name, principal_email::text, province, status, created_at, reviewed_at, reviewed_by, review_reason
        FROM school_requests WHERE lower(principal_email::text) = lower($1) AND status = 'PENDING' ORDER BY created_at ASC LIMIT 1 FOR UPDATE
      `, [input.principalEmail.trim()]);
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return { ...toSchoolRequest(existing.rows[0]), duplicate: true };
      }
      const request: SchoolRequest = { ...input, id: randomUUID(), status: 'PENDING', createdAt: new Date().toISOString() };
      await client.query(`
        INSERT INTO school_requests (id, school_name, principal_name, principal_email, province, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [request.id, request.schoolName, request.principalName, request.principalEmail.trim().toLowerCase(), request.province, request.status, request.createdAt]);
      await client.query(`
        INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata)
        VALUES (NULL, NULL, 'SCHOOL_REQUEST_CREATED', 'school_request', $1, $2::jsonb)
      `, [request.id, JSON.stringify({ province: request.province })]);
      await client.query('COMMIT');
      return request;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async listSchoolRequests(): Promise<SchoolRequest[]> {
    const result = await this.options.controlPool.query<SchoolRequestRow>(`
      SELECT id, school_name, principal_name, principal_email::text, province, status, created_at, reviewed_at, reviewed_by, review_reason
      FROM school_requests ORDER BY created_at DESC
    `);
    return result.rows.map(toSchoolRequest);
  }

  async createRegistrationRequest(input: CreateRegistrationRequestInput): Promise<unknown> {
    const result = await this.options.controlPool.query<RegistrationRequestRow>(`
      INSERT INTO registration_requests (school_id, email, display_name, requested_role)
      SELECT s.id, $2, $3, $4 FROM schools s WHERE s.code = $1
      ON CONFLICT (school_id, email, requested_role) DO UPDATE SET updated_at = registration_requests.updated_at
      RETURNING id, school_id, (SELECT code FROM schools WHERE id = registration_requests.school_id) AS school_code,
        email::text, display_name, requested_role, status, review_reason, reviewed_by, reviewed_at, created_at
    `, [input.schoolCode, input.email.trim().toLowerCase(), input.displayName, input.requestedRole]);
    const row = result.rows[0];
    if (!row) throw notFound('Không tìm thấy trường tương ứng với mã trường đã nhập.');
    await this.options.controlPool.query(`
      INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata)
      VALUES ($1, NULL, 'REGISTRATION_REQUEST_CREATED', 'registration_request', $2, $3::jsonb)
    `, [row.school_id, row.id, JSON.stringify({ requestedRole: row.requested_role })]);
    return toRegistrationRequest(row);
  }

  async listRegistrationRequests(actor: AuthContext, page: number, pageSize: number): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    if (actor.role !== 'SCHOOL_OWNER') throw forbidden('Chỉ hiệu trưởng được xem danh sách đăng ký.');
    const offset = (page - 1) * pageSize;
    const [rows, count] = await Promise.all([
      this.options.controlPool.query<RegistrationRequestRow>(`
        SELECT rr.id, rr.school_id, s.code AS school_code, rr.email::text, rr.display_name, rr.requested_role, rr.status,
               rr.review_reason, rr.reviewed_by, rr.reviewed_at, rr.created_at
        FROM registration_requests rr JOIN schools s ON s.id = rr.school_id
        WHERE rr.school_id = $1 ORDER BY rr.created_at DESC LIMIT $2 OFFSET $3
      `, [schoolId, pageSize, offset]),
      this.options.controlPool.query<{ total: string }>('SELECT count(*)::text AS total FROM registration_requests WHERE school_id = $1', [schoolId]),
    ]);
    const totalItems = Number(count.rows[0]?.total ?? 0);
    return { items: rows.rows.map(toRegistrationRequest), page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
  }

  async reviewRegistrationRequest(actor: AuthContext, requestId: string, input: ReviewRegistrationRequestInput, idempotencyKey: string): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    if (actor.role !== 'SCHOOL_OWNER') throw forbidden('Chỉ hiệu trưởng được duyệt đăng ký.');
    const client = await this.options.controlPool.connect();
    let activation: { to: string; displayName: string; token: string } | null = null;
    try {
      await client.query('BEGIN');
      const response = await this.idempotent(client, schoolId, actor.userId, 'REGISTRATION_REVIEW', idempotencyKey, { requestId, ...input }, async () => {
        const found = await client.query<RegistrationRequestRow>(`
          SELECT rr.id, rr.school_id, s.code AS school_code, rr.email::text, rr.display_name, rr.requested_role, rr.status,
                 rr.review_reason, rr.reviewed_by, rr.reviewed_at, rr.created_at
          FROM registration_requests rr JOIN schools s ON s.id = rr.school_id
          WHERE rr.id = $1 AND rr.school_id = $2 FOR UPDATE
        `, [requestId, schoolId]);
        const registration = found.rows[0];
        if (!registration) throw notFound('Không tìm thấy yêu cầu đăng ký.');
        if (registration.status !== 'PENDING') {
          if (registration.status === input.decision) return { ...toRegistrationRequest(registration), activationEmailQueued: registration.status === 'APPROVED' };
          throw conflict('REGISTRATION_ALREADY_REVIEWED', 'Yêu cầu đăng ký đã được xử lý với quyết định khác.');
        }
        if (input.decision === 'REJECTED') {
          const rejected = await client.query<RegistrationRequestRow>(`
            UPDATE registration_requests SET status = 'REJECTED', review_reason = $3, reviewed_by = $2, reviewed_at = now(), updated_at = now()
            WHERE id = $1
            RETURNING id, school_id, (SELECT code FROM schools WHERE id = registration_requests.school_id) AS school_code,
              email::text, display_name, requested_role, status, review_reason, reviewed_by, reviewed_at, created_at
          `, [requestId, actor.userId, input.reason!]);
          return toRegistrationRequest(rejected.rows[0]!);
        }

        const user = await client.query<{ id: string }>(`
          INSERT INTO users (id, display_name, email) VALUES ($1, $2, $3) RETURNING id
        `, [randomUUID(), registration.display_name, registration.email]);
        const userId = user.rows[0]!.id;
        await client.query('INSERT INTO school_memberships (school_id, user_id, role) VALUES ($1, $2, $3)', [schoolId, userId, registration.requested_role]);
        if (registration.requested_role === 'STUDENT') {
          await client.query('INSERT INTO student_profiles (user_id, school_id, student_code) VALUES ($1, $2, $3)', [userId, schoolId, studentCode()]);
        }
        const activationToken = randomBytes(32).toString('base64url');
        await client.query(`
          INSERT INTO invitations (school_id, user_id, role, token_hash, expires_at, created_by)
          VALUES ($1, $2, $3, $4, now() + interval '30 minutes', $5)
        `, [schoolId, userId, registration.requested_role, hashToken(activationToken), actor.userId]);
        const approved = await client.query<RegistrationRequestRow>(`
          UPDATE registration_requests SET status = 'APPROVED', review_reason = $3, reviewed_by = $2, reviewed_at = now(), updated_at = now()
          WHERE id = $1
          RETURNING id, school_id, (SELECT code FROM schools WHERE id = registration_requests.school_id) AS school_code,
            email::text, display_name, requested_role, status, review_reason, reviewed_by, reviewed_at, created_at
        `, [requestId, actor.userId, input.reason ?? null]);
        await client.query(`
          INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata)
          VALUES ($1, $2, 'REGISTRATION_APPROVED', 'registration_request', $3, $4::jsonb)
        `, [schoolId, actor.userId, requestId, JSON.stringify({ userId, requestedRole: registration.requested_role, activationTokenPrepared: true })]);
        activation = { to: registration.email, displayName: registration.display_name, token: activationToken };
        return { ...toRegistrationRequest(approved.rows[0]!), activationEmailQueued: false };
      });
      await client.query('COMMIT');
      let activationEmailQueued = false;
      if (activation && this.options.mailer) {
        try { await this.options.mailer.sendActivation(activation); activationEmailQueued = true; } catch { activationEmailQueued = false; }
      }
      const result = activation ? { ...response, activationEmailQueued } : response;
      if (activation) await this.options.controlPool.query(`UPDATE idempotency_records SET response = $4::jsonb WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3`, [actor.userId, 'REGISTRATION_REVIEW', idempotencyKey, JSON.stringify(result)]).catch(() => undefined);
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw conflict('EMAIL_ALREADY_EXISTS', 'Email này đã được dùng cho một tài khoản khác.');
      throw error;
    } finally { client.release(); }
  }

  async approveSchoolRequest(requestId: string, reviewedBy: string, reason: string, idempotencyKey = `school-approve-${requestId}`): Promise<{ request: SchoolRequest; school: School; activationEmailQueued?: boolean } | null> {
    const client = await this.options.controlPool.connect();
    let activation: { to: string; displayName: string; token: string } | null = null;
    try {
      await client.query('BEGIN');
      const response = await this.idempotent(client, null, reviewedBy, 'SCHOOL_REQUEST_APPROVE', idempotencyKey, { requestId, reason }, async () => {
      const requestResult = await client.query<SchoolRequestRow>(`
        SELECT id, school_name, principal_name, principal_email::text, province, status, created_at, reviewed_at, reviewed_by, review_reason
        FROM school_requests WHERE id = $1 AND status = 'PENDING' FOR UPDATE
      `, [requestId]);
      const request = requestResult.rows[0];
      if (!request) throw conflict('SCHOOL_REQUEST_NOT_PENDING', 'Yêu cầu không tồn tại hoặc đã được xử lý.');

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
      activation = { to: request.principal_email, displayName: request.principal_name, token: invitationToken };
      return { request: toSchoolRequest(reviewed.rows[0]!), school, activationEmailQueued: false };
      });
      await client.query('COMMIT');
      let activationEmailQueued = false;
      if (activation && this.options.mailer) {
        try {
          await this.options.mailer.sendActivation(activation);
          activationEmailQueued = true;
        } catch {
          activationEmailQueued = false;
        }
      }
      const result = { ...response, activationEmailQueued };
      if (activation) await this.options.controlPool.query(
        `UPDATE idempotency_records SET response = $4::jsonb WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3`,
        [reviewedBy, 'SCHOOL_REQUEST_APPROVE', idempotencyKey, JSON.stringify(result)],
      ).catch(() => undefined);
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === 'SCHOOL_REQUEST_NOT_PENDING') return null;
      throw error;
    } finally { client.release(); }
  }

  async rejectSchoolRequest(requestId: string, reviewedBy: string, reason: string, idempotencyKey: string): Promise<SchoolRequest | null> {
    const client = await this.options.controlPool.connect();
    try {
      await client.query('BEGIN');
      const response = await this.idempotent(client, null, reviewedBy, 'SCHOOL_REQUEST_REJECT', idempotencyKey, { requestId, reason }, async () => {
        const existing = await client.query<SchoolRequestRow>(`
          SELECT id, school_name, principal_name, principal_email::text, province, status, created_at, reviewed_at, reviewed_by, review_reason
          FROM school_requests WHERE id = $1 FOR UPDATE
        `, [requestId]);
        const request = existing.rows[0];
        if (!request || request.status === 'APPROVED') throw conflict('SCHOOL_REQUEST_NOT_PENDING', 'Yêu cầu không tồn tại hoặc đã được xử lý.');
        if (request.status === 'REJECTED') return toSchoolRequest(request);
        const rejected = await client.query<SchoolRequestRow>(`
          UPDATE school_requests SET status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), review_reason = $3
          WHERE id = $1
          RETURNING id, school_name, principal_name, principal_email::text, province, status, created_at, reviewed_at, reviewed_by, review_reason
        `, [requestId, reviewedBy, reason]);
        await client.query(`
          INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata)
          VALUES (NULL, $1, 'SCHOOL_REQUEST_REJECTED', 'school_request', $2, $3::jsonb)
        `, [reviewedBy, requestId, JSON.stringify({ reason })]);
        return toSchoolRequest(rejected.rows[0]!);
      });
      await client.query('COMMIT');
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async resendSchoolActivation(requestId: string, reviewedBy: string, idempotencyKey: string): Promise<{ requestId: string; activationEmailQueued: boolean }> {
    const client = await this.options.controlPool.connect();
    let activation: { to: string; displayName: string; token: string } | null = null;
    try {
      await client.query('BEGIN');
      const response = await this.idempotent(client, null, reviewedBy, 'SCHOOL_REQUEST_RESEND_ACTIVATION', idempotencyKey, { requestId }, async () => {
        const row = await client.query<{ school_id: string; owner_id: string; principal_email: string; principal_name: string }>(`
          SELECT s.id AS school_id, s.owner_id, sr.principal_email::text, sr.principal_name
          FROM school_requests sr JOIN users u ON u.email = sr.principal_email JOIN schools s ON s.owner_id = u.id
          WHERE sr.id = $1 AND sr.status = 'APPROVED' FOR UPDATE OF sr
        `, [requestId]);
        const request = row.rows[0];
        if (!request) throw notFound('Không tìm thấy yêu cầu trường đã được duyệt.');
        await client.query("UPDATE invitations SET status = 'EXPIRED' WHERE school_id = $1 AND user_id = $2 AND role = 'SCHOOL_OWNER' AND status = 'PENDING'", [request.school_id, request.owner_id]);
        const token = randomBytes(32).toString('base64url');
        await client.query(`INSERT INTO invitations (school_id, user_id, role, token_hash, expires_at, created_by) VALUES ($1, $2, 'SCHOOL_OWNER', $3, now() + interval '7 days', $4)`, [request.school_id, request.owner_id, hashToken(token), reviewedBy]);
        activation = { to: request.principal_email, displayName: request.principal_name, token };
        return { requestId, activationEmailQueued: false };
      });
      await client.query('COMMIT');
      let activationEmailQueued = false;
      if (activation && this.options.mailer) {
        try { await this.options.mailer.sendActivation(activation); activationEmailQueued = true; } catch { activationEmailQueued = false; }
      }
      const result = { ...response, activationEmailQueued };
      if (activation) await this.options.controlPool.query(`UPDATE idempotency_records SET response = $4::jsonb WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3`, [reviewedBy, 'SCHOOL_REQUEST_RESEND_ACTIVATION', idempotencyKey, JSON.stringify(result)]).catch(() => undefined);
      return result;
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
        VALUES ($1, $2, 'TEACHER', $3, now() + interval '30 minutes', $4)
      `, [schoolId, teacherId, hashToken(invitationToken), actor.userId]);
      let activationEmailQueued = false;
      if (this.options.mailer) {
        try { await this.options.mailer.sendActivation({ to: input.email, displayName: input.displayName, token: invitationToken }); activationEmailQueued = true; } catch { activationEmailQueued = false; }
      }
      const response = { id: teacherId, displayName: input.displayName, email: input.email, activationEmailQueued };
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
      const invitationResult = await client.query<{ id: string; school_id: string; user_id: string; role: 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT'; email: string; status: string; expires_at: Date }>(`
        SELECT i.id, i.school_id, i.user_id, i.role, i.status, i.expires_at, u.email::text AS email
        FROM invitations i
        JOIN users u ON u.id = i.user_id
        WHERE i.token_hash = $1
        FOR UPDATE
      `, [hashToken(token)]);
      const passwordHash = await hashPassword(newPassword);
      const invitation = invitationResult.rows[0];
      if (invitation) {
        if (invitation.status !== 'PENDING') { await client.query('ROLLBACK'); throw new (await import('../errors.js')).AppError(409, 'INVITATION_ALREADY_USED', 'Liên kết kích hoạt đã được sử dụng.'); }
        if (invitation.expires_at.getTime() <= Date.now()) { await client.query('ROLLBACK'); throw new (await import('../errors.js')).AppError(410, 'INVITATION_EXPIRED', 'Liên kết kích hoạt đã hết hạn.'); }
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
      }

      const platformInvitation = await client.query<{ id: string; user_id: string; email: string; status: string; expires_at: Date }>(`
        SELECT pai.id, u.id AS user_id, pai.email::text AS email, pai.status, pai.expires_at
        FROM platform_admin_invitations pai
        JOIN users u ON u.email = pai.email
        JOIN platform_admins pa ON pa.user_id = u.id
        WHERE pai.token_hash = $1
        FOR UPDATE OF pai, u
      `, [hashToken(token)]);
      const platform = platformInvitation.rows[0];
      if (!platform) { await client.query('ROLLBACK'); throw new (await import('../errors.js')).AppError(409, 'INVITATION_NOT_PENDING', 'Lời mời không tồn tại, đã hết hạn hoặc đã được sử dụng.'); }
      if (platform.status !== 'PENDING') { await client.query('ROLLBACK'); throw new (await import('../errors.js')).AppError(409, 'INVITATION_ALREADY_USED', 'Liên kết kích hoạt đã được sử dụng.'); }
      if (platform.expires_at.getTime() <= Date.now()) { await client.query('ROLLBACK'); throw new (await import('../errors.js')).AppError(410, 'INVITATION_EXPIRED', 'Liên kết kích hoạt đã hết hạn.'); }
      await client.query(`
        INSERT INTO password_credentials (user_id, password_hash, must_change_password)
        VALUES ($1, $2, false)
        ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = false, password_changed_at = now()
      `, [platform.user_id, passwordHash]);
      await client.query('UPDATE users SET is_active = true, updated_at = now() WHERE id = $1', [platform.user_id]);
      await client.query(`UPDATE platform_admin_invitations SET status = 'ACCEPTED', accepted_at = now() WHERE id = $1`, [platform.id]);
      await client.query(`
        INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata) VALUES ($1, 'PLATFORM_ADMIN_INVITATION_ACCEPTED', 'platform_admin_invitation', $2, '{}'::jsonb)
      `, [platform.user_id, platform.id]);
      await client.query('COMMIT');
      return { userId: platform.user_id, role: 'PLATFORM_ADMIN', email: platform.email };
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
        INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, 'PROFILE_UPDATED', 'user', $3::text, '{}'::jsonb)
      `, [actor.schoolId ?? null, actor.userId, actor.userId]);
      await client.query(`UPDATE idempotency_records SET response = $3::jsonb, completed_at = now() WHERE actor_id = $1 AND operation = 'PROFILE_UPDATE' AND idempotency_key = $2`, [actor.userId, idempotencyKey, JSON.stringify(response)]);
      await client.query('COMMIT');
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw conflict('EMAIL_ALREADY_EXISTS', 'Email này đã được dùng cho một tài khoản khác.');
      throw error;
    } finally { client.release(); }
  }

  private async idempotent<T>(client: pg.PoolClient, schoolId: string | null, actorId: string, operation: string, idempotencyKey: string, request: unknown, work: () => Promise<T>): Promise<T> {
    const hash = requestHash(request);
    const existing = await client.query<{ request_hash: string; response: T | null }>(`
      SELECT request_hash, response FROM idempotency_records
      WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3 FOR UPDATE
    `, [actorId, operation, idempotencyKey]);
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== hash) throw conflict('IDEMPOTENCY_KEY_REUSED', 'X-Idempotency-Key đã được dùng cho một nội dung khác.');
      if (existing.rows[0].response === null) throw conflict('IDEMPOTENCY_IN_PROGRESS', 'Yêu cầu trước đó đang được xử lý.');
      return existing.rows[0].response;
    }
    await client.query(`
      INSERT INTO idempotency_records (school_id, actor_id, operation, idempotency_key, request_hash)
      VALUES ($1, $2, $3, $4, $5)
    `, [schoolId, actorId, operation, idempotencyKey, hash]);
    const response = await work();
    await client.query(`
      UPDATE idempotency_records SET response = $4::jsonb, completed_at = now()
      WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3
    `, [actorId, operation, idempotencyKey, JSON.stringify(response)]);
    return response;
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
