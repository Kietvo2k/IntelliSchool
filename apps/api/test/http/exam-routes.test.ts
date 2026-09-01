import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { conflict } from '../../src/errors.js';

const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };
const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };

describe('exam sitting API surface', () => {
  it('lists open school mock exams for a student', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: { listOpenExams: async () => ({ studentCode: 'SPHS-2026-000001', displayName: 'Minh An', councilName: 'THPT Nguyễn Du', brand: 'Smart Path · thi thử của trường', exams: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Thi thử Toán', subjectName: 'Toán học', durationMinutes: 45, sessionId: null, submitted: false }] }) } as never,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/exams/open', headers: { cookie: 'smartpath_session=test' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.brand).toContain('thi thử của trường');
    expect(JSON.stringify(response.json())).not.toContain('Cục QLCL');
    await app.close();
  });

  it('requires an idempotency key and returns server-authoritative incident state', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: { logExamIntegrity: async () => ({ recorded: true, state: 'GRACE', incidentId: '44444444-4444-4444-8444-444444444444', remainingMs: 4_999, locked: false }) } as never,
    });
    const missing = await app.inject({ method: 'POST', url: '/api/v1/exams/integrity', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176' }, payload: { sessionId: '22222222-2222-4222-8222-222222222222', kind: 'visibilitychange' } });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    const response = await app.inject({ method: 'POST', url: '/api/v1/exams/integrity', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'integrity-signal-1' }, payload: { sessionId: '22222222-2222-4222-8222-222222222222', kind: 'visibilitychange' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.state).toBe('GRACE');
    await app.close();
  });

  it('rejects client-side integrity events outside the supported set', async () => {
    const app = buildApp({ authRepository: { getSession: async () => student } as never, platformRepository: { logExamIntegrity: async () => ({ recorded: true }) } as never });
    const response = await app.inject({ method: 'POST', url: '/api/v1/exams/integrity', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'integrity-invalid-1' }, payload: { sessionId: '22222222-2222-4222-8222-222222222222', kind: 'network_error' } });
    expect(response.statusCode).toBe(422);
    await app.close();
  });

  it('accepts a network signal but leaves exemption classification to the server', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: { logExamIntegrity: async (_actor: unknown, input: { kind: string }, key: string) => ({ recorded: true, kind: input.kind, counted: false, reason: 'NETWORK', idempotencyKey: key }) } as never,
    });
    const response = await app.inject({ method: 'POST', url: '/api/v1/exams/integrity', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'integrity-network-1' }, payload: { sessionId: '22222222-2222-4222-8222-222222222222', kind: 'network_loss', payload: { retryable: true } } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.reason).toBe('NETWORK');
    await app.close();
  });

  it('issues a short-lived attachment exemption from the server with idempotency', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: { issueExamAttachmentExemption: async (_actor: unknown, sessionId: string, key: string) => ({ sessionId, token: 'a'.repeat(43), expiresAt: new Date(Date.now() + 60_000).toISOString(), idempotencyKey: key }) } as never,
    });
    const response = await app.inject({ method: 'POST', url: '/api/v1/exams/sessions/22222222-2222-4222-8222-222222222222/attachment-exemption', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'attachment-exemption-1' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.expiresAt).toBeTruthy();
    await app.close();
  });

  it('closes/restores an incident and unlocks only through authorized routes', async () => {
    const platformRepository = {
      restoreExamIncident: async (_actor: unknown, sessionId: string, incidentId: string) => ({ sessionId, incidentId, state: 'ACTIVE' }),
      closeExamIncident: async (_actor: unknown, sessionId: string, input: { incidentId: string; reason: string }) => ({ sessionId, incidentId: input.incidentId, state: 'ACTIVE', reason: input.reason }),
      unlockExamSession: async (_actor: unknown, sessionId: string, reason: string) => ({ sessionId, state: 'ACTIVE', reason }),
    } as never;
    const studentApp = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository,
    });
    const app = buildApp({
      authRepository: { getSession: async () => teacher } as never,
      platformRepository,
    });
    const restore = await studentApp.inject({ method: 'POST', url: '/api/v1/exams/sessions/22222222-2222-4222-8222-222222222222/integrity/restore', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'incident-restore-1' }, payload: { incidentId: '44444444-4444-4444-8444-444444444444' } });
    expect(restore.statusCode).toBe(200);
    const close = await app.inject({ method: 'POST', url: '/api/v1/exams/sessions/22222222-2222-4222-8222-222222222222/integrity/close', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'incident-close-1' }, payload: { incidentId: '44444444-4444-4444-8444-444444444444', reason: 'Đã xác minh học sinh trở lại phòng thi.' } });
    expect(close.statusCode).toBe(200);
    const unlock = await app.inject({ method: 'POST', url: '/api/v1/exams/sessions/22222222-2222-4222-8222-222222222222/unlock', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'exam-unlock-1' }, payload: { reason: 'Giám thị xác minh sự cố hợp lệ.' } });
    expect(unlock.statusCode).toBe(200);
    expect(unlock.json().data.state).toBe('ACTIVE');
    await studentApp.close();
    await app.close();
  });

  it('rejects saving answers when the session is locked', async () => {
    const app = buildApp({ authRepository: { getSession: async () => student } as never, platformRepository: { saveExamAnswers: async () => { throw conflict('EXAM_LOCKED', 'Ca thi đã khóa.'); } } as never });
    const response = await app.inject({ method: 'PATCH', url: '/api/v1/exams/sessions/22222222-2222-4222-8222-222222222222/answers', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'save-locked' }, payload: { sessionId: '22222222-2222-4222-8222-222222222222', answers: [{ assignmentItemId: '33333333-3333-4333-8333-333333333333', answer: { choice: 'A' } }] } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('EXAM_LOCKED');
    await app.close();
  });
});
