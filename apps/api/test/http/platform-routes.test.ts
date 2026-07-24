import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };
const owner = { userId: 'owner-1', role: 'SCHOOL_OWNER' as const, schoolId: 'school-a', email: 'owner@example.test', displayName: 'Cô Lan' };

function buildPlatformRepositoryStub(calls: string[]) {
  return {
    getDashboard: async () => ({ title: 'Không gian học tập', metrics: [] }),
    createLesson: async (_actor: unknown, input: { title: string }, idempotencyKey: string) => { calls.push(`lesson:${idempotencyKey}`); return { id: 'lesson-1', ...input }; },
    submitAssignment: async (_actor: unknown, assignmentId: string, _answers: unknown, idempotencyKey: string) => { calls.push(`submission:${idempotencyKey}`); return { assignmentId, attemptId: 'attempt-1', status: 'SUBMITTED' }; },
    saveRiasecAssessment: async (_actor: unknown, answers: Record<string, number>) => ({ kind: 'RIASEC', answers, code: 'IRC' }),
    getCareerRecommendations: async () => [{ id: 'software', title: 'Kỹ sư phần mềm', score: 0.88, advisory: true }],
    syncOfflineEvents: async (_actor: unknown, events: unknown[], idempotencyKey: string) => ({ accepted: events.length, conflictIds: [], idempotencyKey }),
    getBillingQuote: async () => ({ amountVnd: 10_000_000, extraClassCount: 0, isChargeable: true }),
    queueCrawlJob: async (_actor: unknown, url: string, idempotencyKey: string) => ({ id: 'crawl-1', url, idempotencyKey, status: 'QUEUED' }),
    createClass: async (_actor: unknown, input: { code: string; name: string }, idempotencyKey: string) => { calls.push(`class:${idempotencyKey}`); return { id: 'class-1', ...input }; },
    assignClassTeacher: async (_actor: unknown, input: { classId: string; teacherId: string }, idempotencyKey: string) => { calls.push(`assign:${idempotencyKey}`); return { id: 'assignment-1', ...input }; },
    enrollStudent: async (_actor: unknown, input: { classId: string; studentId: string }, idempotencyKey: string) => { calls.push(`enroll:${idempotencyKey}`); return { ...input, status: 'ACTIVE' }; },
  };
}

function buildSchoolAdministrationRepositoryStub(calls: string[]) {
  return {
    createSchoolRequest: async () => ({ id: 'req-1', schoolName: '', principalName: '', principalEmail: '', province: '', status: 'PENDING' as const, createdAt: new Date(0).toISOString() }),
    listSchoolRequests: async () => [],
    approveSchoolRequest: async () => null,
    createStudent: async (_actor: unknown, input: { displayName: string; email: string }, idempotencyKey: string) => { calls.push(`student:${idempotencyKey}`); return { id: 'student-new-1', ...input }; },
    inviteTeacher: async (_actor: unknown, input: { displayName: string; email: string }, idempotencyKey: string) => { calls.push(`invite:${idempotencyKey}`); return { id: 'teacher-new-1', ...input, invitationToken: 'token-abc' }; },
    acceptInvitation: async (token: string) => { calls.push(`accept:${token}`); return { userId: 'teacher-new-1', schoolId: 'school-a', role: 'TEACHER' as const, email: 'new.teacher@example.test' }; },
    updateProfile: async (_actor: unknown, input: { displayName?: string }, idempotencyKey: string) => { calls.push(`profile:${idempotencyKey}`); return { id: 'user-1', displayName: input.displayName ?? 'Không đổi', email: 'user@example.test', avatarObjectKey: null }; },
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
    const response = await app.inject({ method: 'POST', url: '/api/v1/lessons', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'lesson-denied-20260723-001' }, payload: { classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Đạo hàm', content: {} } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toMatchObject({ code: 'TEACHER_ASSIGNMENT_REQUIRED', message: 'Không được phép.' });
    expect(response.json().error.request_id).toBeTruthy();
    await app.close();
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

  it('lets an authenticated user update their own profile with an idempotency key', async () => {
    const { app, calls } = buildTestApp(student);
    const response = await app.inject({ method: 'PATCH', url: '/api/v1/me/profile', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'profile-update-20260724-001' }, payload: { displayName: 'Tên mới' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.displayName).toBe('Tên mới');
    expect(calls).toEqual(['profile:profile-update-20260724-001']);
    await app.close();
  });
});
