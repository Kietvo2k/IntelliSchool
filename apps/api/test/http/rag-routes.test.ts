import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const owner = { userId: 'owner-1', role: 'SCHOOL_OWNER' as const, schoolId: 'school-a', email: 'owner@example.test', displayName: 'Cô Lan' };
const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };

function buildStub(calls: string[]) {
  return {
    listRagDocuments: async () => [{ id: 'doc-1', title: 'Bài quang hợp', sourceKind: 'LESSON', status: 'READY', classId: null, subjectId: null, chunkCount: 3, updatedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }],
    ingestRagContent: async (_actor: unknown, input: { title: string }, key: string) => { calls.push(`ingest:${key}`); return { id: 'doc-1', chunkCount: 3, status: 'READY', title: input.title }; },
    deleteRagDocument: async (_actor: unknown, documentId: string, key: string) => { calls.push(`delete:${documentId}:${key}`); return { id: documentId, deleted: true }; },
    searchRag: async (_actor: unknown, input: { query: string }) => ({ query: input.query, citations: [{ documentId: 'doc-1', documentTitle: 'Bài quang hợp', chunkId: 'c1', ordinal: 0, score: 0.42, snippet: 'Quang hợp...' }] }),
    listAiSessions: async () => [{ id: 's1', purpose: 'ASSISTANT', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 2, lastAt: '2026-01-01T00:00:00.000Z' }],
    getAiSessionMessages: async () => [{ id: 'm1', role: 'USER', content: 'hi', citations: [], createdAt: '2026-01-01T00:00:00.000Z' }],
    chatWithAi: async (_actor: unknown, input: { message: string; reasoningMode?: string; agentic?: boolean; sourceMode?: string }, key: string) => { calls.push(`chat:${key}`); return { sessionId: 's1', mode: 'GROUNDED', usedModel: null, reasoningMode: input.reasoningMode, agentic: input.agentic, sourceMode: input.sourceMode, message: { id: 'm2', role: 'ASSISTANT', content: `echo:${input.message}`, citations: [], createdAt: '2026-01-01T00:00:00.000Z' } }; },
    createAiJob: async (_actor: unknown, input: { message: string }, key: string) => { calls.push(`job:${key}`); return { jobId: '44444444-4444-4444-8444-444444444444', status: 'QUEUED', stage: 'QUEUED', progress: 0, input: input.message }; },
    getAiJob: async () => ({ jobId: '44444444-4444-4444-8444-444444444444', status: 'COMPLETED', stage: 'COMPLETED', progress: 100, result: { message: { content: 'x' } } }),
    cancelAiJob: async (_actor: unknown, jobId: string, _key: string) => ({ jobId, status: 'CANCELLED', stage: 'CANCELLED', progress: 100, requestId: 'request-1' }),
  };
}

function buildTestApp(currentUser: typeof owner | typeof teacher | typeof student = owner) {
  const calls: string[] = [];
  const app = buildApp({ authRepository: { getSession: async () => currentUser } as never, platformRepository: buildStub(calls) as never });
  return { app, calls };
}

describe('RAG + AI chat API surface', () => {
  it('lets a teacher ingest a document and list documents', async () => {
    const { app, calls } = buildTestApp(teacher);
    const created = await app.inject({ method: 'POST', url: '/api/v1/ai/rag/documents', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'rag-ingest-1' }, payload: { sourceKind: 'TEXT', title: 'Bài quang hợp', text: 'Quang hợp là quá trình cây xanh tạo chất hữu cơ từ ánh sáng.' } });
    expect(created.statusCode).toBe(201);
    expect(calls).toContain('ingest:rag-ingest-1');
    const list = await app.inject({ method: 'GET', url: '/api/v1/ai/rag/documents', headers: { cookie: 'smartpath_session=test' } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data).toHaveLength(1);
    await app.close();
  });

  it('blocks students from ingesting but allows search and chat', async () => {
    const { app } = buildTestApp(student);
    const denied = await app.inject({ method: 'POST', url: '/api/v1/ai/rag/documents', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'rag-ingest-2' }, payload: { sourceKind: 'TEXT', title: 'X', text: 'y'.repeat(30) } });
    expect(denied.statusCode).toBe(403);

    const search = await app.inject({ method: 'POST', url: '/api/v1/ai/rag/search', headers: { cookie: 'smartpath_session=test' }, payload: { query: 'quang hợp là gì' } });
    expect(search.statusCode).toBe(200);
    expect(search.json().data.citations).toHaveLength(1);

    const chat = await app.inject({ method: 'POST', url: '/api/v1/ai/chat', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'chat-key-1' }, payload: { message: 'Giải thích quang hợp' } });
    expect(chat.statusCode).toBe(201);
    expect(chat.json().data.message.content).toContain('echo:');
    await app.close();
  });

  it('lets an owner delete a document', async () => {
    const { app, calls } = buildTestApp(owner);
    const deleted = await app.inject({ method: 'DELETE', url: '/api/v1/ai/rag/documents/doc-1', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'rag-del-1' } });
    expect(deleted.statusCode).toBe(200);
    expect(calls).toContain('delete:doc-1:rag-del-1');
    await app.close();
  });

  it('passes explicit reasoning, agentic and source modes through the API contract', async () => {
    const { app } = buildTestApp(student);
    const response = await app.inject({ method: 'POST', url: '/api/v1/ai/chat', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'chat-mode-1' }, payload: { message: 'Giải thích bằng tài liệu của em', reasoningMode: 'THINKING', agentic: true, sourceMode: 'MY_UPLOADS' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ reasoningMode: 'THINKING', agentic: true, sourceMode: 'MY_UPLOADS' });
    await app.close();
  });

  it('queues a Thinking turn and exposes its durable status endpoint', async () => {
    const { app, calls } = buildTestApp(student);
    const queued = await app.inject({ method: 'POST', url: '/api/v1/ai/jobs', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'ai-job-1' }, payload: { message: 'Phân tích sâu', reasoningMode: 'THINKING' } });
    expect(queued.statusCode).toBe(202);
    expect(queued.json().data).toMatchObject({ status: 'QUEUED', progress: 0 });
    expect(calls).toContain('job:ai-job-1');
    const status = await app.inject({ method: 'GET', url: '/api/v1/ai/jobs/44444444-4444-4444-8444-444444444444', headers: { cookie: 'smartpath_session=test' } });
    expect(status.statusCode).toBe(200);
    expect(status.json().data).toMatchObject({ status: 'COMPLETED', progress: 100 });
    await app.close();
  });

  it('cancels a Thinking job through a server-authoritative endpoint', async () => {
    const { app } = buildTestApp(student);
    const response = await app.inject({ method: 'POST', url: '/api/v1/ai/jobs/44444444-4444-4444-8444-444444444444/cancel', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'ai-job-cancel-1' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ status: 'CANCELLED', progress: 100, requestId: 'request-1' });
    await app.close();
  });
});
