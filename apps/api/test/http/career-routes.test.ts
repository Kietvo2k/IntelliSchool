import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };
const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };

function buildStub(calls: string[]) {
  return {
    getAptitudeQuestions: async () => ({ questions: [{ id: 'numerical-1', dimension: 'numerical', prompt: '...', choices: ['a', 'b'] }] }),
    saveAptitudeAssessment: async (_actor: unknown, _answers: unknown, key: string) => { calls.push(`aptitude:${key}`); return { kind: 'APTITUDE', scores: { numerical: 1, verbal: 0.5, logical: 0.5, spatial: 0.5, social: 0.5 } }; },
    getCareerRecommendations: async () => ({ disclaimer: 'Kết quả chỉ mang tính tham khảo', matches: [{ id: 'swe', title: 'Kỹ sư phần mềm', score: 0.8, advisory: true }] }),
    listExamBlocks: async () => ({ version: '2025', blocks: [{ code: 'A02', label: 'Toán, Vật lí, Sinh học', subjects: ['TOAN', 'LY', 'SINH'] }] }),
    getCareerProfile: async () => ({ snapshot: {}, consentToShare: false, grants: [] }),
    updateCareerProfile: async (_actor: unknown, _input: unknown, key: string) => { calls.push(`profile:${key}`); return { snapshot: { province: 'Đà Nẵng' } }; },
    setCareerShareGrant: async (_actor: unknown, input: { scope: string; granted: boolean }, key: string) => { calls.push(`share:${key}`); return { scope: input.scope, granted: input.granted }; },
    getStudentCareerProfile: async (_actor: unknown, studentId: string) => ({ studentId, snapshot: {}, results: null }),
    listCareerAgents: async () => ({ agents: [{ type: 'ACADEMIC_ANALYST', name: 'Phân tích học tập' }] }),
    analyzeCareer: async (_actor: unknown, input: { agentTypes?: string[] }, key: string) => { calls.push(`analyze:${key}`); return { isFallback: true, findings: [], report: 'Chưa cấu hình API key', agentTypes: input.agentTypes }; },
  };
}

function buildTestApp(currentUser: typeof student | typeof teacher = student) {
  const calls: string[] = [];
  const app = buildApp({ authRepository: { getSession: async () => currentUser } as never, platformRepository: buildStub(calls) as never });
  return { app, calls };
}

describe('career assessment API surface', () => {
  it('serves aptitude questions without answers and records an assessment', async () => {
    const { app, calls } = buildTestApp(student);
    const questions = await app.inject({ method: 'GET', url: '/api/v1/career/aptitude/questions', headers: { cookie: 'smartpath_session=test' } });
    expect(questions.statusCode).toBe(200);
    expect(JSON.stringify(questions.json())).not.toContain('correctIndex');
    const saved = await app.inject({ method: 'POST', url: '/api/v1/career/assessments/aptitude', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'aptitude-1' }, payload: { answers: { 'numerical-1': 1 } } });
    expect(saved.statusCode).toBe(201);
    expect(calls).toContain('aptitude:aptitude-1');
    await app.close();
  });

  it('returns recommendations with a mandatory advisory disclaimer', async () => {
    const { app } = buildTestApp(student);
    const response = await app.inject({ method: 'GET', url: '/api/v1/career/recommendations', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.disclaimer).toContain('tham khảo');
    await app.close();
  });

  it('persists and restores the aptitude draft without requiring submission', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: {
        getAptitudeDraft: async () => ({ version: '2026.1', answers: { E1: 1 }, skippedIds: ['E2'], currentIndex: 2 }),
        saveAptitudeDraft: async (_actor: unknown, input: unknown) => input,
      } as never,
    });
    const get = await app.inject({ method: 'GET', url: '/api/v1/career/assessments/aptitude/draft', headers: { cookie: 'smartpath_session=test' } });
    expect(get.statusCode).toBe(200);
    expect(get.json().data.currentIndex).toBe(2);
    const save = await app.inject({ method: 'PATCH', url: '/api/v1/career/assessments/aptitude/draft', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'aptitude-draft-1' }, payload: { version: '2026.1', answers: { E1: 1 }, skippedIds: ['E2'], currentIndex: 2 } });
    expect(save.statusCode).toBe(200);
    expect(save.json().data.version).toBe('2026.1');
    await app.close();
  });

  it('serves the canonical subject combinations for profile selection', async () => {
    const { app } = buildTestApp(student);
    const response = await app.inject({ method: 'GET', url: '/api/v1/career/exam-blocks', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.blocks[0]).toMatchObject({ code: 'A02', subjects: ['TOAN', 'LY', 'SINH'] });
    await app.close();
  });

  it('lets a student set a share grant and blocks a teacher from that student route', async () => {
    const { app, calls } = buildTestApp(student);
    const granted = await app.inject({ method: 'POST', url: '/api/v1/career/share-grants', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'share-grant-1' }, payload: { scope: 'PROFILE', granted: true } });
    expect(granted.statusCode).toBe(201);
    expect(calls).toContain('share:share-grant-1');
    const revoked = await app.inject({ method: 'POST', url: '/api/v1/career/share-grants', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'share-grant-2' }, payload: { scope: 'PROFILE', granted: false } });
    expect(revoked.statusCode).toBe(201);
    await app.close();

    const teacherApp = buildTestApp(teacher).app;
    const teacherShare = await teacherApp.inject({ method: 'POST', url: '/api/v1/career/share-grants', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'share-grant-3' }, payload: { scope: 'PROFILE', granted: true } });
    expect(teacherShare.statusCode).toBe(403);
    await teacherApp.close();
  });

  it('lists ten career agents and rejects unknown agent types', async () => {
    const { app } = buildTestApp(student);
    const agents = await app.inject({ method: 'GET', url: '/api/v1/career/ai/agents', headers: { cookie: 'smartpath_session=test' } });
    expect(agents.statusCode).toBe(200);
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/career/ai/analyze',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'analyze-bad' },
      payload: { agentTypes: ['WIZARD_BOT'] },
    });
    expect(unknown.statusCode).toBe(422);
    await app.close();
  });

  it('blocks a subject teacher from the student career-profile route via repository forbidden', async () => {
    const { forbidden } = await import('../../src/errors.js');
    const app = buildApp({
      authRepository: { getSession: async () => teacher } as never,
      platformRepository: {
        getStudentCareerProfile: async () => { throw forbidden('Chỉ giáo viên chủ nhiệm của lớp mới xem được hồ sơ này.'); },
      } as never,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/students/11111111-1111-4111-8111-111111111111/career-profile', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
