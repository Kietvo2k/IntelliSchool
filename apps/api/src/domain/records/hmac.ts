import { createHmac, timingSafeEqual } from 'node:crypto';

export function studentRecordsSignature(secret: string, timestamp: string, studentCode: string): string {
  return createHmac('sha256', secret).update(`${timestamp}\n${studentCode.trim().toUpperCase()}`).digest('hex');
}

export function studentRecordsHmacMatches(secret: string, timestamp: string, studentCode: string, provided: string): boolean {
  const expected = Buffer.from(studentRecordsSignature(secret, timestamp, studentCode), 'hex');
  const actual = Buffer.from(provided.trim().toLowerCase(), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
