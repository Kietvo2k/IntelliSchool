import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };

function buildStub(calls: string[]) {
  return {
    createSkillGraph: async (_actor: unknown, input: { subjectId: string; title: string }, key: string) => { calls.push(`create:${key}`); return { id: 'graph-1', ...input, status: 'DRAFT', version: 1, skillCount: 3 }; },
    updateSkillGraph: async (_actor: unknown, graphId: string, input: { title: string }, key: string) => { calls.push(`update:${key}`); return { id: graphId, title: input.title, status: 'DRAFT', skillCount: 3 }; },
    submitSkillGraphForReview: async (_actor: unknown, graphId: string, key: string) => { calls.push(`submit:${key}`); return { id: graphId, status: 'PENDING_REVIEW' }; },
    reviewSkillGraph: async (_actor: unknown, graphId: string, input: { decision: string }, key: string) => { calls.push(`review:${key}`); return { id: graphId, status: input.decision }; },
    mapSkillItems: async (_actor: unknown, graphId: string, input: { questionVersionId: string }, key: string) => { calls.push(`map:${key}`); return { graphId, questionVersionId: input.questionVersionId, skills: [] }; },
    listSkillGraphs: async () => [{ id: 'graph-1', subjectId: 'subject-1', title: 'Phân số', version: 1, status: 'APPROVED', skillCount: 3, updatedAt: new Date(0).toISOString(), createdAt: new Date(0).toISOString() }],
    getSkillGraph: async (_actor: unknown, graphId: string) => ({ id: graphId, subjectId: 'subject-1', title: 'Phân số', version: 1, status: 'DRAFT', skillCount: 1, updatedAt: new Date(0).toISOString(), createdAt: new Date(0).toISOString(), definition: { skills: [{ code: 'A', name: 'A' }], edges: [] }, mappings: [] }),
  };
}

function buildTestApp(currentUser = teacher) {
  const calls: string[] = [];
  const app = buildApp({
    authRepository: { getSession: async () => currentUser } as never,
    platformRepository: buildStub(calls) as never,
  });
  return { app, calls };
}

describe('skill graph API surface', () => {
  it('lets a teacher create, submit, and map a draft skill graph with idempotency keys', async () => {
    const { app, calls } = buildTestApp();
    const created = await app.inject({
      method: 'POST', url: '/api/v1/skill-graphs',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'skill-graph-create-1' },
      payload: { subjectId: '22222222-2222-4222-8222-222222222222', title: 'Phân số đến tỉ lệ', definition: { skills: [{ code: 'A', name: 'Kỹ năng A' }], edges: [] } },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ id: 'graph-1', status: 'DRAFT' });

    const graphId = '11111111-1111-4111-8111-111111111111';
    const submitted = await app.inject({ method: 'POST', url: `/api/v1/skill-graphs/${graphId}/submit`, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'skill-graph-submit-1' } });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().data.status).toBe('PENDING_REVIEW');
    expect(calls).toEqual(['create:skill-graph-create-1', 'submit:skill-graph-submit-1']);
    await app.close();
  });

  it('requires an idempotency key and rejects an invalid definition', async () => {
    const { app } = buildTestApp();
    const missingKey = await app.inject({ method: 'POST', url: '/api/v1/skill-graphs', headers: { cookie: 'smartpath_session=test' }, payload: { subjectId: '22222222-2222-4222-8222-222222222222', title: 'Phân số', definition: { skills: [], edges: [] } } });
    expect(missingKey.statusCode).toBe(400);

    const invalid = await app.inject({ method: 'POST', url: '/api/v1/skill-graphs', headers: { cookie: 'smartpath_session=test', 'x-idempotency-key': 'skill-graph-invalid-1' }, payload: { subjectId: '22222222-2222-4222-8222-222222222222', title: 'Phân số', definition: { skills: [], edges: [] } } });
    expect(invalid.statusCode).toBe(422);
    await app.close();
  });

  it('does not allow a student to reach skill graph authoring', async () => {
    const { app } = buildTestApp(student);
    const listed = await app.inject({ method: 'GET', url: '/api/v1/skill-graphs', headers: { cookie: 'smartpath_session=test' } });
    expect(listed.statusCode).toBe(403);
    await app.close();
  });
});
