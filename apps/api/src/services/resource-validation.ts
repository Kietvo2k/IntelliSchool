import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../errors.js';

const maximumBytes = 50 * 1024 * 1024;

const allowedTypes = new Map<string, ReadonlySet<string>>([
  ['pdf', new Set(['application/pdf'])],
  ['docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])],
  ['pptx', new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation'])],
  ['xlsx', new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])],
  ['txt', new Set(['text/plain'])],
  ['png', new Set(['image/png'])],
  ['jpg', new Set(['image/jpeg'])],
  ['jpeg', new Set(['image/jpeg'])],
  ['mp4', new Set(['video/mp4'])],
]);

export interface ResourceUploadCandidate {
  filename: string;
  declaredMimeType?: string;
  bytes: Buffer;
}

export interface ValidatedResourceUpload {
  originalName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
}

function reject(code: string, message: string): never {
  throw new AppError(422, code, message);
}

function normalizedFilename(filename: string): string {
  const name = basename(filename).normalize('NFC').trim();
  // eslint-disable-next-line no-control-regex -- Reject ASCII control bytes in a supplied filename.
  if (!name || name.length > 255 || /[\u0000-\u001f]/.test(name)) reject('RESOURCE_NAME_INVALID', 'Tên tệp không hợp lệ.');
  return name;
}

function extensionOf(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index > 0 ? filename.slice(index + 1).toLowerCase() : '';
}

export async function validateResourceUpload(candidate: ResourceUploadCandidate): Promise<ValidatedResourceUpload> {
  const originalName = normalizedFilename(candidate.filename);
  const extension = extensionOf(originalName);
  const expected = allowedTypes.get(extension);
  if (!expected) reject('RESOURCE_TYPE_REJECTED', 'Định dạng tệp này không được phép.');
  if (!candidate.bytes.length) reject('RESOURCE_EMPTY', 'Tệp tải lên không được để trống.');
  if (candidate.bytes.length > maximumBytes) reject('RESOURCE_TOO_LARGE', 'Tệp tải lên không được vượt quá 50 MB.');

  const detected = await fileTypeFromBuffer(candidate.bytes);
  const declared = candidate.declaredMimeType?.toLowerCase().trim();
  const mimeType = detected?.mime ?? (extension === 'txt' && declared === 'text/plain' ? 'text/plain' : undefined);
  if (!mimeType || !expected.has(mimeType)) {
    reject('RESOURCE_TYPE_REJECTED', 'Loại nội dung của tệp không khớp với định dạng được phép.');
  }

  return {
    originalName,
    mimeType,
    byteSize: candidate.bytes.length,
    sha256: createHash('sha256').update(candidate.bytes).digest('hex'),
  };
}
