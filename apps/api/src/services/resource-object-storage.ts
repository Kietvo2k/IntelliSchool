import type { Readable } from 'node:stream';

export interface ResourceObjectStorage {
  putQuarantine(objectKey: string, bytes: Buffer, mimeType: string): Promise<void>;
  deleteQuarantine(objectKey: string): Promise<void>;
  getQuarantineStream(objectKey: string): Promise<Readable>;
  promote(quarantineObjectKey: string, readyObjectKey: string): Promise<void>;
  signedReadyDownload(objectKey: string, expiresSeconds?: number): Promise<string>;
  getReadyStream(objectKey: string): Promise<Readable>;
  putPrivate(objectKey: string, bytes: Buffer, mimeType: string): Promise<void>;
}
