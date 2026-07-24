import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { AppError } from './errors.js';
import { PostgresAuthRepository } from './repositories/postgres-auth.js';
import type { PlatformRepository } from './repositories/platform.js';
import type { SchoolAdministrationRepository } from './repositories/school-administration.js';
import type { AuthContext, Role } from './types.js';

const sessionCookieName = 'smartpath_session';
const allowedWebOrigins = new Set((process.env.ALLOWED_WEB_ORIGINS ?? 'http://127.0.0.1:5176').split(',').map((origin) => origin.trim()).filter(Boolean));
const schoolRequestSchema = z.object({ schoolName: z.string().trim().min(3).max(160), principalName: z.string().trim().min(3).max(120), principalEmail: z.string().trim().email().max(254), province: z.string().trim().min(2).max(100) });
const reviewSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(12).max(128) });
const lessonSchema = z.object({ classId: z.string().uuid(), subjectId: z.string().uuid(), title: z.string().trim().min(3).max(200), content: z.record(z.unknown()).default({}), publish: z.boolean().default(false) });
const submissionSchema = z.object({ answers: z.array(z.object({ assignmentItemId: z.string().uuid(), answer: z.record(z.unknown()) })).min(1).max(200) });
const riasecSchema = z.object({ answers: z.record(z.number().int().min(1).max(5)).refine((answers) => Object.keys(answers).length > 0, 'At least one answer is required') });
const offlineEventsSchema = z.object({ events: z.array(z.object({ clientEventId: z.string().trim().min(8).max(200), kind: z.string().trim().min(1).max(100), occurredAt: z.string().datetime(), payload: z.record(z.unknown()) })).min(1).max(100) });
const crawlJobSchema = z.object({ url: z.string().url().max(2048) });
const createClassSchema = z.object({ code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(120), gradeLevel: z.number().int().min(10).max(12), schoolYear: z.string().trim().min(4).max(24) });
const assignClassTeacherSchema = z.object({ classId: z.string().uuid(), teacherId: z.string().uuid(), subjectId: z.string().uuid().nullable(), role: z.enum(['SUBJECT_TEACHER', 'HOMEROOM_TEACHER']) }).refine((value) => (value.role === 'SUBJECT_TEACHER' ? value.subjectId !== null : value.subjectId === null), 'Giáo viên bộ môn cần chọn môn học; giáo viên chủ nhiệm không chọn môn học.');
const enrollStudentSchema = z.object({ classId: z.string().uuid(), studentId: z.string().uuid() });
const createStudentSchema = z.object({ displayName: z.string().trim().min(3).max(120), email: z.string().trim().email().max(254) });
const inviteTeacherSchema = z.object({ displayName: z.string().trim().min(3).max(120), email: z.string().trim().email().max(254) });
const acceptInvitationSchema = z.object({ token: z.string().trim().min(16).max(400), newPassword: z.string().min(12).max(128) });
const updateProfileSchema = z.object({ displayName: z.string().trim().min(1).max(120).optional(), avatarObjectKey: z.string().trim().max(500).nullable().optional(), email: z.string().trim().email().max(254).optional() }).refine((value) => Object.keys(value).length > 0, 'Cần ít nhất một trường để cập nhật hồ sơ.');
const idempotencyKeySchema = z.string().trim().min(8).max(200);

export interface BuildAppOptions { authRepository?: PostgresAuthRepository; schoolAdministrationRepository?: SchoolAdministrationRepository; platformRepository?: PlatformRepository; }

function errorBody(request: FastifyRequest, code: string, message: string) { return { error: { code, message, request_id: request.id } }; }
function requestOriginIsAllowed(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  return typeof origin !== 'string' || allowedWebOrigins.has(origin);
}
function headerValue(value: string | string[] | undefined): string | undefined { return typeof value === 'string' ? value : undefined; }

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false, genReqId: () => crypto.randomUUID() });
  const isProduction = process.env.NODE_ENV === 'production';
  app.addHook('onRequest', async (request, reply) => { reply.header('x-request-id', request.id); });
  void app.register(cookie);
  void app.register(cors, {
    credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    origin: (origin, callback) => (!origin || allowedWebOrigins.has(origin) ? callback(null, true) : callback(new Error('Origin is not allowed by CORS policy.'), false)),
  });
  void app.register(helmet, { contentSecurityPolicy: false });
  void app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(request, error.code, error.message));
    }
    return reply.code(500).send(errorBody(request, 'INTERNAL_ERROR', 'Hệ thống gặp lỗi không mong muốn. Vui lòng thử lại.'));
  });

  async function currentAuth(request: FastifyRequest): Promise<AuthContext | null> {
    const token = request.cookies[sessionCookieName];
    if (!token || !options.authRepository) return null;
    return options.authRepository.getSession(token);
  }
  async function requireRole(request: FastifyRequest, allowed: Role[]): Promise<AuthContext | null> {
    const auth = await currentAuth(request);
    return auth && allowed.includes(auth.role) ? auth : null;
  }
  async function requireAuthenticated(request: FastifyRequest, reply: FastifyReply): Promise<AuthContext | null> {
    const auth = await currentAuth(request);
    if (!auth) {
      reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Bạn cần đăng nhập để tiếp tục.'));
      return null;
    }
    return auth;
  }
  async function requirePlatformRole(request: FastifyRequest, reply: FastifyReply, allowed: Role[]): Promise<AuthContext | null> {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return null;
    if (!allowed.includes(auth.role)) {
      reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'));
      return null;
    }
    return auth;
  }
  function requireIdempotencyKey(request: FastifyRequest, reply: FastifyReply): string | null {
    const parsed = idempotencyKeySchema.safeParse(headerValue(request.headers['x-idempotency-key']));
    if (!parsed.success) {
      reply.code(400).send(errorBody(request, 'IDEMPOTENCY_KEY_REQUIRED', 'Thao tác này cần X-Idempotency-Key hợp lệ.'));
      return null;
    }
    return parsed.data;
  }
  function requirePlatformRepository(request: FastifyRequest, reply: FastifyReply): PlatformRepository | null {
    if (options.platformRepository) return options.platformRepository;
    reply.code(503).send(errorBody(request, 'PLATFORM_UNAVAILABLE', 'Dịch vụ nền tảng chưa sẵn sàng.'));
    return null;
  }
  function requireSchoolAdministrationRepository(request: FastifyRequest, reply: FastifyReply): SchoolAdministrationRepository | null {
    if (options.schoolAdministrationRepository) return options.schoolAdministrationRepository;
    reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    return null;
  }
  function clearSession(reply: FastifyReply): void {
    reply.clearCookie(sessionCookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: isProduction });
  }

  app.get('/healthz', async () => ({ data: { status: 'ok', product: 'Smart Path Platform' } }));

  app.post('/api/v1/auth/login', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Email hoặc mật khẩu không hợp lệ.'));
    if (!options.authRepository) return reply.code(503).send(errorBody(request, 'AUTH_UNAVAILABLE', 'Dịch vụ đăng nhập chưa sẵn sàng.'));
    const session = await options.authRepository.login(parsed.data.email, parsed.data.password);
    if (!session) return reply.code(401).send(errorBody(request, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.'));
    reply.setCookie(sessionCookieName, session.token, { path: '/', httpOnly: true, sameSite: 'lax', secure: isProduction, expires: session.expiresAt });
    return reply.send({ data: { user: session.user, expiresAt: session.expiresAt.toISOString() } });
  });

  app.get('/api/v1/auth/session', async (request, reply) => {
    const auth = await currentAuth(request);
    if (!auth) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Bạn cần đăng nhập để tiếp tục.'));
    return reply.send({ data: { user: auth } });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookieName];
    if (token && options.authRepository) await options.authRepository.revokeSession(token);
    clearSession(reply);
    return reply.code(204).send();
  });

  app.post('/api/v1/public/school-requests', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (request, reply) => {
    const parsed = schoolRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin yêu cầu mở trường không hợp lệ.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    return reply.code(201).send({ data: await options.schoolAdministrationRepository.createSchoolRequest(parsed.data) });
  });

  app.get('/api/v1/admin/school-requests', async (request, reply) => {
    const auth = await requireRole(request, ['PLATFORM_ADMIN']);
    if (!auth) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền xem yêu cầu mở trường.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    return reply.send({ data: await options.schoolAdministrationRepository.listSchoolRequests() });
  });

  app.post('/api/v1/admin/school-requests/:id/approve', async (request, reply) => {
    const auth = await requireRole(request, ['PLATFORM_ADMIN']);
    if (!auth) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền duyệt trường.'));
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Lý do duyệt không hợp lệ.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    const params = request.params as { id: string };
    const approved = await options.schoolAdministrationRepository.approveSchoolRequest(params.id, auth.userId, parsed.data.reason);
    if (!approved) return reply.code(409).send(errorBody(request, 'SCHOOL_REQUEST_NOT_PENDING', 'Yêu cầu không tồn tại hoặc đã được xử lý.'));
    return reply.send({ data: { status: approved.request.status, school: approved.school } });
  });

  app.get('/api/v1/dashboard', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getDashboard(auth) });
  });

  app.post('/api/v1/lessons', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = lessonSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin bài giảng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createLesson(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/assignments/:id/submissions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = submissionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Bài nộp không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    const assignmentId = (request.params as { id: string }).id;
    return reply.code(201).send({ data: await repository.submitAssignment(auth, assignmentId, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/career/assessments/riasec', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = riasecSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Câu trả lời RIASEC không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.saveRiasecAssessment(auth, parsed.data.answers, idempotencyKey) });
  });

  app.get('/api/v1/career/recommendations', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getCareerRecommendations(auth) });
  });

  app.post('/api/v1/sync/events', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = offlineEventsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Sự kiện đồng bộ không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.syncOfflineEvents(auth, parsed.data.events, idempotencyKey) });
  });

  app.get('/api/v1/admin/schools/:schoolId/billing-quote', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    const schoolId = (request.params as { schoolId: string }).schoolId;
    if (!z.string().uuid().safeParse(schoolId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã trường không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getBillingQuote(schoolId) });
  });

  app.post('/api/v1/classes', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createClassSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin lớp học không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createClass(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/classes/:classId/teachers', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const classId = (request.params as { classId: string }).classId;
    const parsed = assignClassTeacherSchema.safeParse({ ...(request.body as object), classId });
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin phân công giáo viên không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.assignClassTeacher(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/classes/:classId/students', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const classId = (request.params as { classId: string }).classId;
    const parsed = enrollStudentSchema.safeParse({ ...(request.body as object), classId });
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin ghi danh học sinh không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.enrollStudent(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/students', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createStudentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin học sinh không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createStudent(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/teachers/invitations', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = inviteTeacherSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin lời mời không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.inviteTeacher(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/auth/invitations/accept', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = acceptInvitationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin lời mời không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    const accepted = await repository.acceptInvitation(parsed.data.token, parsed.data.newPassword);
    return reply.code(200).send({ data: accepted });
  });

  app.patch('/api/v1/me/profile', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin hồ sơ không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.updateProfile(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/crawl-jobs', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = crawlJobSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'URL crawl không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.queueCrawlJob(auth, parsed.data.url, idempotencyKey) });
  });

  return app;
}

