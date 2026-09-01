import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';

const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };
const owner = { userId: 'owner-1', role: 'SCHOOL_OWNER' as const, schoolId: 'school-a', email: 'owner@example.test', displayName: 'Cô Lan' };

function buildPlatformRepositoryStub(calls: string[]) {
  return {
    getDashboard: async () => ({ title: 'Không gian học tập', metrics: [] }),
    listAdminUsers: async () => ({ items: [{ id: 'user-2', email: 'teacher@example.test', displayName: 'Cô An', role: 'TEACHER', schoolName: 'THPT Nguyễn Du', isActive: true }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }),
    listAdminSchools: async () => ({ items: [{ id: 'school-1', code: 'SP-NGUYENDU', name: 'THPT Nguyễn Du', ownerName: 'Cô Lan', ownerEmail: 'lan@example.test', activeUserCount: 35, createdAt: new Date(0).toISOString() }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }),
    getAdminSchool: async (_actor: unknown, schoolId: string) => ({ id: schoolId, code: 'SP-NGUYENDU', name: 'THPT Nguyễn Du', ownerName: 'Cô Lan', ownerEmail: 'lan@example.test', activeUserCount: 35, classCount: 2, createdAt: new Date(0).toISOString() }),
    listAdminAuditEvents: async () => ({ items: [{ id: 'audit-1', action: 'ADMIN_USER_SESSIONS_REVOKED', targetType: 'user', targetId: 'user-2', actorDisplayName: 'Platform Admin', actorEmail: 'admin@example.test', schoolName: null, createdAt: new Date(0).toISOString() }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }),
    invitePlatformAdmin: async (_actor: unknown, input: { email: string; displayName: string }, idempotencyKey: string) => { calls.push(`platform-admin-invite:${idempotencyKey}`); return { id: 'platform-admin-new', ...input, status: 'PENDING_ACTIVATION', activationEmailQueued: true }; },
    setAdminUserStatus: async (_actor: unknown, userId: string, input: { isActive: boolean }, idempotencyKey: string) => { calls.push(`user-status:${idempotencyKey}`); return { id: userId, isActive: input.isActive }; },
    revokeAdminUserSessions: async (_actor: unknown, userId: string, idempotencyKey: string) => { calls.push(`user-revoke:${idempotencyKey}`); return { id: userId, revoked: true }; },
    createLesson: async (_actor: unknown, input: { title: string }, idempotencyKey: string) => { calls.push(`lesson:${idempotencyKey}`); return { id: 'lesson-1', ...input }; },
    listLessons: async (_actor: unknown, input: { classId: string }) => [{ id: 'lesson-1', classId: input.classId, subjectId: '22222222-2222-4222-8222-222222222222', title: 'Khảo sát hàm số', status: 'PUBLISHED', progress: 'IN_PROGRESS' }],
    getLesson: async (_actor: unknown, lessonId: string) => ({ id: lessonId, classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Khảo sát hàm số', content: { blocks: [{ type: 'paragraph', text: 'Nội dung bài.' }] }, status: 'PUBLISHED', progress: 'IN_PROGRESS' }),
    setLessonProgress: async (_actor: unknown, lessonId: string, input: { status: string }, idempotencyKey: string) => { calls.push(`lesson-progress:${idempotencyKey}`); return { lessonId, status: input.status }; },
    submitAssignment: async (_actor: unknown, assignmentId: string, _answers: unknown, idempotencyKey: string) => { calls.push(`submission:${idempotencyKey}`); return { assignmentId, attemptId: 'attempt-1', status: 'SUBMITTED' }; },
    saveRiasecAssessment: async (_actor: unknown, answers: Record<string, number>) => ({ kind: 'RIASEC', answers, code: 'IRC' }),
    getCareerRecommendations: async () => [{ id: 'software', title: 'Kỹ sư phần mềm', score: 0.88, advisory: true }],
    syncOfflineEvents: async (_actor: unknown, events: unknown[], idempotencyKey: string) => ({ accepted: events.length, conflictIds: [], idempotencyKey }),
    getBillingQuote: async () => ({ amountVnd: 10_000_000, extraClassCount: 0, isChargeable: true }),
    queueCrawlJob: async (_actor: unknown, url: string, idempotencyKey: string) => ({ id: 'crawl-1', url, idempotencyKey, status: 'QUEUED' }),
    createClass: async (_actor: unknown, input: { code: string; name: string }, idempotencyKey: string) => { calls.push(`class:${idempotencyKey}`); return { id: 'class-1', ...input }; },
    assignClassTeacher: async (_actor: unknown, input: { classId: string; teacherId: string }, idempotencyKey: string) => { calls.push(`assign:${idempotencyKey}`); return { id: 'assignment-1', ...input }; },
    enrollStudent: async (_actor: unknown, input: { classId: string; studentId: string }, idempotencyKey: string) => { calls.push(`enroll:${idempotencyKey}`); return { ...input, status: 'ACTIVE' }; },
    createQuestionBank: async (_actor: unknown, input: { subjectId: string; name: string }, idempotencyKey: string) => { calls.push(`bank:${idempotencyKey}`); return { id: 'bank-1', ...input }; },
    createQuestion: async (_actor: unknown, input: { bankId: string; type: string }, idempotencyKey: string) => { calls.push(`question:${idempotencyKey}`); return { id: 'question-1', versionId: 'version-1', type: input.type, maxScore: 1, isApproved: false }; },
    approveQuestion: async (_actor: unknown, input: { questionVersionId: string }, idempotencyKey: string) => { calls.push(`approve-question:${idempotencyKey}`); return { questionVersionId: input.questionVersionId, questionId: 'question-1', isApproved: true }; },
    createAssignment: async (_actor: unknown, input: { classId: string; items: unknown[]; maxAttempts?: number; gradingPolicy?: string }, idempotencyKey: string) => { calls.push(`assignment:${idempotencyKey}`); return { id: 'assignment-1', status: 'DRAFT', itemCount: input.items.length, maxAttempts: input.maxAttempts, gradingPolicy: input.gradingPolicy }; },
    updateAssignment: async (_actor: unknown, assignmentId: string, input: { title: string; items: unknown[]; maxAttempts?: number; gradingPolicy?: string }, idempotencyKey: string) => { calls.push(`assignment-update:${idempotencyKey}`); return { id: assignmentId, status: 'DRAFT', title: input.title, itemCount: input.items.length, maxAttempts: input.maxAttempts, gradingPolicy: input.gradingPolicy }; },
    publishAssignment: async (_actor: unknown, input: { assignmentId: string }, idempotencyKey: string) => { calls.push(`publish:${idempotencyKey}`); return { id: input.assignmentId, status: 'PUBLISHED' }; },
    gradeEssay: async (_actor: unknown, input: { attemptId: string; assignmentItemId: string; score: number }, idempotencyKey: string) => { calls.push(`grade:${idempotencyKey}`); return { attemptId: input.attemptId, assignmentItemId: input.assignmentItemId, score: input.score, fullyGraded: true }; },
    returnAssignmentAttempt: async (_actor: unknown, input: { attemptId: string; overallFeedback: string }, idempotencyKey: string) => { calls.push(`return:${idempotencyKey}`); return { attemptId: input.attemptId, status: 'RETURNED', overallFeedback: input.overallFeedback }; },
    overrideGradebookEntry: async (_actor: unknown, entryId: string, input: { score: number; reason: string }, idempotencyKey: string) => { calls.push(`gradebook-override:${idempotencyKey}`); return { id: entryId, score: input.score, source: 'OVERRIDE', reason: input.reason }; },
    getGradebook: async (_actor: unknown, input: { classId: string }) => { calls.push(`gradebook:${input.classId}`); return [{ id: 'entry-1', studentId: 'student-1', studentName: 'Minh An', studentCode: 'SPHS-2026-TEST', subjectId: 'subject-1', assignmentId: null, assignmentTitle: null, score: 8.5, maxScore: 10, source: 'TEACHER', recordedAt: new Date(0).toISOString(), attemptCount: 1, hasLateAttempt: false }]; },
    getLearningProgress: async () => ({
      summary: { learnerCount: 1, averageCompletionPercent: 75, averageScorePercent: 68, needsSupportCount: 1 },
      students: [{ studentId: '55555555-5555-4555-8555-555555555555', displayName: 'Minh An', studentCode: 'SPHS-2026-TEST', assignedCount: 4, submittedCount: 3, completionPercent: 75, averagePercent: 68, trend: 'STABLE', needsSupport: true }],
    }),
    listSubjects: async () => [{ id: '22222222-2222-4222-8222-222222222222', code: 'MATH', name: 'Toán' }],
    listClasses: async () => [{ id: '11111111-1111-4111-8111-111111111111', code: '12A1', name: 'Lớp 12A1', gradeLevel: 12, schoolYear: '2026-2027' }],
    listTeachers: async () => [{ id: '44444444-4444-4444-8444-444444444444', displayName: 'Cô An', email: 'teacher@example.test' }],
    listStudents: async (_actor: unknown, classId?: string) => [{ id: '55555555-5555-4555-8555-555555555555', displayName: 'Minh An', email: 'student@example.test', studentCode: 'SPHS-2026-TEST', classId: classId ?? null }],
    getAssignment: async (_actor: unknown, assignmentId: string) => ({ id: assignmentId, classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Kiểm tra đạo hàm', instructions: '', status: 'PUBLISHED', dueAt: null, items: [{ id: '33333333-3333-4333-8333-333333333333', position: 1, points: 1, type: 'MULTIPLE_CHOICE', prompt: { text: 'Đạo hàm của x²?' }, rubric: {} }] }),
    getMyAssignmentAttempts: async (_actor: unknown, assignmentId: string) => [{ id: 'attempt-1', assignmentId, attemptNumber: 1, status: 'GRADED', isLate: false, submittedAt: new Date(0).toISOString(), gradedAt: new Date(0).toISOString(), score: 1, maxScore: 1, overallFeedback: null }],
    requestReportExport: async (_actor: unknown, input: { kind: string; format: string }, idempotencyKey: string) => ({ id: 'export-1', ...input, status: 'QUEUED', expiresAt: '2026-07-26T00:00:00.000Z', idempotencyKey }),
    listReportExports: async () => [{ id: 'export-1', kind: 'GRADEBOOK', format: 'CSV', status: 'READY', expiresAt: '2026-07-26T00:00:00.000Z' }],
    listPendingEssays: async () => [{ attemptId: '77777777-7777-4777-8777-777777777777', assignmentItemId: '88888888-8888-4888-8888-888888888888', assignmentTitle: 'Tự luận', studentName: 'Minh An', prompt: { text: 'Trình bày lời giải' }, answer: { text: 'Bài làm' }, maxScore: 10 }],
  };
}

function buildSchoolAdministrationRepositoryStub(calls: string[]) {
  return {
    createSchoolRequest: async () => ({ id: 'req-1', schoolName: '', principalName: '', principalEmail: '', province: '', status: 'PENDING' as const, createdAt: new Date(0).toISOString() }),
    listSchoolRequests: async () => [],
    approveSchoolRequest: async () => null,
    rejectSchoolRequest: async (id: string, reviewedBy: string, reason: string) => ({ id, schoolName: 'THPT Mới', principalName: 'Hiệu trưởng', principalEmail: 'principal@example.test', province: 'Đà Nẵng', status: 'REJECTED', createdAt: new Date(0).toISOString(), reviewedBy, reviewReason: reason }),
    createStudent: async (_actor: unknown, input: { displayName: string; email: string }, idempotencyKey: string) => { calls.push(`student:${idempotencyKey}`); return { id: 'student-new-1', ...input }; },
    inviteTeacher: async (_actor: unknown, input: { displayName: string; email: string }, idempotencyKey: string) => { calls.push(`invite:${idempotencyKey}`); return { id: 'teacher-new-1', ...input, invitationToken: 'token-abc' }; },
    acceptInvitation: async (token: string) => { calls.push(`accept:${token}`); return { userId: 'teacher-new-1', schoolId: 'school-a', role: 'TEACHER' as const, email: 'new.teacher@example.test' }; },
    updateProfile: async (_actor: unknown, input: { displayName?: string }, idempotencyKey: string) => { calls.push(`profile:${idempotencyKey}`); return { id: 'user-1', displayName: input.displayName ?? 'Không đổi', email: 'user@example.test', avatarObjectKey: null }; },
    createRegistrationRequest: async (input: { schoolCode: string; displayName: string; email: string; requestedRole: string }) => ({ id: 'registration-1', schoolId: 'school-a', ...input, status: 'PENDING', createdAt: new Date(0).toISOString() }),
    listRegistrationRequests: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    reviewRegistrationRequest: async (_actor: unknown, requestId: string, input: { decision: string }, idempotencyKey: string) => { calls.push(`registration:${idempotencyKey}`); return { id: requestId, status: input.decision, activationEmailQueued: input.decision === 'APPROVED' }; },
  };
}

function buildTestApp(currentUser = teacher) {
  const calls: string[] = [];
  const app = buildApp({
    authRepository: { getSession: async () => currentUser, login: async () => null, revokeSession: async () => undefined } as never,
    platformRepository: buildPlatformRepositoryStub(calls) as never,
    schoolAdministrationRepository: buildSchoolAdministrationRepositoryStub(calls) as never,
  });
  return { app, calls };
}

describe('v1 role API surface', () => {
  it('accepts a public registration request without exposing an activation token and lets an owner decide it idempotently', async () => {
    const { app, calls } = buildTestApp(owner);
    const created = await app.inject({ method: 'POST', url: '/api/v1/public/registration-requests', payload: { schoolCode: 'SP-AB12CD34', displayName: 'Nguyễn Minh', email: 'minh@example.test', requestedRole: 'STUDENT' } });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ id: 'registration-1', status: 'PENDING', requestedRole: 'STUDENT' });
    expect(JSON.stringify(created.json())).not.toContain('token');

    const decision = await app.inject({ method: 'POST', url: '/api/v1/registrations/11111111-1111-4111-8111-111111111111/review', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'registration-review-20260724-001' }, payload: { decision: 'APPROVED' } });
    expect(decision.statusCode).toBe(200);
    expect(decision.json().data).toMatchObject({ status: 'APPROVED', activationEmailQueued: true });
    expect(calls).toContain('registration:registration-review-20260724-001');
    await app.close();
  });

  it('lets a platform admin list users, suspend an account, and revoke its sessions', async () => {
    const admin = { userId: 'admin-1', role: 'PLATFORM_ADMIN' as const, email: 'admin@example.test', displayName: 'Platform Admin' };
    const { app, calls } = buildTestApp(admin);
    const users = await app.inject({ method: 'GET', url: '/api/v1/admin/users?role=TEACHER&status=ACTIVE', headers: { cookie: 'smartpath_session=test' } });
    expect(users.statusCode).toBe(200);
    expect(users.json().data.items[0]).toMatchObject({ id: 'user-2', role: 'TEACHER', isActive: true });

    const status = await app.inject({ method: 'POST', url: '/api/v1/admin/users/11111111-1111-4111-8111-111111111111/status', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'admin-user-status-20260725-001' }, payload: { isActive: false } });
    expect(status.statusCode).toBe(200);
    expect(status.json().data).toMatchObject({ isActive: false });

    const revoked = await app.inject({ method: 'POST', url: '/api/v1/admin/users/11111111-1111-4111-8111-111111111111/revoke-sessions', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'admin-user-revoke-20260725-001' } });
    expect(revoked.statusCode).toBe(200);
    expect(calls).toContain('user-status:admin-user-status-20260725-001');
    expect(calls).toContain('user-revoke:admin-user-revoke-20260725-001');
    await app.close();
  });

  it('only lets a platform admin read a paginated, filtered security audit log', async () => {
    const admin = { userId: 'admin-1', role: 'PLATFORM_ADMIN' as const, email: 'admin@example.test', displayName: 'Platform Admin' };
    const { app } = buildTestApp(admin);
    const allowed = await app.inject({ method: 'GET', url: '/api/v1/admin/audit-events?page=1&pageSize=20&action=ADMIN_USER_SESSIONS_REVOKED', headers: { cookie: 'smartpath_session=test' } });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().data.items[0]).toMatchObject({ action: 'ADMIN_USER_SESSIONS_REVOKED', actorEmail: 'admin@example.test' });
    await app.close();

    const forbiddenApp = buildTestApp(teacher).app;
    const forbidden = await forbiddenApp.inject({ method: 'GET', url: '/api/v1/admin/audit-events', headers: { cookie: 'smartpath_session=test' } });
    expect(forbidden.statusCode).toBe(403);
    await forbiddenApp.close();
  });

  it('lets a platform admin list schools and read a school detail without crossing into tenant data', async () => {
    const admin = { userId: 'admin-1', role: 'PLATFORM_ADMIN' as const, email: 'admin@example.test', displayName: 'Platform Admin' };
    const { app } = buildTestApp(admin);
    const schools = await app.inject({ method: 'GET', url: '/api/v1/admin/schools?page=1&pageSize=20', headers: { cookie: 'smartpath_session=test' } });
    expect(schools.statusCode).toBe(200);
    expect(schools.json().data.items[0]).toMatchObject({ name: 'THPT Nguyễn Du', activeUserCount: 35 });
    const detail = await app.inject({ method: 'GET', url: '/api/v1/admin/schools/11111111-1111-4111-8111-111111111111', headers: { cookie: 'smartpath_session=test' } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data).toMatchObject({ classCount: 2, ownerEmail: 'lan@example.test' });
    await app.close();
  });

  it('lets a platform admin reject a pending school request with an accountable reason', async () => {
    const admin = { userId: 'admin-1', role: 'PLATFORM_ADMIN' as const, email: 'admin@example.test', displayName: 'Platform Admin' };
    const { app } = buildTestApp(admin);
    const response = await app.inject({ method: 'POST', url: '/api/v1/admin/school-requests/11111111-1111-4111-8111-111111111111/reject', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'school-reject-20260725-001' }, payload: { reason: 'Thiếu thông tin pháp lý để mở pilot.' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ status: 'REJECTED', reviewReason: 'Thiếu thông tin pháp lý để mở pilot.' });
    await app.close();
  });

  it('lets a platform admin invite another admin without exposing the activation token', async () => {
    const admin = { userId: 'admin-1', role: 'PLATFORM_ADMIN' as const, email: 'admin@example.test', displayName: 'Platform Admin' };
    const { app, calls } = buildTestApp(admin);
    const response = await app.inject({ method: 'POST', url: '/api/v1/admin/platform-admins/invitations', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'platform-admin-invite-20260725-001' }, payload: { email: 'admin.two@example.test', displayName: 'Admin Thứ Hai' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ email: 'admin.two@example.test', status: 'PENDING_ACTIVATION', activationEmailQueued: true });
    expect(JSON.stringify(response.json().data)).not.toContain('token');
    expect(calls).toContain('platform-admin-invite:platform-admin-invite-20260725-001');
    await app.close();
  });

  it('requires a session for dashboards and requires an idempotency key before creating a lesson', async () => {
    const anonymous = buildApp();
    const anonymousResponse = await anonymous.inject({ method: 'GET', url: '/api/v1/dashboard' });
    expect(anonymousResponse.statusCode).toBe(401);

    const { app, calls } = buildTestApp();
    const missingKey = await app.inject({ method: 'POST', url: '/api/v1/lessons', headers: { cookie: 'smartpath_session=test' }, payload: { classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Đạo hàm', content: { blocks: [] } } });
    expect(missingKey.statusCode).toBe(400);

    const created = await app.inject({ method: 'POST', url: '/api/v1/lessons', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'lesson-create-20260723-001' }, payload: { classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Đạo hàm', content: { blocks: [] } } });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ id: 'lesson-1', title: 'Đạo hàm' });
    expect(calls).toEqual(['lesson:lesson-create-20260723-001']);
    await app.close();
  });

  it('lists an enrolled learner\'s published lessons and records lesson progress idempotently', async () => {
    const { app, calls } = buildTestApp(student);
    const classId = '11111111-1111-4111-8111-111111111111';
    const lessons = await app.inject({ method: 'GET', url: `/api/v1/lessons?classId=${classId}`, headers: { cookie: 'smartpath_session=test' } });
    expect(lessons.statusCode).toBe(200);
    expect(lessons.json().data[0]).toMatchObject({ id: 'lesson-1', status: 'PUBLISHED', progress: 'IN_PROGRESS' });

    const progress = await app.inject({ method: 'POST', url: '/api/v1/lessons/33333333-3333-4333-8333-333333333333/progress', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'lesson-progress-20260724-001' }, payload: { status: 'COMPLETED' } });
    expect(progress.statusCode).toBe(200);
    expect(progress.json().data).toMatchObject({ status: 'COMPLETED' });
    expect(calls).toContain('lesson-progress:lesson-progress-20260724-001');
    await app.close();
  });

  it('accepts a student submission and RIASEC result only through the authenticated learner route', async () => {
    const { app } = buildTestApp(student);
    const submission = await app.inject({ method: 'POST', url: '/api/v1/assignments/assignment-1/submissions', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'submit-20260723-001' }, payload: { answers: [{ assignmentItemId: '33333333-3333-4333-8333-333333333333', answer: { choice: 'B' } }] } });
    expect(submission.statusCode).toBe(201);
    expect(submission.json().data.status).toBe('SUBMITTED');

    const riasec = await app.inject({ method: 'POST', url: '/api/v1/career/assessments/riasec', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'riasec-20260723-001' }, payload: { answers: { I1: 5, R1: 4, C1: 3 } } });
    expect(riasec.statusCode).toBe(201);
    expect(riasec.json().data.code).toBe('IRC');
    await app.close();
  });

  it('returns a safe error envelope when a repository denies an otherwise authenticated request', async () => {
    const { AppError } = await import('../../src/errors.js');
    const calls: string[] = [];
    const app = buildApp({
      authRepository: { getSession: async () => teacher, login: async () => null, revokeSession: async () => undefined } as never,
      platformRepository: {
        ...buildPlatformRepositoryStub(calls),
        createLesson: async () => { throw new AppError(403, 'TEACHER_ASSIGNMENT_REQUIRED', 'Không được phép.'); },
      } as never,
    });
    const response = await app.inject({ method: 'POST', url: '/api/v1/lessons', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'lesson-denied-20260723-001' }, payload: { classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Đạo hàm', content: { blocks: [] } } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toMatchObject({ code: 'TEACHER_ASSIGNMENT_REQUIRED', message: 'Không được phép.' });
    expect(response.json().error.request_id).toBeTruthy();
    await app.close();
  });

  it('returns school catalogs for accessible selectors and enforces owner-only teacher listing', async () => {
    const { app } = buildTestApp(owner);
    const headers = { cookie: 'smartpath_session=test' };
    const [subjects, classes, teachers, students] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v1/subjects', headers }),
      app.inject({ method: 'GET', url: '/api/v1/classes', headers }),
      app.inject({ method: 'GET', url: '/api/v1/teachers', headers }),
      app.inject({ method: 'GET', url: '/api/v1/students?classId=11111111-1111-4111-8111-111111111111', headers }),
    ]);
    expect(subjects.statusCode).toBe(200);
    expect(subjects.json().data[0]).toMatchObject({ code: 'MATH', name: 'Toán' });
    expect(classes.json().data[0]).toMatchObject({ code: '12A1' });
    expect(teachers.json().data[0]).toMatchObject({ displayName: 'Cô An' });
    expect(students.json().data[0]).toMatchObject({ studentCode: 'SPHS-2026-TEST' });
    await app.close();

    const teacherApp = buildTestApp(teacher).app;
    const forbiddenTeachers = await teacherApp.inject({ method: 'GET', url: '/api/v1/teachers', headers });
    expect(forbiddenTeachers.statusCode).toBe(403);
    const invalidStudents = await teacherApp.inject({ method: 'GET', url: '/api/v1/students?classId=not-a-uuid', headers });
    expect(invalidStudents.statusCode).toBe(422);
    await teacherApp.close();
  });

  it('lets a school owner create a class, assign a teacher, and enroll a student with idempotency keys', async () => {
    const { app, calls } = buildTestApp(owner);
    const created = await app.inject({ method: 'POST', url: '/api/v1/classes', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'class-create-20260724-001' }, payload: { code: '12A2', name: 'Lớp 12A2', gradeLevel: 12, schoolYear: '2026-2027' } });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ id: 'class-1', code: '12A2' });

    const classId = '66666666-6666-4666-8666-666666666666';
    const assigned = await app.inject({ method: 'POST', url: `/api/v1/classes/${classId}/teachers`, headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'assign-20260724-001' }, payload: { teacherId: '44444444-4444-4444-8444-444444444444', subjectId: null, role: 'HOMEROOM_TEACHER' } });
    expect(assigned.statusCode).toBe(201);

    const enrolled = await app.inject({ method: 'POST', url: `/api/v1/classes/${classId}/students`, headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'enroll-20260724-001' }, payload: { studentId: '55555555-5555-4555-8555-555555555555' } });
    expect(enrolled.statusCode).toBe(201);
    expect(calls).toEqual(['class:class-create-20260724-001', 'assign:assign-20260724-001', 'enroll:enroll-20260724-001']);
    await app.close();
  });

  it('rejects assigning a subject teacher without a subject and a homeroom teacher with one', async () => {
    const { app } = buildTestApp(owner);
    const missingSubject = await app.inject({ method: 'POST', url: '/api/v1/classes/class-1/teachers', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'assign-20260724-002' }, payload: { teacherId: '44444444-4444-4444-8444-444444444444', subjectId: null, role: 'SUBJECT_TEACHER' } });
    expect(missingSubject.statusCode).toBe(422);

    const extraSubject = await app.inject({ method: 'POST', url: '/api/v1/classes/class-1/teachers', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'assign-20260724-003' }, payload: { teacherId: '44444444-4444-4444-8444-444444444444', subjectId: '22222222-2222-4222-8222-222222222222', role: 'HOMEROOM_TEACHER' } });
    expect(extraSubject.statusCode).toBe(422);
    await app.close();
  });

  it('lets a teacher create a new student and invite flow accepts an invitation token without a session', async () => {
    const { app, calls } = buildTestApp(teacher);
    const student1 = await app.inject({ method: 'POST', url: '/api/v1/admin/students', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'student-create-20260724-001' }, payload: { displayName: 'Nguyễn Văn A', email: 'a@example.test' } });
    expect(student1.statusCode).toBe(201);
    expect(student1.json().data).toMatchObject({ id: 'student-new-1' });

    const accept = await app.inject({ method: 'POST', url: '/api/v1/auth/invitations/accept', payload: { token: 'a-valid-invitation-token-value', newPassword: 'AStrongPassword123' } });
    expect(accept.statusCode).toBe(200);
    expect(accept.json().data.role).toBe('TEACHER');
    expect(calls).toContain('student:student-create-20260724-001');
    await app.close();
  });

  it('never returns a teacher activation token from the invitation API', async () => {
    const { app } = buildTestApp(owner);
    const response = await app.inject({
      method: 'POST', url: '/api/v1/admin/teachers/invitations',
      headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'teacher-invite-20260724-001' },
      payload: { displayName: 'Cô Bình', email: 'co.binh@example.test' },
    });
    expect(response.statusCode).toBe(201);
    expect(JSON.stringify(response.json().data)).not.toContain('token');
    await app.close();
  });

  it('lets an authenticated user update their own profile with an idempotency key', async () => {
    const { app, calls } = buildTestApp(student);
    const response = await app.inject({ method: 'PATCH', url: '/api/v1/me/profile', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'profile-update-20260724-001' }, payload: { displayName: 'Tên mới' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.displayName).toBe('Tên mới');
    expect(calls).toEqual(['profile:profile-update-20260724-001']);
    await app.close();
  });

  it('lets a teacher build a question bank, question, and draft assignment, then publish it', async () => {
    const { app, calls } = buildTestApp(teacher);
    const bank = await app.inject({ method: 'POST', url: '/api/v1/question-banks', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'bank-create-20260724-001' }, payload: { subjectId: '22222222-2222-4222-8222-222222222222', name: 'Ngân hàng Toán 12' } });
    expect(bank.statusCode).toBe(201);

    const question = await app.inject({ method: 'POST', url: '/api/v1/questions', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'question-create-20260724-001' }, payload: { bankId: '99999999-9999-4999-8999-999999999999', type: 'MULTIPLE_CHOICE', prompt: { text: 'Đạo hàm của x2 là gì?', choices: ['x', '2x', 'x²'] }, answerKey: { choice: '2x' }, maxScore: 1 } });
    expect(question.statusCode).toBe(201);
    expect(question.json().data).toMatchObject({ id: 'question-1', versionId: 'version-1' });

    const assignment = await app.inject({ method: 'POST', url: '/api/v1/assignments', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'assignment-create-20260724-001' }, payload: { classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Kiểm tra đạo hàm', items: [{ questionVersionId: '33333333-3333-4333-8333-333333333333', position: 1, points: 1 }] } });
    expect(assignment.statusCode).toBe(201);
    expect(assignment.json().data).toMatchObject({ id: 'assignment-1', itemCount: 1 });

    const assignmentId = '11111111-2222-4222-8222-333333333333';
    const published = await app.inject({ method: 'POST', url: `/api/v1/assignments/${assignmentId}/publish`, headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'assignment-publish-20260724-001' } });
    expect(published.statusCode).toBe(200);
    expect(published.json().data.status).toBe('PUBLISHED');
    expect(calls).toEqual(['bank:bank-create-20260724-001', 'question:question-create-20260724-001', 'assignment:assignment-create-20260724-001', 'publish:assignment-publish-20260724-001']);
    await app.close();
  });

  it('validates the type-specific structure of all question variants before storing a version', async () => {
    const { app } = buildTestApp(teacher);
    const headers = { cookie: 'smartpath_session=test', 'x-idempotency-key': 'question-variant-20260725-001' };
    const base = { bankId: '99999999-9999-4999-8999-999999999999', maxScore: 2 };

    const missingChoice = await app.inject({ method: 'POST', url: '/api/v1/questions', headers, payload: { ...base, type: 'MULTIPLE_CHOICE', prompt: { text: 'Chọn đáp án', choices: ['A'] }, answerKey: { choice: 'A' } } });
    expect(missingChoice.statusCode).toBe(422);

    const invalidTrueFalse = await app.inject({ method: 'POST', url: '/api/v1/questions', headers: { ...headers, 'x-idempotency-key': 'question-variant-20260725-002' }, payload: { ...base, type: 'TRUE_FALSE', prompt: { text: 'Mệnh đề đúng hay sai?' }, answerKey: { value: 'true' } } });
    expect(invalidTrueFalse.statusCode).toBe(422);

    const missingAcceptable = await app.inject({ method: 'POST', url: '/api/v1/questions', headers: { ...headers, 'x-idempotency-key': 'question-variant-20260725-003' }, payload: { ...base, type: 'SHORT_ANSWER', prompt: { text: 'Nêu khái niệm' }, answerKey: { acceptable: [] } } });
    expect(missingAcceptable.statusCode).toBe(422);

    const invalidRubric = await app.inject({ method: 'POST', url: '/api/v1/questions', headers: { ...headers, 'x-idempotency-key': 'question-variant-20260725-004' }, payload: { ...base, type: 'ESSAY', prompt: { text: 'Trình bày lời giải' }, rubric: { criteria: [] } } });
    expect(invalidRubric.statusCode).toBe(422);
    await app.close();
  });

  it('passes attempt limits and grade policy from the assignment builder without accepting invalid limits', async () => {
    const { app } = buildTestApp(teacher);
    const headers = { cookie: 'smartpath_session=test', 'x-idempotency-key': 'assignment-policy-20260724-001' };
    const payload = {
      classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222',
      title: 'Luyện tập nhiều lượt', maxAttempts: 3, gradingPolicy: 'AVERAGE',
      items: [{ questionVersionId: '33333333-3333-4333-8333-333333333333', position: 1, points: 1 }],
    };
    const created = await app.inject({ method: 'POST', url: '/api/v1/assignments', headers, payload });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ maxAttempts: 3, gradingPolicy: 'AVERAGE' });

    const invalid = await app.inject({ method: 'POST', url: '/api/v1/assignments', headers: { ...headers, 'x-idempotency-key': 'assignment-policy-20260724-002' }, payload: { ...payload, maxAttempts: 11 } });
    expect(invalid.statusCode).toBe(422);
    await app.close();
  });

  it('returns assignment detail without an answer key so a student can submit it safely', async () => {
    const assignmentId = '11111111-2222-4222-8222-333333333333';
    const { app } = buildTestApp(student);
    const response = await app.inject({ method: 'GET', url: `/api/v1/assignments/${assignmentId}`, headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ id: assignmentId, status: 'PUBLISHED' });
    expect(response.json().data.items[0]).toMatchObject({ type: 'MULTIPLE_CHOICE', prompt: { text: 'Đạo hàm của x²?' } });
    expect(JSON.stringify(response.json().data)).not.toContain('answerKey');
    await app.close();
  });

  it('returns attempt history only through the authenticated student route', async () => {
    const assignmentId = '11111111-2222-4222-8222-333333333333';
    const { app } = buildTestApp(student);
    const response = await app.inject({ method: 'GET', url: `/api/v1/assignments/${assignmentId}/attempts`, headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject([{ attemptNumber: 1, isLate: false, status: 'GRADED' }]);
    await app.close();
  });

  it('queues an idempotent report export for an authorized teaching role', async () => {
    const { app } = buildTestApp(teacher);
    const response = await app.inject({ method: 'POST', url: '/api/v1/report-exports', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'report-export-20260725-001' }, payload: { kind: 'GRADEBOOK', format: 'XLSX', classId: '11111111-1111-4111-8111-111111111111' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ id: 'export-1', kind: 'GRADEBOOK', format: 'XLSX', status: 'QUEUED' });
    expect(JSON.stringify(response.json())).not.toContain('objectKey');
    await app.close();
  });

  it('lists an export and requests a signed download only through an active session', async () => {
    const download = vi.fn(async () => ({ url: 'http://minio.test/signed-export', expiresAt: '2026-07-25T01:00:00.000Z' }));
    const { app } = buildTestApp(teacher);
    const list = await app.inject({ method: 'GET', url: '/api/v1/report-exports', headers: { cookie: 'smartpath_session=test' } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data[0]).toMatchObject({ id: 'export-1', status: 'READY' });
    const downloadApp = buildApp({ authRepository: { getSession: async () => teacher } as never, reportExportDownloadService: { getDownload: download } });
    const response = await downloadApp.inject({ method: 'GET', url: '/api/v1/report-exports/11111111-1111-4111-8111-111111111111/download', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(response.json())).not.toContain('objectKey');
    await app.close(); await downloadApp.close();
  });

  it('lets a teacher submit a question approval request with idempotency', async () => {
    const versionId = '33333333-3333-4333-8333-333333333333';
    const { app, calls } = buildTestApp(owner);
    const approved = await app.inject({ method: 'POST', url: `/api/v1/question-versions/${versionId}/approve`, headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'question-approve-20260724-001' } });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data).toMatchObject({ questionVersionId: versionId, isApproved: true });
    expect(calls).toEqual(['approve-question:question-approve-20260724-001']);
    await app.close();

    const teacherApp = buildTestApp(teacher).app;
    const approvedByTeacher = await teacherApp.inject({ method: 'POST', url: `/api/v1/question-versions/${versionId}/approve`, headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'question-approve-20260724-002' } });
    expect(approvedByTeacher.statusCode).toBe(200);
    expect(approvedByTeacher.json().data).toMatchObject({ questionVersionId: versionId, isApproved: true });
    await teacherApp.close();
  });

  it('rejects creating an assignment with zero items and rejects an invalid assignment id when publishing', async () => {
    const { app } = buildTestApp(teacher);
    const noItems = await app.inject({ method: 'POST', url: '/api/v1/assignments', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'assignment-create-20260724-002' }, payload: { classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Kiểm tra rỗng', items: [] } });
    expect(noItems.statusCode).toBe(422);

    const badId = await app.inject({ method: 'POST', url: '/api/v1/assignments/not-a-uuid/publish', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'assignment-publish-20260724-002' } });
    expect(badId.statusCode).toBe(422);
    await app.close();
  });

  it('only updates an assignment while it remains a draft and keeps item order explicit', async () => {
    const { app, calls } = buildTestApp(teacher);
    const assignmentId = '11111111-1111-4111-8111-111111111111';
    const response = await app.inject({ method: 'PUT', url: `/api/v1/assignments/${assignmentId}`, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'assignment-update-20260725-001' }, payload: { classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Bản nháp đã chỉnh sửa', instructions: 'Làm cẩn thận.', dueAt: null, maxAttempts: 2, gradingPolicy: 'LATEST', items: [{ questionVersionId: '33333333-3333-4333-8333-333333333333', position: 1, points: 2 }] } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ id: assignmentId, status: 'DRAFT', title: 'Bản nháp đã chỉnh sửa', maxAttempts: 2, gradingPolicy: 'LATEST' });
    expect(calls).toContain('assignment-update:assignment-update-20260725-001');
    await app.close();
  });

  it('lets a teacher grade an essay answer and query the gradebook for their class', async () => {
    const { app, calls } = buildTestApp(teacher);
    const pending = await app.inject({ method: 'GET', url: '/api/v1/grading/pending-essays', headers: { cookie: 'smartpath_session=test' } });
    expect(pending.statusCode).toBe(200);
    expect(pending.json().data[0]).toMatchObject({ studentName: 'Minh An', maxScore: 10 });

    const attemptId = '77777777-7777-4777-8777-777777777777';
    const itemId = '88888888-8888-4888-8888-888888888888';
    const graded = await app.inject({ method: 'POST', url: `/api/v1/attempts/${attemptId}/answers/${itemId}/grade`, headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'grade-20260724-001' }, payload: { score: 8, feedback: 'Bài làm tốt, cần trình bày rõ hơn.' } });
    expect(graded.statusCode).toBe(200);
    expect(graded.json().data).toMatchObject({ attemptId, assignmentItemId: itemId, score: 8, fullyGraded: true });

    const classId = '11111111-1111-4111-8111-111111111111';
    const gradebook = await app.inject({ method: 'GET', url: `/api/v1/gradebook?classId=${classId}`, headers: { cookie: 'smartpath_session=test' } });
    expect(gradebook.statusCode).toBe(200);
    expect(gradebook.json().data).toHaveLength(1);
    expect(gradebook.json().data[0]).toMatchObject({ studentName: 'Minh An', studentCode: 'SPHS-2026-TEST', attemptCount: 1, hasLateAttempt: false });
    expect(calls).toEqual([`grade:grade-20260724-001`, `gradebook:${classId}`]);
    await app.close();
  });

  it('returns a fully graded attempt with overall feedback through an idempotent teaching-only mutation', async () => {
    const { app, calls } = buildTestApp(owner);
    const response = await app.inject({ method: 'POST', url: '/api/v1/attempts/77777777-7777-4777-8777-777777777777/return', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'attempt-return-20260725-001' }, payload: { overallFeedback: 'Em đã lập luận rõ ràng, cần kiểm tra lại bước cuối.' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ status: 'RETURNED', overallFeedback: 'Em đã lập luận rõ ràng, cần kiểm tra lại bước cuối.' });
    expect(calls).toContain('return:attempt-return-20260725-001');
    await app.close();
  });

  it('requires an accountable reason when a teaching role overrides an official grade', async () => {
    const { app, calls } = buildTestApp(teacher);
    const entryId = '99999999-9999-4999-8999-999999999999';
    const response = await app.inject({ method: 'POST', url: `/api/v1/gradebook/${entryId}/override`, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'gradebook-override-20260725-001' }, payload: { score: 9, reason: 'Đã đối chiếu lại bài làm gốc.' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ id: entryId, score: 9, source: 'OVERRIDE' });
    expect(calls).toContain('gradebook-override:gradebook-override-20260725-001');
    const invalid = await app.inject({ method: 'POST', url: `/api/v1/gradebook/${entryId}/override`, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'gradebook-override-20260725-002' }, payload: { score: 9, reason: 'ngắn' } });
    expect(invalid.statusCode).toBe(422);
    await app.close();
  });

  it('returns an aggregate progress report only to an authorized teaching role', async () => {
    const { app } = buildTestApp(teacher);
    const classId = '11111111-1111-4111-8111-111111111111';
    const response = await app.inject({ method: 'GET', url: `/api/v1/progress?classId=${classId}`, headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      summary: { learnerCount: 1, averageCompletionPercent: 75, averageScorePercent: 68, needsSupportCount: 1 },
      students: [{ studentId: '55555555-5555-4555-8555-555555555555', needsSupport: true }],
    });
    await app.close();

    const studentApp = buildTestApp(student).app;
    const forbidden = await studentApp.inject({ method: 'GET', url: `/api/v1/progress?classId=${classId}`, headers: { cookie: 'smartpath_session=test' } });
    expect(forbidden.statusCode).toBe(403);
    await studentApp.close();
  });
});
