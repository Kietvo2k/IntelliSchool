import { describe, expect, it, vi } from 'vitest';
import { ResourceUploadService } from '../src/services/resource-upload-service.js';

const actor = { userId: 'teacher-1', role: 'TEACHER' as const, schoolId: 'school-1', email: 'teacher@example.test', displayName: 'Cô An' };

function dependencies() {
  const storage = { putQuarantine: vi.fn(async () => undefined), deleteQuarantine: vi.fn(async () => undefined) };
  const repository = { createQuarantined: vi.fn(async (_actor, input) => ({ id: 'resource-1', ...input, status: 'QUARANTINED', createdAt: '2026-07-25T00:00:00.000Z' })) };
  return { storage, repository };
}

describe('ResourceUploadService', () => {
  it('writes a validated resource to quarantine under a server-generated object key', async () => {
    const deps = dependencies();
    const service = new ResourceUploadService(deps);

    const resource = await service.upload(actor, {
      filename: 'tai-lieu.pdf', declaredMimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.7\nNội dung'),
    });

    expect(resource).toMatchObject({ id: 'resource-1', originalName: 'tai-lieu.pdf', status: 'QUARANTINED' });
    expect(deps.storage.putQuarantine).toHaveBeenCalledWith(expect.stringMatching(/^quarantine\/[0-9a-f-]{36}$/), expect.any(Buffer), 'application/pdf');
    expect(deps.repository.createQuarantined).toHaveBeenCalledWith(actor, expect.objectContaining({ objectKey: expect.stringMatching(/^quarantine\//), sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });

  it('removes an uploaded quarantine object when its database transaction is rejected', async () => {
    const deps = dependencies();
    deps.repository.createQuarantined.mockRejectedValueOnce(new Error('database unavailable'));
    const service = new ResourceUploadService(deps);

    await expect(service.upload(actor, { filename: 'tai-lieu.pdf', declaredMimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.7\nNội dung') })).rejects.toThrow('database unavailable');
    expect(deps.storage.deleteQuarantine).toHaveBeenCalledWith(expect.stringMatching(/^quarantine\//));
  });

  it('reuses the same quarantine object key for a retry with the same idempotency key', async () => {
    const deps = dependencies();
    const service = new ResourceUploadService(deps);
    const options = { idempotencyKey: 'resource-upload-20260901-001', classId: 'class-1', subjectId: 'subject-1' };
    const candidate = { filename: 'tai-lieu.pdf', declaredMimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.7\nNội dung') };

    await service.upload(actor, candidate, options);
    await service.upload(actor, candidate, options);

    const firstKey = deps.storage.putQuarantine.mock.calls[0]?.[0];
    const secondKey = deps.storage.putQuarantine.mock.calls[1]?.[0];
    expect(firstKey).toBe(secondKey);
  });
});
