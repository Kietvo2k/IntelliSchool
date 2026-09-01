import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { forbidden } from '../../src/errors.js';

const student = { userId: '11111111-1111-4111-8111-111111111111', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };
const teacher = { userId: '22222222-2222-4222-8222-222222222222', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const owner = { userId: '33333333-3333-4333-8333-333333333333', role: 'SCHOOL_OWNER' as const, schoolId: 'school-a', email: 'owner@example.test', displayName: 'Cô Lan' };

describe('skill suggestion four-eyes API surface', () => {
  it('lets a student create a draft from the learner profile', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => student } as never,
      platformRepository: {
        createSkillSuggestion: async () => ({ items: [{ id: 's1', skillCode: 'REMEDIATE_TOAN', status: 'DRAFT' }], fourEyes: 'Cần giáo viên khác duyệt trước khi đưa vào đồ thị.' }),
        listSkillSuggestions: async () => [{ id: 's1', skillCode: 'REMEDIATE_TOAN', status: 'DRAFT' }],
      } as never,
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/skill-suggestions',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'skill-draft-1' },
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.items[0].status).toBe('DRAFT');
    await app.close();
  });

  it('blocks the author from self-approving', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => teacher } as never,
      platformRepository: {
        reviewSkillSuggestion: async () => { throw forbidden('Duyệt bốn mắt: người tạo nháp không được tự duyệt.'); },
      } as never,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/skill-suggestions/44444444-4444-4444-8444-444444444444/review',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'skill-review-1' },
      payload: { decision: 'APPROVED' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('lets a school owner review a draft', async () => {
    const app = buildApp({
      authRepository: { getSession: async () => owner } as never,
      platformRepository: {
        reviewSkillSuggestion: async () => ({ id: '44444444-4444-4444-8444-444444444444', status: 'APPROVED' }),
      } as never,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/skill-suggestions/44444444-4444-4444-8444-444444444444/review',
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'skill-review-2' },
      payload: { decision: 'APPROVED', reason: 'Đã đối chiếu sổ điểm.' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('APPROVED');
    await app.close();
  });
});
