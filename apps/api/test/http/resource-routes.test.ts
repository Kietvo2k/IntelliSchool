import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';

const teacher = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-a', email: 'teacher@example.test', displayName: 'Cô An' };
const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId: 'school-a', email: 'student@example.test', displayName: 'Minh An' };

function multipartPdf() {
  const boundary = '----smartpath-test-boundary';
  const body = Buffer.from([
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="on-tap.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
    '%PDF-1.7\nTài liệu ôn tập',
    `\r\n--${boundary}--\r\n`,
  ].join(''));
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('resource upload route', () => {
  it('lists only the resources that the authenticated account is allowed to see', async () => {
    const list = vi.fn(async () => ({ items: [{ id: 'resource-1', originalName: 'on-tap.pdf', status: 'READY' }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }));
    const app = buildApp({
      authRepository: { getSession: async () => teacher } as never,
      resourceRepository: { list } as never,
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/resources?page=1&pageSize=20', headers: { cookie: 'smartpath_session=test' } });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ items: [{ id: 'resource-1', status: 'READY' }], totalItems: 1 });
    expect(list).toHaveBeenCalledWith(teacher, { page: 1, pageSize: 20 });
    await app.close();
  });

  it('requires an authenticated teaching role, Origin, and idempotency key before handing an upload to the service', async () => {
    const upload = vi.fn(async () => ({ id: 'resource-1', originalName: 'on-tap.pdf', status: 'QUARANTINED' }));
    const app = buildApp({
      authRepository: { getSession: async () => teacher } as never,
      resourceUploadService: { upload } as never,
    });
    const file = multipartPdf();
    const response = await app.inject({
      method: 'POST', url: '/api/v1/resources', payload: file.body,
      headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'resource-upload-20260725-001', 'content-type': file.contentType },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ id: 'resource-1', status: 'QUARANTINED' });
    expect(upload).toHaveBeenCalledWith(teacher, expect.objectContaining({ filename: 'on-tap.pdf', declaredMimeType: 'application/pdf' }), expect.objectContaining({ idempotencyKey: 'resource-upload-20260725-001' }));
    expect(JSON.stringify(upload.mock.calls[0])).not.toContain('objectKey');
    await app.close();
  });

  it('asks the authenticated download service for a short-lived URL rather than exposing an object key', async () => {
    const download = vi.fn(async () => ({ url: 'http://minio.test/private-signed-url', expiresAt: '2026-07-25T01:00:00.000Z' }));
    const app = buildApp({ authRepository: { getSession: async () => teacher } as never, resourceDownloadService: { getDownload: download } as never });
    const response = await app.inject({ method: 'GET', url: '/api/v1/resources/11111111-1111-4111-8111-111111111111/download', headers: { cookie: 'smartpath_session=test' } });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ url: 'http://minio.test/private-signed-url' });
    expect(JSON.stringify(response.json())).not.toContain('objectKey');
    expect(download).toHaveBeenCalledWith(teacher, '11111111-1111-4111-8111-111111111111');
    await app.close();
  });

  it('lets a student upload a private AI study document without publishing it to the class', async () => {
    const upload = vi.fn(async () => ({ id: 'resource-private-1', originalName: 'ghi-chu.pdf', status: 'QUARANTINED', visibility: 'PRIVATE' }));
    const app = buildApp({ authRepository: { getSession: async () => student } as never, resourceUploadService: { upload } as never });
    const file = multipartPdf();
    const response = await app.inject({ method: 'POST', url: '/api/v1/library/uploads', payload: file.body, headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'library-upload-1', 'content-type': file.contentType } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ id: 'resource-private-1', visibility: 'PRIVATE' });
    expect(upload).toHaveBeenCalledWith(student, expect.objectContaining({ filename: 'on-tap.pdf' }), expect.objectContaining({ visibility: 'PRIVATE', ownerUserId: student.userId }));
    await app.close();
  });

  it('lets a student submit a private document for school-library review', async () => {
    const requestContribution = vi.fn(async () => ({ id: 'resource-private-1', contributionStatus: 'PENDING' }));
    const app = buildApp({ authRepository: { getSession: async () => student } as never, resourceRepository: { requestContribution } as never });
    const response = await app.inject({ method: 'POST', url: '/api/v1/resources/11111111-1111-4111-8111-111111111111/contribution', headers: { cookie: 'smartpath_session=test', origin: 'http://127.0.0.1:5176', 'x-idempotency-key': 'contribution-1' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.contributionStatus).toBe('PENDING');
    expect(requestContribution).toHaveBeenCalledWith(student, '11111111-1111-4111-8111-111111111111', 'contribution-1');
    await app.close();
  });
});
