import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };

function buildTestApp(currentUser = teacher) {
  const calls: string[] = [];
  const app = buildApp({
    authRepository: { getSession: async () => currentUser, login: async () => null, revokeSession: async () => undefined } as never,
    platformRepository: {
      getDashboard: async () => ({ title: 'Không gian học tập', metrics: [] }),
      createLesson: async (_actor: unknown, input: { title: string }, idempotencyKey: string) => { calls.push(`lesson:${idempotencyKey}`); return { id: 'lesson-1', ...input }; },
      submitAssignment: async (_actor: unknown, assignmentId: string, _answers: unknown, idempotencyKey: string) => { calls.push(`submission:${idempotencyKey}`); return { assignmentId, attemptId: 'attempt-1', status: 'SUBMITTED' }; },
      saveRiasecAssessment: async (_actor: unknown, answers: Record<string, number>) => ({ kind: 'RIASEC', answers, code: 'IRC' }),
      getCareerRecommendations: async () => [{ id: 'software', title: 'Kỹ sư phần mềm', score: 0.88, advisory: true }],
      syncOfflineEvents: async (_actor: unknown, events: unknown[], idempotencyKey: string) => ({ accepted: events.length, conflictIds: [], idempotencyKey }),
      getBillingQuote: async () => ({ amountVnd: 10_000_000, extraClassCount: 0, isChargeable: true }),
      queueCrawlJob: async (_actor: unknown, url: string, idempotencyKey: string) => ({ id: 'crawl-1', url, idempotencyKey, status: 'QUEUED' }),
    },
  } as never);
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
});



  it('returns a safe error envelope when a repository denies an otherwise authenticated request', async () => {
    const { AppError } = await import('../../src/errors.js');
    const app = buildApp({
      authRepository: { getSession: async () => teacher, login: async () => null, revokeSession: async () => undefined } as never,
      platformRepository: {
        getDashboard: async () => ({}),
        createLesson: async () => { throw new AppError(403, 'TEACHER_ASSIGNMENT_REQUIRED', 'Không được phép.'); },
        submitAssignment: async () => ({}),
        saveRiasecAssessment: async () => ({}),
        getCareerRecommendations: async () => [],
        syncOfflineEvents: async () => ({}),
        getBillingQuote: async () => ({}),
        queueCrawlJob: async () => ({}),
      },
    } as never);
    const response = await app.inject({ method: 'POST', url: '/api/v1/lessons', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'lesson-denied-20260723-001' }, payload: { classId: '11111111-1111-4111-8111-111111111111', subjectId: '22222222-2222-4222-8222-222222222222', title: 'Đạo hàm', content: {} } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toMatchObject({ code: 'TEACHER_ASSIGNMENT_REQUIRED', message: 'Không được phép.' });
    expect(response.json().error.request_id).toBeTruthy();
    await app.close();
  });
