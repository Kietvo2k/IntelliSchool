import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { conflict } from '../../src/errors.js';

const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };
const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };

describe('exam sitting API surface', () => {
  it('lists open school mock exams for a student', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: {
        listOpenExams: async () => ({ studentCode: 'SPHS-2026-000001', displayName: 'Minh An', councilName: 'THPT Nguyễn Du', brand: 'Smart Path · thi thử của trường', exams: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Thi thử Toán', subjectName: 'Toán học', durationMinutes: 45, sessionId: null, submitted: false }] }),
      } as never,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/exams/open', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.brand).toContain('thi thử của trường');
    expect(JSON.stringify(response.json())).not.toContain('Cục QLCL');
    await app.close();
  });

  it('records an integrity event without an idempotency key and can lock', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: {
        logExamIntegrity: async () => ({ recorded: true, strikeCount: 3, locked: true }),
      } as never,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exams/integrity',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176' },
      payload: { sessionId: '22222222-2222-4222-8222-222222222222', kind: 'visibilitychange' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.locked).toBe(true);
    await app.close();
  });

  it('rejects client-side integrity events outside the supported set', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: { logExamIntegrity: async () => ({ recorded: true }) } as never,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exams/integrity',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176' },
      payload: { sessionId: '22222222-2222-4222-8222-222222222222', kind: 'network_error' },
    });
    expect(response.statusCode).toBe(422);
    await app.close();
  });

  it('accepts a network signal but leaves strike classification to the server', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: {
        logExamIntegrity: async (_actor: unknown, input: { kind: string }) => ({ recorded: true, kind: input.kind, counted: false, reason: 'NETWORK' }),
      } as never,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exams/integrity',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176' },
      payload: { sessionId: '22222222-2222-4222-8222-222222222222', kind: 'network_loss', payload: { retryable: true } },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.reason).toBe('NETWORK');
    await app.close();
  });

  it('issues a short-lived attachment exemption from the server', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: {
        issueExamAttachmentExemption: async () => ({ sessionId: '22222222-2222-4222-8222-222222222222', token: 'a'.repeat(43), expiresAt: new Date(Date.now() + 60_000).toISOString() }),
      } as never,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exams/sessions/22222222-2222-4222-8222-222222222222/attachment-exemption',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.expiresAt).toBeTruthy();
    await app.close();
  });

  it('rejects saving answers when the session is locked', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: {
        saveExamAnswers: async () => { throw conflict('EXAM_LOCKED', 'Ca thi đã khóa sau 3 lần rời trang.'); },
      } as never,
    });
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/exams/sessions/22222222-2222-4222-8222-222222222222/answers',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'save-locked' },
      payload: { sessionId: '22222222-2222-4222-8222-222222222222', answers: [{ assignmentItemId: '33333333-3333-4333-8333-333333333333', answer: { choice: 'A' } }] },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('EXAM_LOCKED');
    await app.close();
  });

  it('lists proctored exams for a teacher', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => teacher } as never,
      platformRepository: {
        listProctoredExams: async () => [{ id: '11111111-1111-4111-8111-111111111111', title: 'Thi thử Toán', subjectName: 'Toán học', lockedCount: 1 }],
      } as never,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/exams/proctoring', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data[0].lockedCount).toBe(1);
    await app.close();
  });
});
