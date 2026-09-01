import { describe, expect, it } from 'vitest';
import { validateResourceUpload } from '../src/services/resource-validation.js';

describe('validateResourceUpload', () => {
  it('accepts a real PDF and returns a SHA-256 checksum', async () => {
    const result = await validateResourceUpload({
      filename: 'tai-lieu-on-tap.pdf',
      declaredMimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.7\nTài liệu SmartPath'),
    });

    expect(result).toMatchObject({
      originalName: 'tai-lieu-on-tap.pdf',
      mimeType: 'application/pdf',
      byteSize: expect.any(Number),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('rejects an executable disguised as a PDF', async () => {
    await expect(validateResourceUpload({
      filename: 'tai-lieu.pdf',
      declaredMimeType: 'application/pdf',
      bytes: Buffer.from('MZ\x90\x00not a document'),
    })).rejects.toMatchObject({ code: 'RESOURCE_TYPE_REJECTED' });
  });

  it('rejects a file above the 50 MB hard limit before storage', async () => {
    await expect(validateResourceUpload({
      filename: 'video.mp4',
      declaredMimeType: 'video/mp4',
      bytes: Buffer.alloc(50 * 1024 * 1024 + 1),
    })).rejects.toMatchObject({ code: 'RESOURCE_TOO_LARGE' });
  });
});
