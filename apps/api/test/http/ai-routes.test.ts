import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const owner = { userId: 'owner-1', role: 'SCHOOL_OWNER' as const, schoolId: 'school-a', email: 'owner@example.test', displayName: 'Cô Lan' };
const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };

function buildStub(calls: string[]) {
  return {
    listAiModels: async () => [{ id: 'm1', provider: 'openai', modelName: 'gpt', tier: 'CLOUD', isEnabled: true, monthlyCostLimitVnd: 500000, inputVndPer1k: 20, outputVndPer1k: 60 }],
    upsertAiModel: async (_actor: unknown, input: { modelName: string }, key: string) => { calls.push(`ai-model:${key}`); return { id: 'm1', modelName: input.modelName }; },
    getAiUsageSummary: async () => ({ monthCostVnd: 12000, monthRequests: 8, monthlyCostLimitVnd: 500000 }),
    aiHealthCheck: async () => ({ ok: false, reason: 'NO_MODEL_CONFIGURED' }),
  };
}

function buildTestApp(currentUser: typeof owner | typeof teacher | typeof student = owner) {
  const calls: string[] = [];
  const app = buildApp({ authRepository: { getSession: async () => currentUser } as never, platformRepository: buildStub(calls) as never });
  return { app, calls };
}

describe('AI provider config API surface', () => {
  it('lets an owner configure a model and read usage', async () => {
    const { app, calls } = buildTestApp(owner);
    const created = await app.inject({ method: 'POST', url: '/api/v1/ai/models', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'ai-model-1' }, payload: { provider: 'anthropic', modelName: 'claude-sonnet', tier: 'CLOUD', isEnabled: true, monthlyCostLimitVnd: 1000000, inputVndPer1k: 30, outputVndPer1k: 90 } });
    expect(created.statusCode).toBe(201);
    expect(calls).toContain('ai-model:ai-model-1');
    const usage = await app.inject({ method: 'GET', url: '/api/v1/ai/usage', headers: { cookie: 'smartpath_session=test' } });
    expect(usage.json().data).toMatchObject({ monthCostVnd: 12000 });
    await app.close();
  });

  it('lets a teacher read but not configure models, and blocks students entirely', async () => {
    const teacherApp = buildTestApp(teacher).app;
    const list = await teacherApp.inject({ method: 'GET', url: '/api/v1/ai/models', headers: { cookie: 'smartpath_session=test' } });
    expect(list.statusCode).toBe(200);
    const denied = await teacherApp.inject({ method: 'POST', url: '/api/v1/ai/models', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'ai-model-2' }, payload: { provider: 'openai', modelName: 'gpt', tier: 'CLOUD', isEnabled: true } });
    expect(denied.statusCode).toBe(403);
    await teacherApp.close();

    const studentApp = buildTestApp(student).app;
    const studentList = await studentApp.inject({ method: 'GET', url: '/api/v1/ai/models', headers: { cookie: 'smartpath_session=test' } });
    expect(studentList.statusCode).toBe(403);
    await studentApp.close();
  });
});
