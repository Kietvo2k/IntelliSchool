import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalResourceStorage } from '../src/services/local-resource-storage.js';

describe('LocalResourceStorage', () => {
  it('stores, signs, and streams a ready object without path traversal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'smartpath-files-'));
    try {
      const storage = new LocalResourceStorage({
        rootDir: root,
        publicBaseUrl: 'http://127.0.0.1:8080',
        signingSecret: 'test-signing-secret-32-chars-min!',
        quotaBytes: 10_000_000,
      });
      await storage.putPrivate('reports/a.csv', Buffer.from('name,score\nAn,9'), 'text/csv');
      const url = await storage.signedReadyDownload('reports/a.csv', 60);
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:8080\/api\/v1\/files\//);
      const token = url.split('/api/v1/files/')[1]!;
      const opened = await storage.openSigned(token);
      const chunks: Buffer[] = [];
      for await (const chunk of opened.stream) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).toString('utf8')).toContain('An,9');
      expect(opened.mimeType).toBe('text/csv');
      await expect(storage.putQuarantine('../escape', Buffer.from('x'), 'text/plain')).rejects.toMatchObject({ code: 'INVALID_OBJECT_KEY' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('promotes quarantine objects and enforces quota', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'smartpath-quota-'));
    try {
      const storage = new LocalResourceStorage({
        rootDir: root,
        publicBaseUrl: 'http://127.0.0.1:8080',
        signingSecret: 'test-signing-secret-32-chars-min!',
        quotaBytes: 40,
      });
      await storage.putQuarantine('quarantine/one', Buffer.from('hello-world'), 'text/plain');
      await storage.promote('quarantine/one', 'resources/one');
      await expect(readFile(path.join(root, 'quarantine', 'one'))).rejects.toBeTruthy();
      await expect(storage.putPrivate('reports/too-big.bin', Buffer.alloc(80), 'application/octet-stream')).rejects.toMatchObject({ code: 'STORAGE_QUOTA_EXCEEDED' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
