import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };

function buildStub(calls: string[]) {
  return {
    getAdaptiveDiagnoses: async (_actor: unknown, input: { classId: string; subjectId: string }) => ({ graphApproved: true, subjectId: input.subjectId, groups: [{ skillCode: 'A', skillName: 'A', studentCount: 2, downstreamBlocked: 1, priority: 4 }], students: [] }),
    overrideAdaptiveDiagnosis: async (_actor: unknown, input: { studentId: string; decision: string }, key: string) => { calls.push(`override:${key}`); return { id: 'override-1', studentId: input.studentId, decision: input.decision }; },
    getMyAdaptivePlan: async () => ({ generatedAt: new Date(0).toISOString(), plans: [{ subjectId: 'subject-1', subjectName: 'Toán', status: 'ACTIONABLE', rootSkillCode: 'A', path: [], reviews: [] }] }),
  };
}

function buildTestApp(currentUser = teacher) {
  const calls: string[] = [];
  const app = buildApp({ authRepository: { getSession: async () => currentUser } as never, platformRepository: buildStub(calls) as never });
  return { app, calls };
}

describe('adaptive API surface', () => {
  it('gives a teacher the class diagnosis grouped by need', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/adaptive/diagnoses?classId=11111111-1111-4111-8111-111111111111&subjectId=22222222-2222-4222-8222-222222222222', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.groups[0]).toMatchObject({ skillCode: 'A', priority: 4 });
    await app.close();
  });

  it('records a teacher override with an accountable reason and idempotency key', async () => {
    const { app, calls } = buildTestApp();
    const missingReason = await app.inject({ method: 'POST', url: '/api/v1/adaptive/overrides', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'adaptive-override-1' }, payload: { studentId: '55555555-5555-4555-8555-555555555555', subjectId: '22222222-2222-4222-8222-222222222222', decision: 'DISMISS', reason: 'x' } });
    expect(missingReason.statusCode).toBe(422);
    const ok = await app.inject({ method: 'POST', url: '/api/v1/adaptive/overrides', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'adaptive-override-2' }, payload: { studentId: '55555555-5555-4555-8555-555555555555', subjectId: '22222222-2222-4222-8222-222222222222', decision: 'CONFIRM', reason: 'Đã đối chiếu bài làm.' } });
    expect(ok.statusCode).toBe(201);
    expect(calls).toContain('override:adaptive-override-2');
    await app.close();
  });

  it('lets a student read their own adaptive plan but blocks a teacher from it', async () => {
    const { app } = buildTestApp(student);
    const plan = await app.inject({ method: 'GET', url: '/api/v1/adaptive/my', headers: { cookie: 'smartpath_session=test' } });
    expect(plan.statusCode).toBe(200);
    expect(plan.json().data.plans[0]).toMatchObject({ subjectId: 'subject-1', status: 'ACTIONABLE' });
    await app.close();

    const teacherApp = buildTestApp(teacher).app;
    const forbidden = await teacherApp.inject({ method: 'GET', url: '/api/v1/adaptive/my', headers: { cookie: 'smartpath_session=test' } });
    expect(forbidden.statusCode).toBe(403);
    await teacherApp.close();
  });
});
