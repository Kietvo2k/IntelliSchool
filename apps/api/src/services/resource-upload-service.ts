import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { AuthContext } from '../types.js';
import { validateResourceUpload, type ResourceUploadCandidate } from './resource-validation.js';

export interface QuarantinedResourceInput {
  objectKey: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  classId?: string;
  subjectId?: string;
  lessonId?: string;
  examSessionId?: string;
  ownerUserId?: string;
  visibility?: 'PRIVATE' | 'CLASS' | 'SCHOOL';
  idempotencyKey?: string;
}

export interface ResourceUploadDependencies {
  storage: {
    putQuarantine(objectKey: string, bytes: Buffer, mimeType: string): Promise<void>;
    deleteQuarantine(objectKey: string): Promise<void>;
  };
  repository: {
    createQuarantined(actor: AuthContext, input: QuarantinedResourceInput): Promise<unknown>;
  };
}

export interface ResourceUploadOptions {
  idempotencyKey?: string;
  classId?: string;
  subjectId?: string;
  lessonId?: string;
  examSessionId?: string;
  ownerUserId?: string;
  visibility?: 'PRIVATE' | 'CLASS' | 'SCHOOL';
}

export class ResourceUploadService {
  constructor(private readonly dependencies: ResourceUploadDependencies) {}

  async upload(actor: AuthContext, candidate: ResourceUploadCandidate, _options: ResourceUploadOptions = {}): Promise<unknown> {
    const validated = await validateResourceUpload(candidate);
    const objectKey = _options.idempotencyKey
      ? `quarantine/${createHash('sha256').update([actor.schoolId ?? '', actor.userId, _options.idempotencyKey, validated.sha256, _options.classId ?? '', _options.subjectId ?? '', _options.lessonId ?? '', _options.examSessionId ?? '', _options.ownerUserId ?? '', _options.visibility ?? ''].join('\u0000')).digest('hex')}`
      : `quarantine/${randomUUID()}`;
    await this.dependencies.storage.putQuarantine(objectKey, candidate.bytes, validated.mimeType);
    try {
      return await this.dependencies.repository.createQuarantined(actor, { objectKey, ...validated, classId: _options.classId, subjectId: _options.subjectId, lessonId: _options.lessonId, examSessionId: _options.examSessionId, ownerUserId: _options.ownerUserId, visibility: _options.visibility, idempotencyKey: _options.idempotencyKey });
    } catch (error) {
      await this.dependencies.storage.deleteQuarantine(objectKey).catch(() => undefined);
      throw error;
    }
  }
}
