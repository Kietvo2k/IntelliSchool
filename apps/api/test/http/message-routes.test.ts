import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const student = { userId: '11111111-1111-4111-8111-111111111111', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };
const homeroom = { userId: '22222222-2222-4222-8222-222222222222', role: 'TEACHER' as const, schoolId: 'school-a', email: 'homeroom@example.test', displayName: 'Thầy Bảo', homeroomClassIds: ['33333333-3333-4333-8333-333333333333'] };

describe('homeroom messaging API surface', () => {
  it('lets a student read the homeroom channel and send a message', async () => {
    const calls: string[] = [];
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: {
        getHomeroomChannel: async () => ({ classId: '33333333-3333-4333-8333-333333333333', peerId: homeroom.userId, peerName: 'Thầy Bảo' }),
        listClassMessages: async () => [],
        sendClassMessage: async (_actor: unknown, input: { body: string }, key: string) => { calls.push(`msg:${key}`); return { id: 'msg-1', body: input.body }; },
      } as never,
    });
    const channel = await app.inject({ method: 'GET', url: '/api/v1/messages/channel', headers: { cookie: 'smartpath_session=test' } });
    expect(channel.statusCode).toBe(200);
    expect(channel.json().data.peerName).toContain('Bảo');
    const sent = await app.inject({
      method: 'POST',
      url: '/api/v1/messages',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'message-key-1' },
      payload: { classId: '33333333-3333-4333-8333-333333333333', recipientId: homeroom.userId, body: 'Thưa thầy, em xin phép hỏi lịch ôn.' },
    });
    expect(sent.statusCode).toBe(201);
    expect(calls).toContain('msg:message-key-1');
    await app.close();
  });
});
