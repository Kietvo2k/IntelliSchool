import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { AppError } from '../errors.js';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

export interface ExamSnapshotKeyring {
  readonly activeKeyVersion: string;
  readonly keys: Readonly<Record<string, Buffer>>;
}

export interface ExamSnapshotMetadata {
  schemaVersion: 1;
  schoolId: string;
  assignmentId: string;
  assignmentVersion: number;
  itemIds: string[];
  itemCount: number;
}

export interface ExamSnapshotItem {
  assignmentItemId: string;
  questionVersionId: string;
  position: number;
  points: number;
  type: string;
  prompt: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  rubric: Record<string, unknown>;
}

export interface ExamSnapshotPlaintext {
  schemaVersion: 1;
  assignmentId: string;
  assignmentVersion: number;
  items: ExamSnapshotItem[];
}

export interface EncryptedExamSnapshot {
  keyVersion: string;
  metadata: ExamSnapshotMetadata;
  metadataHash: string;
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
}

function keyInvalid(): never {
  throw new AppError(500, 'EXAM_SNAPSHOT_KEY_INVALID', 'Cấu hình khóa snapshot đề thi không hợp lệ.');
}

function unavailable(): never {
  throw new AppError(503, 'EXAM_SNAPSHOT_UNAVAILABLE', 'Nội dung kỳ thi hiện không khả dụng.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function canonicalJson(value: unknown): string {
  const encoded = JSON.stringify(canonicalize(value));
  if (typeof encoded !== 'string') throw new AppError(500, 'EXAM_SNAPSHOT_SERIALIZATION_FAILED', 'Không thể chuẩn hóa snapshot đề thi.');
  return encoded;
}

function hashMetadata(metadata: ExamSnapshotMetadata): Buffer {
  return createHash('sha256').update(canonicalJson(metadata), 'utf8').digest();
}

function keyFor(keyring: ExamSnapshotKeyring, keyVersion: string): Buffer {
  const key = keyring.keys[keyVersion];
  if (!key || !Buffer.isBuffer(key) || key.length !== KEY_BYTES) unavailable();
  return key;
}

function assertMetadataHash(metadata: ExamSnapshotMetadata, metadataHash: string): void {
  const expected = hashMetadata(metadata);
  const provided = Buffer.from(metadataHash, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) unavailable();
}

function validatePlaintext(value: unknown): ExamSnapshotPlaintext {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.assignmentId !== 'string' || typeof value.assignmentVersion !== 'number' || !Array.isArray(value.items)) unavailable();
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.assignmentItemId !== 'string' || typeof item.questionVersionId !== 'string' || typeof item.position !== 'number' || typeof item.points !== 'number' || typeof item.type !== 'string' || !isRecord(item.prompt) || !isRecord(item.answerKey) || !isRecord(item.rubric)) unavailable();
  }
  return value as unknown as ExamSnapshotPlaintext;
}

export function createExamSnapshotKeyring(activeKeyVersion: string, keys: Readonly<Record<string, Buffer>>): ExamSnapshotKeyring {
  if (!activeKeyVersion.trim()) keyInvalid();
  const normalized: Record<string, Buffer> = {};
  for (const [version, value] of Object.entries(keys)) {
    if (!version.trim() || !Buffer.isBuffer(value) || value.length !== KEY_BYTES) keyInvalid();
    normalized[version] = Buffer.from(value);
  }
  if (!normalized[activeKeyVersion]) keyInvalid();
  return Object.freeze({ activeKeyVersion, keys: Object.freeze(normalized) });
}

export async function loadExamSnapshotKeyring(options: { filePath: string; activeKeyVersion: string }): Promise<ExamSnapshotKeyring> {
  if (!options.filePath.trim() || !options.activeKeyVersion.trim()) keyInvalid();
  try {
    const parsed = JSON.parse(await readFile(options.filePath, 'utf8')) as unknown;
    if (!isRecord(parsed)) keyInvalid();
    const keys: Record<string, Buffer> = {};
    for (const [version, encoded] of Object.entries(parsed)) {
      if (typeof encoded !== 'string') keyInvalid();
      const key = Buffer.from(encoded, 'base64url');
      if (key.length !== KEY_BYTES) keyInvalid();
      keys[version] = key;
    }
    return createExamSnapshotKeyring(options.activeKeyVersion, keys);
  } catch (error) {
    if (error instanceof AppError) throw error;
    unavailable();
  }
}

export function encryptExamSnapshot(input: { keyVersion: string; metadata: ExamSnapshotMetadata; plaintext: ExamSnapshotPlaintext }, keyring: ExamSnapshotKeyring): EncryptedExamSnapshot {
  const key = keyFor(keyring, input.keyVersion);
  const metadataHash = hashMetadata(input.metadata);
  const metadataBytes = Buffer.from(canonicalJson(input.metadata), 'utf8');
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(metadataBytes);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(canonicalJson(input.plaintext), 'utf8')), cipher.final()]);
  return {
    keyVersion: input.keyVersion,
    metadata: input.metadata,
    metadataHash: metadataHash.toString('hex'),
    ciphertext,
    nonce,
    authTag: cipher.getAuthTag(),
  };
}

export function decryptExamSnapshot(input: { keyVersion: string; metadata: ExamSnapshotMetadata; metadataHash: string; ciphertext: Buffer; nonce: Buffer; authTag: Buffer }, keyring: ExamSnapshotKeyring): ExamSnapshotPlaintext {
  const key = keyFor(keyring, input.keyVersion);
  if (input.nonce.length !== NONCE_BYTES || input.authTag.length !== AUTH_TAG_BYTES || input.ciphertext.length === 0) unavailable();
  assertMetadataHash(input.metadata, input.metadataHash);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, input.nonce, { authTagLength: AUTH_TAG_BYTES });
    decipher.setAAD(Buffer.from(canonicalJson(input.metadata), 'utf8'));
    decipher.setAuthTag(input.authTag);
    const plaintext = Buffer.concat([decipher.update(input.ciphertext), decipher.final()]).toString('utf8');
    return validatePlaintext(JSON.parse(plaintext) as unknown);
  } catch (error) {
    if (error instanceof AppError && error.code === 'EXAM_SNAPSHOT_UNAVAILABLE') throw error;
    unavailable();
  }
}

