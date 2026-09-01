import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';

const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };

function multipartImport(commit = false) {
  const boundary = '----smartpath-question-import';
  const csv = 'type,prompt,choice_a,choice_b,correct_answer,max_score\nMULTIPLE_CHOICE,Đạo hàm của x²?,x,2x,2x,1';
  const body = Buffer.from([
    `--${boundary}\r\nContent-Disposition: form-data; name="bankId"\r\n\r\n11111111-1111-4111-8111-111111111111\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="commit"\r\n\r\n${commit ? 'true' : 'false'}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="questions.csv"\r\nContent-Type: text/csv\r\n\r\n`,
    csv,
    `\r\n--${boundary}--\r\n`,
  ].join(''));
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('question import routes', () => {
  it('returns the UTF-8 CSV template to an authenticated teaching role', async () => {
    const app = buildApp({ authRepository: { getSession: async () => teacher } as never });
    const response = await app.inject({ method: 'GET', url: '/api/v1/question-imports/template', headers: { cookie: 'smartpath_session=test' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toContain('type,prompt,choice_a');
    await app.close();
  });

  it('previews a valid CSV without exposing answer keys or writing questions', async () => {
    const importQuestions = vi.fn();
    const app = buildApp({ authRepository: { getSession: async () => teacher } as never, platformRepository: { importQuestions } as never });
    const file = multipartImport();
    const response = await app.inject({ method: 'POST', url: '/api/v1/question-imports', payload: file.body, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'content-type': file.contentType } });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ canCommit: true, rows: [{ row: 2, type: 'MULTIPLE_CHOICE', prompt: 'Đạo hàm của x²?' }] });
    expect(JSON.stringify(response.json())).not.toContain('answerKey');
    expect(importQuestions).not.toHaveBeenCalled();
    await app.close();
  });

  it('commits only a clean preview with an idempotency key', async () => {
    const importQuestions = vi.fn(async () => ({ importedCount: 1, questionIds: ['question-1'] }));
    const app = buildApp({ authRepository: { getSession: async () => teacher } as never, platformRepository: { importQuestions } as never });
    const file = multipartImport(true);
    const response = await app.inject({ method: 'POST', url: '/api/v1/question-imports', payload: file.body, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'question-import-20260725-001', 'content-type': file.contentType } });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.imported).toMatchObject({ importedCount: 1 });
    expect(importQuestions).toHaveBeenCalledWith(teacher, '11111111-1111-4111-8111-111111111111', expect.any(Array), 'question-import-20260725-001');
    await app.close();
  });
});
