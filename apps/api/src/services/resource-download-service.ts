import type { AuthContext } from '../types.js';
import type { Readable } from 'node:stream';

export interface ResourceDownloadDependencies {
  repository: { getReadyObject(actor: AuthContext, resourceId: string): Promise<{ objectKey: string; originalName: string; mimeType: string }>; };
  storage: { signedReadyDownload(objectKey: string, expiresSeconds?: number): Promise<string>; };
}

export class ResourceDownloadService {
  constructor(private readonly dependencies: ResourceDownloadDependencies) {}

  async getDownload(actor: AuthContext, resourceId: string): Promise<{ url: string; expiresAt: string }> {
    const { objectKey } = await this.dependencies.repository.getReadyObject(actor, resourceId);
    const expiresSeconds = 300;
    const url = await this.dependencies.storage.signedReadyDownload(objectKey, expiresSeconds);
    return { url, expiresAt: new Date(Date.now() + expiresSeconds * 1_000).toISOString() };
  }

  async getFile(actor: AuthContext, resourceId: string): Promise<{ stream: Readable; filename: string; mimeType: string }> {
    const file = await this.dependencies.repository.getReadyObject(actor, resourceId);
    const storage = this.dependencies.storage as { getReadyStream?: (objectKey: string) => Promise<Readable> };
    if (!storage.getReadyStream) throw new Error('Storage không hỗ trợ tải file trực tiếp.');
    return { stream: await storage.getReadyStream(file.objectKey), filename: file.originalName, mimeType: file.mimeType };
  }
}
