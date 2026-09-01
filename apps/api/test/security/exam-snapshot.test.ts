import { describe, expect, it } from 'vitest';
import {
  createExamSnapshotKeyring,
  decryptExamSnapshot,
  encryptExamSnapshot,
  type ExamSnapshotMetadata,
  type ExamSnapshotPlaintext,
} from '../../src/security/exam-snapshot.js';

const metadata: ExamSnapshotMetadata = {
  schemaVersion: 1,
  schoolId: 'school-1',
  assignmentId: 'assignment-1',
  assignmentVersion: 1,
  itemIds: ['item-1'],
  itemCount: 1,
};

const plaintext: ExamSnapshotPlaintext = {
  schemaVersion: 1,
  assignmentId: 'assignment-1',
  assignmentVersion: 1,
  items: [{
    assignmentItemId: 'item-1',
    questionVersionId: 'question-version-1',
    position: 1,
    points: 1,
    type: 'MULTIPLE_CHOICE',
    prompt: { text: 'Nội dung bí mật', choices: ['A', 'B'] },
    answerKey: { choice: 'B' },
    rubric: {},
  }],
};

const keyring = createExamSnapshotKeyring('v1', { v1: Buffer.alloc(32, 7) });

describe('exam snapshot encryption', () => {
  it('round-trips an AES-256-GCM snapshot with authenticated metadata', () => {
    const encrypted = encryptExamSnapshot({ keyVersion: 'v1', metadata, plaintext }, keyring);

    expect(encrypted.ciphertext).toBeInstanceOf(Buffer);
    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);
    expect(decryptExamSnapshot({ ...encrypted, metadata }, keyring)).toEqual(plaintext);
  });

  it('does not store the plaintext prompt or answer key in ciphertext', () => {
    const encrypted = encryptExamSnapshot({ keyVersion: 'v1', metadata, plaintext }, keyring);
    const encodedCiphertext = encrypted.ciphertext.toString('utf8');

    expect(encodedCiphertext).not.toContain('Nội dung bí mật');
    expect(encodedCiphertext).not.toContain('choice');
    expect(encodedCiphertext).not.toContain('question-version-1');
  });

  it('fails closed when the key version is missing', () => {
    const encrypted = encryptExamSnapshot({ keyVersion: 'v1', metadata, plaintext }, keyring);

    expect(() => decryptExamSnapshot({ ...encrypted, metadata }, createExamSnapshotKeyring('v2', { v2: Buffer.alloc(32, 8) }))).toThrowError(
      expect.objectContaining({ code: 'EXAM_SNAPSHOT_UNAVAILABLE' }),
    );
  });

  it('fails closed when ciphertext, metadata, or auth tag is tampered', () => {
    const encrypted = encryptExamSnapshot({ keyVersion: 'v1', metadata, plaintext }, keyring);
    const ciphertext = Buffer.from(encrypted.ciphertext);
    ciphertext[0] ^= 1;
    const authTag = Buffer.from(encrypted.authTag);
    authTag[0] ^= 1;

    expect(() => decryptExamSnapshot({ ...encrypted, ciphertext, metadata }, keyring)).toThrowError(
      expect.objectContaining({ code: 'EXAM_SNAPSHOT_UNAVAILABLE' }),
    );
    expect(() => decryptExamSnapshot({ ...encrypted, authTag, metadata }, keyring)).toThrowError(
      expect.objectContaining({ code: 'EXAM_SNAPSHOT_UNAVAILABLE' }),
    );
    expect(() => decryptExamSnapshot({ ...encrypted, metadata: { ...metadata, itemCount: 2 } }, keyring)).toThrowError(
      expect.objectContaining({ code: 'EXAM_SNAPSHOT_UNAVAILABLE' }),
    );
  });

  it('rejects key material that is not exactly 256 bits', () => {
    expect(() => createExamSnapshotKeyring('v1', { v1: Buffer.alloc(31) })).toThrowError(
      expect.objectContaining({ code: 'EXAM_SNAPSHOT_KEY_INVALID' }),
    );
  });
});
