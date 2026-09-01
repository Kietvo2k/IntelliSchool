import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { AppError } from '../errors.js';
import { assertQuota } from './disk-quota.js';
import type { ResourceObjectStorage } from './resource-object-storage.js';

export interface LocalResourceStorageOptions {
  rootDir: string;
  publicBaseUrl: string;
  signingSecret: string;
  quotaBytes: number;
  quotaRoots?: string[];
}

interface ObjectMeta { mimeType: string }

function resolveObjectPath(root: string, objectKey: string): string {
  if (!objectKey || objectKey.includes('\0') || objectKey !== objectKey.trim()) {
    throw new AppError(400, 'INVALID_OBJECT_KEY', 'Khóa tệp không hợp lệ.');
  }
  const normalized = path.posix.normalize(objectKey.replaceAll('\\', '/'));
  if (normalized.startsWith('..') || path.posix.isAbsolute(normalized) || normalized.includes(':/')) {
    throw new AppError(400, 'INVALID_OBJECT_KEY', 'Khóa tệp không hợp lệ.');
  }
  const full = path.resolve(root, normalized);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
    throw new AppError(400, 'INVALID_OBJECT_KEY', 'Khóa tệp không hợp lệ.');
  }
  return full;
}

export class LocalResourceStorage implements ResourceObjectStorage {
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;
  private readonly signingSecret: string;
  private readonly quotaBytes: number;
  private readonly quotaRoots: string[];

  constructor(options: LocalResourceStorageOptions) {
    this.rootDir = options.rootDir;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '');
    this.signingSecret = options.signingSecret;
    this.quotaBytes = options.quotaBytes;
    this.quotaRoots = options.quotaRoots ?? [options.rootDir];
  }

  async putQuarantine(objectKey: string, bytes: Buffer, mimeType: string): Promise<void> {
    await this.writeObject(objectKey, bytes, mimeType);
  }

  async deleteQuarantine(objectKey: string): Promise<void> {
    await this.deleteObject(objectKey);
  }

  async getQuarantineStream(objectKey: string): Promise<Readable> {
    return createReadStream(resolveObjectPath(this.rootDir, objectKey));
  }

  async promote(quarantineObjectKey: string, readyObjectKey: string): Promise<void> {
    const from = resolveObjectPath(this.rootDir, quarantineObjectKey);
    const to = resolveObjectPath(this.rootDir, readyObjectKey);
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
    await copyFile(this.metaPath(from), this.metaPath(to)).catch(() => undefined);
    await this.deleteObject(quarantineObjectKey);
  }

  async signedReadyDownload(objectKey: string, expiresSeconds = 300): Promise<string> {
    resolveObjectPath(this.rootDir, objectKey);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresSeconds;
    return `${this.publicBaseUrl}/api/v1/files/${this.sign({ k: objectKey, e: expiresAt })}`;
  }

  async getReadyStream(objectKey: string): Promise<Readable> {
    return createReadStream(resolveObjectPath(this.rootDir, objectKey));
  }

  async putPrivate(objectKey: string, bytes: Buffer, mimeType: string): Promise<void> {
    await this.writeObject(objectKey, bytes, mimeType);
  }

  async openSigned(token: string): Promise<{ stream: Readable; mimeType: string; filename: string }> {
    const payload = this.verify(token);
    if (payload.e < Math.floor(Date.now() / 1000)) {
      throw new AppError(410, 'DOWNLOAD_EXPIRED', 'Liên kết tải đã hết hạn.');
    }
    const full = resolveObjectPath(this.rootDir, payload.k);
    const mimeType = await this.readMime(full);
    return { stream: createReadStream(full), mimeType, filename: path.basename(payload.k) };
  }

  private async writeObject(objectKey: string, bytes: Buffer, mimeType: string): Promise<void> {
    await assertQuota(this.quotaRoots, this.quotaBytes, bytes.length);
    const full = resolveObjectPath(this.rootDir, objectKey);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    await writeFile(this.metaPath(full), JSON.stringify({ mimeType } satisfies ObjectMeta));
  }

  private async deleteObject(objectKey: string): Promise<void> {
    const full = resolveObjectPath(this.rootDir, objectKey);
    await unlink(full).catch(() => undefined);
    await unlink(this.metaPath(full)).catch(() => undefined);
  }

  private metaPath(objectPath: string): string {
    return `${objectPath}.meta.json`;
  }

  private async readMime(objectPath: string): Promise<string> {
    try {
      const raw = JSON.parse(await readFile(this.metaPath(objectPath), 'utf8')) as ObjectMeta;
      return raw.mimeType || 'application/octet-stream';
    } catch {
      return 'application/octet-stream';
    }
  }

  private sign(payload: { k: string; e: number }): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    return `${body}.${mac}`;
  }

  private verify(token: string): { k: string; e: number } {
    const [body, mac] = token.split('.');
    if (!body || !mac) throw new AppError(400, 'INVALID_DOWNLOAD', 'Liên kết tải không hợp lệ.');
    const expected = createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    const left = Buffer.from(mac);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new AppError(400, 'INVALID_DOWNLOAD', 'Liên kết tải không hợp lệ.');
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { k?: unknown; e?: unknown };
    if (typeof parsed.k !== 'string' || typeof parsed.e !== 'number') {
      throw new AppError(400, 'INVALID_DOWNLOAD', 'Liên kết tải không hợp lệ.');
    }
    return { k: parsed.k, e: parsed.e };
  }
}
