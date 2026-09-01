import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };
const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };

function buildStub(calls: string[]) {
  return {
    computeAdmissionProbability: async (_actor: unknown, input: { institutionMajorId: string }) => ({ category: 'CONSIDER', probability: 0.62, predictedCutoff: 25.4, examBlock: 'A00', applicantScore: 26, yearsOfData: 3, disclaimer: 'tham khảo', institutionMajorId: input.institutionMajorId }),
    getMatchedScholarships: async () => ({ disclaimer: 'tham khảo', matches: [{ id: 's1', title: 'Học bổng STEM', matchScore: 0.9, reasons: [] }] }),
    listAspirations: async () => [{ id: 'a1', institutionMajorId: 'im1', priority: 1, note: '' }],
    addAspiration: async (_actor: unknown, _input: unknown, key: string) => { calls.push(`aspiration:${key}`); return { id: 'a1', priority: 1 }; },
    reorderAspirations: async (_actor: unknown, input: { orderedIds: string[] }, key: string) => { calls.push(`reorder:${key}`); return { orderedIds: input.orderedIds }; },
    deleteAspiration: async (_actor: unknown, id: string, key: string) => { calls.push(`delete:${key}`); return { id, deleted: true }; },
    listSavedItems: async () => [],
    addSavedItem: async (_actor: unknown, _input: unknown, key: string) => { calls.push(`saved:${key}`); return { id: 'sv1' }; },
    listGoals: async () => [],
    addGoal: async (_actor: unknown, _input: unknown, key: string) => { calls.push(`goal:${key}`); return { id: 'g1' }; },
    listReminders: async () => [],
    addReminder: async (_actor: unknown, _input: unknown, key: string) => { calls.push(`reminder:${key}`); return { id: 'r1' }; },
  };
}

function buildTestApp(currentUser: typeof student | typeof teacher = student) {
  const calls: string[] = [];
  const app = buildApp({ authRepository: { getSession: async () => currentUser } as never, platformRepository: buildStub(calls) as never });
  return { app, calls };
}

describe('aspiration and admission API surface', () => {
  it('returns an admission probability with a disclaimer for a student', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'POST', url: '/api/v1/career/admission-probability', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'prob-key-1' }, payload: { institutionMajorId: '11111111-1111-4111-8111-111111111111' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ category: 'CONSIDER', disclaimer: 'tham khảo' });
    await app.close();
  });

  it('manages aspirations with idempotency and reorder', async () => {
    const { app, calls } = buildTestApp();
    const added = await app.inject({ method: 'POST', url: '/api/v1/aspirations', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'aspiration-add-1' }, payload: { institutionMajorId: '11111111-1111-4111-8111-111111111111' } });
    expect(added.statusCode).toBe(201);
    const reordered = await app.inject({ method: 'POST', url: '/api/v1/aspirations/reorder', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'aspiration-reorder-1' }, payload: { orderedIds: ['11111111-1111-4111-8111-111111111111'] } });
    expect(reordered.statusCode).toBe(200);
    expect(calls).toContain('aspiration:aspiration-add-1');
    expect(calls).toContain('reorder:aspiration-reorder-1');
    await app.close();
  });

  it('blocks a teacher from the student-only aspiration routes', async () => {
    const teacherApp = buildTestApp(teacher).app;
    const response = await teacherApp.inject({ method: 'GET', url: '/api/v1/aspirations', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(403);
    await teacherApp.close();
  });
});
