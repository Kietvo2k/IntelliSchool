import { createHash } from 'node:crypto';
import type pg from 'pg';
import { withTenantTransaction } from '../db.js';
import { AppError, conflict, forbidden, notFound } from '../errors.js';
import { calculateMonthlyCharge } from '../domain/admin/billing.js';
import { assertCrawlUrlIsSafe } from '../domain/admin/crawler-safety.js';
import { rankCareerMatches, scoreRiasecAnswers, type RiasecResult } from '../domain/career/scoring.js';
import { gradeAnswer, type QuestionType } from '../domain/classroom/grading.js';
import type { AuthContext } from '../types.js';
import type { AssignmentSubmissionInput, CreateLessonInput, OfflineEventInput, PlatformRepository } from './platform.js';

interface RepositoryOptions {
  apiPool: pg.Pool;
  controlPool: pg.Pool;
  crawlAllowlist?: ReadonlySet<string>;
}

interface AssignmentItemRow {
  id: string;
  points: string | number;
  type: QuestionType;
  answer_key: Record<string, unknown>;
}

function numeric(value: string | number | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertSchoolActor(actor: AuthContext): string {
  if (!actor.schoolId) throw forbidden('Tài khoản này chưa thuộc một trường hợp lệ.');
  return actor.schoolId;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export class PostgresPlatformRepository implements PlatformRepository {
  constructor(private readonly options: RepositoryOptions) {}

  async close(): Promise<void> {
    await Promise.all([this.options.apiPool.end(), this.options.controlPool.end()]);
  }

  async getDashboard(actor: AuthContext): Promise<unknown> {
    if (actor.role === 'PLATFORM_ADMIN') {
      const result = await this.options.controlPool.query<{ school_count: string; pending_count: string; audit_count: string }>(`
        SELECT
          (SELECT count(*) FROM schools)::text AS school_count,
          (SELECT count(*) FROM school_requests WHERE status = 'PENDING')::text AS pending_count,
          (SELECT count(*) FROM audit_events WHERE created_at >= now() - interval '24 hours')::text AS audit_count
      `);
      const row = result.rows[0]!;
      return {
        title: 'Điều hành nền tảng',
        role: actor.role,
        metrics: [
          { id: 'schools', label: 'Trường đang quản lý', value: numeric(row.school_count) },
          { id: 'pending', label: 'Yêu cầu chờ duyệt', value: numeric(row.pending_count) },
          { id: 'audits', label: 'Sự kiện audit 24 giờ', value: numeric(row.audit_count) },
        ],
      };
    }

    const schoolId = assertSchoolActor(actor);
    return withTenantTransaction(this.options.apiPool, { schoolId, userId: actor.userId }, async (client) => {
      if (actor.role === 'SCHOOL_OWNER') {
        const result = await client.query<{ class_count: string; teacher_count: string; student_count: string }>(`
          SELECT
            (SELECT count(*) FROM classes)::text AS class_count,
            (SELECT count(*) FROM school_memberships WHERE role = 'TEACHER')::text AS teacher_count,
            (SELECT count(*) FROM school_memberships WHERE role = 'STUDENT')::text AS student_count
        `);
        const row = result.rows[0]!;
        return {
          title: 'Tổng quan trường', role: actor.role, schoolId,
          metrics: [
            { id: 'classes', label: 'Lớp học', value: numeric(row.class_count) },
            { id: 'teachers', label: 'Giáo viên', value: numeric(row.teacher_count) },
            { id: 'students', label: 'Học sinh', value: numeric(row.student_count) },
          ],
        };
      }

      if (actor.role === 'TEACHER') {
        const result = await client.query<{ class_count: string; learner_count: string; pending_essay_count: string }>(`
          SELECT
            (SELECT count(DISTINCT cta.class_id) FROM class_teacher_assignments cta WHERE cta.teacher_id = $1)::text AS class_count,
            (SELECT count(DISTINCT ce.student_id) FROM class_teacher_assignments cta JOIN class_enrollments ce ON ce.class_id = cta.class_id AND ce.status = 'ACTIVE' WHERE cta.teacher_id = $1)::text AS learner_count,
            (SELECT count(*) FROM submission_answers sa JOIN assignment_attempts aa ON aa.id = sa.attempt_id JOIN assignments a ON a.id = aa.assignment_id JOIN class_teacher_assignments cta ON cta.class_id = a.class_id AND (cta.role = 'HOMEROOM_TEACHER' OR cta.subject_id = a.subject_id) WHERE cta.teacher_id = $1 AND sa.teacher_score IS NULL AND sa.auto_score IS NULL)::text AS pending_essay_count
        `, [actor.userId]);
        const row = result.rows[0]!;
        return {
          title: 'Không gian giảng dạy', role: actor.role, schoolId,
          metrics: [
            { id: 'classes', label: 'Lớp được phân công', value: numeric(row.class_count) },
            { id: 'learners', label: 'Học sinh phụ trách', value: numeric(row.learner_count) },
            { id: 'essays', label: 'Tự luận chờ chấm', value: numeric(row.pending_essay_count) },
          ],
        };
      }

      const result = await client.query<{ pending_assignments: string; completed_assignments: string; average_score: string | null }>(`
        SELECT
          (SELECT count(*) FROM assignments a JOIN class_enrollments ce ON ce.class_id = a.class_id AND ce.student_id = $1 AND ce.status = 'ACTIVE' WHERE a.status = 'PUBLISHED' AND (a.due_at IS NULL OR a.due_at >= now()))::text AS pending_assignments,
          (SELECT count(*) FROM assignment_attempts WHERE student_id = $1 AND status IN ('SUBMITTED', 'GRADED', 'RETURNED'))::text AS completed_assignments,
          (SELECT avg(score / max_score) FROM gradebook_entries WHERE student_id = $1)::text AS average_score
      `, [actor.userId]);
      const row = result.rows[0]!;
      return {
        title: 'Nhịp học của em', role: actor.role, schoolId,
        metrics: [
          { id: 'assignments', label: 'Bài tập đang mở', value: numeric(row.pending_assignments) },
          { id: 'completed', label: 'Bài đã nộp', value: numeric(row.completed_assignments) },
          { id: 'average', label: 'Tiến độ điểm', value: Math.round(numeric(row.average_score) * 100) },
        ],
      };
    });
  }

  async createLesson(actor: AuthContext, input: CreateLessonInput, idempotencyKey: string): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    return withTenantTransaction(this.options.apiPool, { schoolId, userId: actor.userId }, async (client) => this.idempotent(client, schoolId, actor.userId, 'LESSON_CREATE', idempotencyKey, input, async () => {
      await this.assertTeacherCanManage(client, actor, input.classId, input.subjectId);
      const result = await client.query<{ id: string; class_id: string; subject_id: string; title: string; published_at: Date | null }>(`
        INSERT INTO lessons (school_id, class_id, subject_id, title, content, published_at, created_by)
        VALUES ($1, $2, $3, $4, $5::jsonb, CASE WHEN $6 THEN now() ELSE NULL END, $7)
        RETURNING id, class_id, subject_id, title, published_at
      `, [schoolId, input.classId, input.subjectId, input.title, JSON.stringify(input.content), input.publish, actor.userId]);
      const lesson = result.rows[0]!;
      await this.audit(client, schoolId, actor.userId, 'LESSON_CREATED', 'lesson', lesson.id, { classId: lesson.class_id, subjectId: lesson.subject_id, published: Boolean(lesson.published_at) });
      return { id: lesson.id, classId: lesson.class_id, subjectId: lesson.subject_id, title: lesson.title, publishedAt: lesson.published_at?.toISOString() ?? null };
    }));
  }

  async submitAssignment(actor: AuthContext, assignmentId: string, input: AssignmentSubmissionInput, idempotencyKey: string): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    return withTenantTransaction(this.options.apiPool, { schoolId, userId: actor.userId }, async (client) => this.idempotent(client, schoolId, actor.userId, `ASSIGNMENT_SUBMIT:${assignmentId}`, idempotencyKey, input, async () => {
      const assignmentResult = await client.query<{ class_id: string; subject_id: string; status: string }>(`
        SELECT a.class_id, a.subject_id, a.status
        FROM assignments a
        JOIN class_enrollments ce ON ce.class_id = a.class_id AND ce.student_id = $2 AND ce.status = 'ACTIVE'
        WHERE a.id = $1
        LIMIT 1
      `, [assignmentId, actor.userId]);
      const assignment = assignmentResult.rows[0];
      if (!assignment || assignment.status !== 'PUBLISHED') throw notFound('Không tìm thấy bài tập đang mở cho tài khoản này.');

      const items = await client.query<AssignmentItemRow>(`
        SELECT ai.id, ai.points, qv.type, qv.answer_key
        FROM assignment_items ai
        JOIN question_versions qv ON qv.id = ai.question_version_id
        WHERE ai.assignment_id = $1
        ORDER BY ai.position
      `, [assignmentId]);
      const answersByItem = new Map(input.answers.map((entry) => [entry.assignmentItemId, entry.answer]));
      if (answersByItem.size !== input.answers.length || answersByItem.size !== items.rows.length || items.rows.some((item) => !answersByItem.has(item.id))) {
        throw new AppError(422, 'INCOMPLETE_ASSIGNMENT_SUBMISSION', 'Bài nộp phải có đúng một câu trả lời cho mỗi câu hỏi.');
      }

      const attemptResult = await client.query<{ id: string }>(`
        INSERT INTO assignment_attempts (school_id, assignment_id, student_id, status, attempt_number, idempotency_key, submitted_at)
        VALUES ($1, $2, $3, 'SUBMITTED', 1, $4, now())
        RETURNING id
      `, [schoolId, assignmentId, actor.userId, idempotencyKey]);
      const attemptId = attemptResult.rows[0]!.id;
      let totalScore = 0;
      let requiresTeacherMark = false;
      let maxScore = 0;
      for (const item of items.rows) {
        const points = numeric(item.points);
        maxScore += points;
        const graded = gradeAnswer({ type: item.type, maxScore: points, answerKey: jsonRecord(item.answer_key) }, answersByItem.get(item.id)!);
        requiresTeacherMark ||= graded.status === 'NEEDS_TEACHER_MARK';
        totalScore += graded.score ?? 0;
        await client.query(`
          INSERT INTO submission_answers (school_id, attempt_id, assignment_item_id, answer, auto_score)
          VALUES ($1, $2, $3, $4::jsonb, $5)
        `, [schoolId, attemptId, item.id, JSON.stringify(answersByItem.get(item.id)), graded.score]);
      }
      const status = requiresTeacherMark ? 'SUBMITTED' : 'GRADED';
      await client.query('UPDATE assignment_attempts SET status = $2 WHERE id = $1', [attemptId, status]);
      if (!requiresTeacherMark) {
        await client.query(`
          INSERT INTO gradebook_entries (school_id, class_id, subject_id, student_id, assignment_id, score, max_score, source, recorded_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'AUTO', $4)
        `, [schoolId, assignment.class_id, assignment.subject_id, actor.userId, assignmentId, totalScore, maxScore]);
      }
      await this.audit(client, schoolId, actor.userId, 'ASSIGNMENT_SUBMITTED', 'assignment_attempt', attemptId, { assignmentId, status, requiresTeacherMark });
      return { assignmentId, attemptId, status, autoScore: totalScore, maxScore, requiresTeacherMark };
    }));
  }

  async saveRiasecAssessment(actor: AuthContext, answers: Record<string, number>, idempotencyKey: string): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    return withTenantTransaction(this.options.apiPool, { schoolId, userId: actor.userId }, async (client) => this.idempotent(client, schoolId, actor.userId, 'CAREER_RIASEC', idempotencyKey, answers, async () => {
      const result = scoreRiasecAnswers(answers);
      const inserted = await client.query<{ id: string }>(`
        INSERT INTO career_assessments (school_id, user_id, kind, answers, scores)
        VALUES ($1, $2, 'RIASEC', $3::jsonb, $4::jsonb)
        RETURNING id
      `, [schoolId, actor.userId, JSON.stringify(answers), JSON.stringify({ ...result.scores, code: result.code })]);
      await client.query(`
        INSERT INTO career_profiles (user_id, school_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
      `, [actor.userId, schoolId]);
      await this.audit(client, schoolId, actor.userId, 'CAREER_RIASEC_COMPLETED', 'career_assessment', inserted.rows[0]!.id, { code: result.code });
      return { id: inserted.rows[0]!.id, kind: 'RIASEC', code: result.code, scores: result.scores };
    }));
  }

  async getCareerRecommendations(actor: AuthContext): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    return withTenantTransaction(this.options.apiPool, { schoolId, userId: actor.userId }, async (client) => {
      const assessment = await client.query<{ scores: unknown }>(`
        SELECT scores FROM career_assessments
        WHERE user_id = $1 AND kind = 'RIASEC'
        ORDER BY completed_at DESC
        LIMIT 1
      `, [actor.userId]);
      const riasec = this.readRiasec(assessment.rows[0]?.scores);
      const grades = await client.query<{ overall: string | null }>('SELECT avg(score / max_score)::text AS overall FROM gradebook_entries WHERE student_id = $1', [actor.userId]);
      const overall = numeric(grades.rows[0]?.overall, 0.5);
      const careers = await client.query<{ id: string; name: string; riasec_weights: unknown }>('SELECT id, name, riasec_weights FROM careers WHERE is_active = true ORDER BY name LIMIT 100');
      return rankCareerMatches(careers.rows.map((career) => {
        const weights = jsonRecord(career.riasec_weights);
        const riasecProfile = Object.entries(weights)
          .filter(([dimension, weight]) => ['R', 'I', 'A', 'S', 'E', 'C'].includes(dimension) && Number.isFinite(Number(weight)))
          .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]))
          .map(([dimension]) => dimension)
          .join('').slice(0, 3) || 'RIA';
        return { id: career.id, title: career.name, riasecProfile, academicGroup: 'BROAD' as const, marketDemand: 0.5, risk: 0.3, aptitudeWeights: {} };
      }), { riasec, academics: { science: overall, social: overall, overall }, aptitude: { numerical: 0.5, verbal: 0.5, logical: 0.5, spatial: 0.5, social: 0.5 } });
    });
  }

  async syncOfflineEvents(actor: AuthContext, events: OfflineEventInput[], idempotencyKey: string): Promise<unknown> {
    const schoolId = assertSchoolActor(actor);
    return withTenantTransaction(this.options.apiPool, { schoolId, userId: actor.userId }, async (client) => this.idempotent(client, schoolId, actor.userId, 'OFFLINE_EVENT_SYNC', idempotencyKey, events, async () => {
      const conflictIds: string[] = [];
      let accepted = 0;
      for (const event of events) {
        const payload = { kind: event.kind, occurredAt: event.occurredAt, payload: event.payload };
        const existing = await client.query<{ payload: unknown }>('SELECT payload FROM offline_outbox WHERE user_id = $1 AND client_event_id = $2 FOR UPDATE', [actor.userId, event.clientEventId]);
        if (existing.rows[0]) {
          if (requestHash(existing.rows[0].payload) !== requestHash(payload)) conflictIds.push(event.clientEventId);
          else accepted += 1;
          continue;
        }
        await client.query(`
          INSERT INTO offline_outbox (school_id, user_id, client_event_id, payload, status)
          VALUES ($1, $2, $3, $4::jsonb, 'QUEUED')
        `, [schoolId, actor.userId, event.clientEventId, JSON.stringify(payload)]);
        accepted += 1;
      }
      await this.audit(client, schoolId, actor.userId, 'OFFLINE_EVENTS_SYNCED', 'offline_outbox', null, { accepted, conflictCount: conflictIds.length });
      return { accepted, conflictIds, idempotencyKey };
    }));
  }

  async getBillingQuote(schoolId: string): Promise<unknown> {
    const result = await this.options.controlPool.query<{ class_count: string; included_class_quota: string; base_price_vnd: string; extra_class_price_vnd: string; status: string; trial_ends_at: Date | null }>(`
      SELECT
        (SELECT count(*) FROM classes WHERE school_id = s.id)::text AS class_count,
        sub.included_class_quota::text, sub.base_price_vnd::text, sub.extra_class_price_vnd::text, sub.status::text, sub.trial_ends_at
      FROM schools s
      JOIN subscriptions sub ON sub.school_id = s.id
      WHERE s.id = $1
    `, [schoolId]);
    const row = result.rows[0];
    if (!row) throw notFound('Không tìm thấy gói dịch vụ của trường.');
    const trialActive = row.status === 'TRIAL' && Boolean(row.trial_ends_at && row.trial_ends_at > new Date());
    const charge = calculateMonthlyCharge({
      classCount: numeric(row.class_count), includedClassQuota: numeric(row.included_class_quota), basePriceVnd: numeric(row.base_price_vnd), extraClassPriceVnd: numeric(row.extra_class_price_vnd), status: row.status === 'ACTIVE' ? 'ACTIVE' : trialActive ? 'TRIAL' : 'SUSPENDED',
    });
    return { ...charge, status: row.status, trialEndsAt: row.trial_ends_at?.toISOString() ?? null };
  }

  async queueCrawlJob(actor: AuthContext, rawUrl: string, idempotencyKey: string): Promise<unknown> {
    const configuredHosts = this.options.crawlAllowlist ?? new Set<string>();
    const sourceRows = await this.options.controlPool.query<{ host: string }>('SELECT host FROM crawl_sources WHERE is_enabled = true');
    const allowedHosts = new Set([...configuredHosts, ...sourceRows.rows.map((row) => row.host)]);
    const url = assertCrawlUrlIsSafe(rawUrl, allowedHosts);
    const client = await this.options.controlPool.connect();
    try {
      await client.query('BEGIN');
      const source = await client.query<{ id: string }>('SELECT id FROM crawl_sources WHERE host = $1 AND is_enabled = true LIMIT 1', [url.hostname]);
      if (!source.rows[0]) throw new AppError(422, 'CRAWL_SOURCE_NOT_CONFIGURED', 'Nguồn crawl chưa được platform admin cấu hình.');
      const result = await this.idempotent(client, null, actor.userId, 'CRAWL_JOB_CREATE', idempotencyKey, { url: url.toString() }, async () => {
        const inserted = await client.query<{ id: string; status: string }>(`
          INSERT INTO crawl_jobs (source_id, requested_url, requested_by, status)
          VALUES ($1, $2, $3, 'QUEUED')
          RETURNING id, status
        `, [source.rows[0]!.id, url.toString(), actor.userId]);
        await this.audit(client, null, actor.userId, 'CRAWL_JOB_QUEUED', 'crawl_job', inserted.rows[0]!.id, { host: url.hostname });
        return { id: inserted.rows[0]!.id, url: url.toString(), status: inserted.rows[0]!.status, idempotencyKey };
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async assertTeacherCanManage(client: pg.PoolClient, actor: AuthContext, classId: string, subjectId: string): Promise<void> {
    if (actor.role === 'SCHOOL_OWNER') return;
    const permitted = await client.query<{ allowed: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM class_teacher_assignments
        WHERE class_id = $1 AND teacher_id = $2 AND (role = 'HOMEROOM_TEACHER' OR subject_id = $3)
      ) AS allowed
    `, [classId, actor.userId, subjectId]);
    if (!permitted.rows[0]?.allowed) throw forbidden('Bạn không được phân công quản lý lớp hoặc môn học này.');
  }

  private async idempotent<T>(client: pg.PoolClient, schoolId: string | null, actorId: string, operation: string, idempotencyKey: string, request: unknown, work: () => Promise<T>): Promise<T> {
    const hash = requestHash(request);
    const existing = await client.query<{ request_hash: string; response: T | null }>(`
      SELECT request_hash, response FROM idempotency_records
      WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3
      FOR UPDATE
    `, [actorId, operation, idempotencyKey]);
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== hash) throw conflict('IDEMPOTENCY_KEY_REUSED', 'X-Idempotency-Key đã được dùng cho một nội dung khác.');
      if (existing.rows[0].response === null) throw conflict('IDEMPOTENCY_IN_PROGRESS', 'Thao tác cùng idempotency key đang được xử lý.');
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

  private async audit(client: pg.PoolClient, schoolId: string | null, actorId: string, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_events (school_id, actor_id, action, target_type, target_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `, [schoolId, actorId, action, targetType, targetId, JSON.stringify(metadata)]);
  }

  private readRiasec(rawScores: unknown): RiasecResult {
    const raw = jsonRecord(rawScores);
    const scores = Object.fromEntries(['R', 'I', 'A', 'S', 'E', 'C'].map((dimension) => [dimension, Math.max(0, Math.min(1, numeric(typeof raw[dimension] === 'number' || typeof raw[dimension] === 'string' ? raw[dimension] : undefined, 0)))])) as RiasecResult['scores'];
    const code = typeof raw.code === 'string' && raw.code.length >= 3
      ? raw.code.slice(0, 3)
      : Object.keys(scores).sort((left, right) => scores[right as keyof typeof scores] - scores[left as keyof typeof scores] || left.localeCompare(right)).slice(0, 3).join('');
    return { scores, code };
  }
}

