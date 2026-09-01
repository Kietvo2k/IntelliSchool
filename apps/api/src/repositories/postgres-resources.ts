import { createHash } from 'node:crypto';
import type pg from 'pg';
import { withTenantTransaction } from '../db.js';
import { conflict, forbidden, notFound } from '../errors.js';
import type { AuthContext } from '../types.js';
import type { QuarantinedResourceInput } from '../services/resource-upload-service.js';

function schoolFor(actor: AuthContext): string {
  if (!actor.schoolId) throw forbidden('Tài khoản này chưa thuộc một trường hợp lệ.');
  return actor.schoolId;
}

export class PostgresResourceRepository {
  constructor(private readonly apiPool: pg.Pool) {}

  async createQuarantined(actor: AuthContext, input: QuarantinedResourceInput): Promise<unknown> {
    const schoolId = schoolFor(actor);
    if (actor.role !== 'SCHOOL_OWNER' && actor.role !== 'TEACHER' && actor.role !== 'STUDENT') throw forbidden('Bạn không có quyền tải tài nguyên lên.');
    return withTenantTransaction(this.apiPool, { schoolId, userId: actor.userId }, async (client) => {
      const work = async () => {
      let classId = input.classId ?? null;
      let subjectId = input.subjectId ?? null;
      if (actor.role === 'STUDENT') {
        const isPrivateLearnerUpload = input.visibility === 'PRIVATE' && input.ownerUserId === actor.userId && !input.examSessionId;
        if (!isPrivateLearnerUpload && !input.examSessionId) throw forbidden('Học sinh chỉ tải tệp riêng để học hoặc đính kèm trong ca thi thử.');
        if (isPrivateLearnerUpload) {
          classId = null;
          subjectId = null;
        } else {
          const session = await client.query<{ class_id: string; subject_id: string; submitted_at: Date | null; ends_at: Date }>(`
          SELECT a.class_id, a.subject_id, es.submitted_at, es.ends_at
          FROM exam_sessions es JOIN assignments a ON a.id = es.assignment_id
          WHERE es.id = $1 AND es.student_id = $2
          `, [input.examSessionId, actor.userId]);
          const exam = session.rows[0];
          if (!exam) throw forbidden('Không tìm thấy ca thi thử.');
          if (exam.submitted_at) throw forbidden('Ca thi đã nộp, không thể đính kèm thêm.');
          if (exam.ends_at.getTime() < Date.now()) throw forbidden('Đã hết giờ làm bài.');
          classId = exam.class_id;
          subjectId = exam.subject_id;
        }
      } else if (actor.role === 'TEACHER') {
        if (!input.classId || !input.subjectId) throw forbidden('Giáo viên cần chọn lớp và môn học được phân công.');
        const assigned = await client.query<{ allowed: boolean }>(`
          SELECT EXISTS (
            SELECT 1 FROM class_teacher_assignments
            WHERE class_id = $1 AND teacher_id = $2 AND (role = 'HOMEROOM_TEACHER' OR subject_id = $3)
          ) AS allowed
        `, [input.classId, actor.userId, input.subjectId]);
        if (!assigned.rows[0]?.allowed) throw forbidden('Bạn không được phân công quản lý lớp hoặc môn học này.');
      }
      const created = await client.query<{ id: string; original_name: string; mime_type: string; byte_size: string; sha256: string; status: 'QUARANTINED'; created_at: Date; visibility: string }>(`
        INSERT INTO resources (school_id, class_id, subject_id, lesson_id, object_key, original_name, mime_type, byte_size, sha256, status, uploaded_by, owner_user_id, visibility, contribution_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'QUARANTINED', $10, $11, $12, $13)
        RETURNING id, original_name, mime_type, byte_size, sha256, status, visibility, created_at
      `, [schoolId, classId, subjectId, input.lessonId ?? null, input.objectKey, input.originalName, input.mimeType, input.byteSize, input.sha256, actor.userId, input.ownerUserId ?? null, input.visibility ?? 'CLASS', input.visibility === 'PRIVATE' ? 'NONE' : 'NONE']);
      const resource = created.rows[0]!;
      await client.query('INSERT INTO resource_scan_jobs (school_id, resource_id) VALUES ($1, $2)', [schoolId, resource.id]);
      await client.query(`INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, 'RESOURCE_UPLOADED', 'resource', $3, $4::jsonb)`, [schoolId, actor.userId, resource.id, JSON.stringify({ mimeType: resource.mime_type, byteSize: Number(resource.byte_size), sha256: resource.sha256 })]);
      return { id: resource.id, originalName: resource.original_name, mimeType: resource.mime_type, byteSize: Number(resource.byte_size), sha256: resource.sha256, status: resource.status, visibility: input.visibility ?? 'CLASS', createdAt: resource.created_at.toISOString() };
      };
      return input.idempotencyKey
        ? this.idempotent(client, schoolId, actor.userId, 'RESOURCE_UPLOAD', input.idempotencyKey, input, work)
        : work();
    });
  }

  async getReadyObject(actor: AuthContext, resourceId: string): Promise<{ objectKey: string; originalName: string; mimeType: string }> {
    const schoolId = schoolFor(actor);
    return withTenantTransaction(this.apiPool, { schoolId, userId: actor.userId }, async (client) => {
      const found = await client.query<{ id: string; class_id: string | null; subject_id: string | null; lesson_id: string | null; object_key: string; original_name: string; mime_type: string; uploaded_by: string; owner_user_id: string | null; visibility: string; contribution_status: string }>(`
        SELECT id, class_id, subject_id, lesson_id, object_key, original_name, mime_type, uploaded_by, owner_user_id, visibility, contribution_status FROM resources WHERE id = $1 AND status = 'READY'
      `, [resourceId]);
      const resource = found.rows[0];
      if (!resource) throw notFound('Tài nguyên chưa sẵn sàng để tải xuống.');
      const result = { objectKey: resource.object_key, originalName: resource.original_name, mimeType: resource.mime_type };
      if (actor.role === 'SCHOOL_OWNER') return result;
      if (actor.role === 'STUDENT' && (resource.uploaded_by === actor.userId || resource.owner_user_id === actor.userId)) return result;
      if (actor.role === 'TEACHER') {
        if (!resource.class_id || !resource.subject_id) throw forbidden('Bạn không được phân công quản lý tài nguyên này.');
        const assigned = await client.query<{ allowed: boolean }>(`SELECT EXISTS (SELECT 1 FROM class_teacher_assignments WHERE class_id = $1 AND teacher_id = $2 AND (role = 'HOMEROOM_TEACHER' OR subject_id = $3)) AS allowed`, [resource.class_id, actor.userId, resource.subject_id]);
        if (!assigned.rows[0]?.allowed) throw forbidden('Bạn không được phân công quản lý tài nguyên này.');
        return result;
      }
      if (actor.role === 'STUDENT') {
        if (resource.visibility === 'PRIVATE') throw forbidden('Tài liệu riêng chỉ mở được bởi người tải lên.');
        if (resource.visibility === 'SCHOOL' && resource.contribution_status === 'APPROVED') return result;
        const available = await client.query<{ allowed: boolean }>(`
          SELECT EXISTS (
            SELECT 1
            FROM lessons l
            JOIN class_enrollments ce ON ce.class_id = l.class_id AND ce.student_id = $2 AND ce.status = 'ACTIVE'
            WHERE l.published_at IS NOT NULL AND l.archived_at IS NULL
              AND (l.available_from IS NULL OR l.available_from <= now()) AND (l.available_until IS NULL OR l.available_until >= now())
              AND (
                l.id = $1
                OR EXISTS (
                  SELECT 1 FROM jsonb_array_elements(COALESCE(l.content->'blocks', '[]'::jsonb)) AS block
                  WHERE block->>'type' = 'resource' AND block->>'resourceId' = $3
                )
              )
          ) AS allowed
        `, [resource.lesson_id, actor.userId, resource.id]);
        if (!available.rows[0]?.allowed) throw forbidden('Tài nguyên này chưa được công bố cho bạn.');
        return result;
      }
      throw forbidden('Bạn không có quyền tải tài nguyên này.');
    });
  }

  async requestContribution(actor: AuthContext, resourceId: string, idempotencyKey: string): Promise<unknown> {
    const schoolId = schoolFor(actor);
    return withTenantTransaction(this.apiPool, { schoolId, userId: actor.userId }, async (client) => this.idempotent(client, schoolId, actor.userId, 'RESOURCE_CONTRIBUTION_REQUEST', idempotencyKey, { resourceId }, async () => {
      const found = await client.query<{ id: string; status: string; owner_user_id: string | null; visibility: string; contribution_status: string }>(
        'SELECT id, status, owner_user_id, visibility, contribution_status FROM resources WHERE id = $1 AND school_id = $2 FOR UPDATE',
        [resourceId, schoolId],
      );
      const resource = found.rows[0];
      if (!resource) throw notFound('Không tìm thấy tài liệu.');
      if (resource.owner_user_id !== actor.userId || resource.visibility !== 'PRIVATE') throw forbidden('Chỉ người tải tài liệu riêng mới được gửi yêu cầu đóng góp.');
      if (resource.status !== 'READY') throw forbidden('Tài liệu phải được quét sạch trước khi gửi duyệt.');
      await client.query("UPDATE resources SET contribution_status = 'PENDING' WHERE id = $1", [resourceId]);
      await client.query('INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)', [schoolId, actor.userId, 'RESOURCE_CONTRIBUTION_REQUESTED', 'resource', resourceId, JSON.stringify({ idempotencyKey })]);
      return { id: resourceId, contributionStatus: 'PENDING' };
    }));
  }

  async reviewContribution(actor: AuthContext, resourceId: string, input: { decision: 'APPROVED' | 'REJECTED'; scope: 'CLASS' | 'SCHOOL'; reason?: string }, idempotencyKey: string): Promise<unknown> {
    const schoolId = schoolFor(actor);
    if (actor.role !== 'SCHOOL_OWNER' && actor.role !== 'TEACHER') throw forbidden('Chỉ nhà trường được duyệt tài liệu đóng góp.');
    return withTenantTransaction(this.apiPool, { schoolId, userId: actor.userId }, async (client) => this.idempotent(client, schoolId, actor.userId, 'RESOURCE_CONTRIBUTION_REVIEW', idempotencyKey, { resourceId, ...input }, async () => {
      const found = await client.query<{ id: string; contribution_status: string }>('SELECT id, contribution_status FROM resources WHERE id = $1 AND school_id = $2 FOR UPDATE', [resourceId, schoolId]);
      if (!found.rows[0]) throw notFound('Không tìm thấy tài liệu.');
      const status = input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
      await client.query('UPDATE resources SET contribution_status = $2, visibility = CASE WHEN $2 = \'APPROVED\' THEN $3 ELSE visibility END, reviewed_by = $4, reviewed_at = now() WHERE id = $1', [resourceId, status, input.scope, actor.userId]);
      await client.query('INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)', [schoolId, actor.userId, 'RESOURCE_CONTRIBUTION_REVIEWED', 'resource', resourceId, JSON.stringify({ decision: input.decision, scope: input.scope, reason: input.reason, idempotencyKey })]);
      return { id: resourceId, contributionStatus: status, visibility: input.decision === 'APPROVED' ? input.scope : undefined };
    }));
  }

  async list(actor: AuthContext, input: { page: number; pageSize: number; classId?: string; subjectId?: string; status?: 'QUARANTINED' | 'PROCESSING' | 'READY' | 'REJECTED' }): Promise<unknown> {
    const schoolId = schoolFor(actor);
    return withTenantTransaction(this.apiPool, { schoolId, userId: actor.userId }, async (client) => {
      const conditions = ['r.school_id = $1'];
      const params: unknown[] = [schoolId];
      if (input.classId) { params.push(input.classId); conditions.push(`r.class_id = $${params.length}`); }
      if (input.subjectId) { params.push(input.subjectId); conditions.push(`r.subject_id = $${params.length}`); }
      if (input.status) { params.push(input.status); conditions.push(`r.status = $${params.length}::resource_status`); }
      if (actor.role === 'TEACHER') {
        params.push(actor.userId);
        conditions.push(`EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.class_id = r.class_id AND cta.teacher_id = $${params.length} AND (cta.role = 'HOMEROOM_TEACHER' OR cta.subject_id = r.subject_id))`);
      } else if (actor.role === 'STUDENT') {
        params.push(actor.userId);
        conditions.push(`r.status = 'READY' AND (r.owner_user_id = $${params.length} OR (r.visibility = 'SCHOOL' AND r.contribution_status = 'APPROVED') OR EXISTS (
          SELECT 1 FROM lessons l
          JOIN class_enrollments ce ON ce.class_id = l.class_id AND ce.student_id = $${params.length} AND ce.status = 'ACTIVE'
          WHERE l.published_at IS NOT NULL AND l.archived_at IS NULL
            AND (l.available_from IS NULL OR l.available_from <= now()) AND (l.available_until IS NULL OR l.available_until >= now())
            AND (
              l.id = r.lesson_id
              OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(COALESCE(l.content->'blocks', '[]'::jsonb)) AS block
                WHERE block->>'type' = 'resource' AND block->>'resourceId' = r.id::text
              )
            )
        ))`);
      } else if (actor.role !== 'SCHOOL_OWNER') {
        throw forbidden('Bạn không có quyền xem tài nguyên của trường.');
      }
      const where = conditions.join(' AND ');
      const counted = await client.query<{ total: string }>(`SELECT count(*)::text AS total FROM resources r WHERE ${where}`, params);
      const totalItems = Number(counted.rows[0]?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
      const offset = (input.page - 1) * input.pageSize;
      const rows = await client.query<{ id: string; original_name: string; mime_type: string; byte_size: string; sha256: string; status: 'QUARANTINED' | 'PROCESSING' | 'READY' | 'REJECTED'; class_id: string | null; subject_id: string | null; lesson_id: string | null; created_at: Date; visibility: string; contribution_status: string }>(`
        SELECT r.id, r.original_name, r.mime_type, r.byte_size, r.sha256, r.status, r.class_id, r.subject_id, r.lesson_id, r.created_at, r.visibility, r.contribution_status
        FROM resources r WHERE ${where} ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, input.pageSize, offset]);
      return {
        items: rows.rows.map((resource) => ({ id: resource.id, originalName: resource.original_name, mimeType: resource.mime_type, byteSize: Number(resource.byte_size), sha256: resource.sha256, status: resource.status, visibility: resource.visibility, contributionStatus: resource.contribution_status, classId: resource.class_id, subjectId: resource.subject_id, lessonId: resource.lesson_id, createdAt: resource.created_at.toISOString() })),
        page: input.page, pageSize: input.pageSize, totalItems, totalPages,
      };
    });
  }

  private async idempotent<T>(client: pg.PoolClient, schoolId: string, actorId: string, operation: string, idempotencyKey: string, request: unknown, work: () => Promise<T>): Promise<T> {
    const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const existing = await client.query<{ request_hash: string; response: T | null }>(`
      SELECT request_hash, response FROM idempotency_records
      WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3 FOR UPDATE
    `, [actorId, operation, idempotencyKey]);
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== requestHash) throw conflict('IDEMPOTENCY_KEY_REUSED', 'X-Idempotency-Key đã được dùng cho một nội dung khác.');
      if (existing.rows[0].response === null) throw conflict('IDEMPOTENCY_IN_PROGRESS', 'Yêu cầu trước đó đang được xử lý.');
      return existing.rows[0].response;
    }
    await client.query('INSERT INTO idempotency_records (school_id, actor_id, operation, idempotency_key, request_hash) VALUES ($1, $2, $3, $4, $5)', [schoolId, actorId, operation, idempotencyKey, requestHash]);
    const response = await work();
    await client.query('UPDATE idempotency_records SET response = $4::jsonb, completed_at = now() WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3', [actorId, operation, idempotencyKey, JSON.stringify(response)]);
    return response;
  }

  async close(): Promise<void> { await this.apiPool.end(); }
}
