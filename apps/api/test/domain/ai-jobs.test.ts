import { describe, expect, it } from 'vitest';
import { decideAiJobFailure, normalizeAiJobRole } from '../../src/domain/ai/jobs.js';

describe('AI job reliability policy', () => {
  it('retries only before max attempts and never retries cancelled or expired jobs', () => {
    expect(decideAiJobFailure({ attemptCount: 1, maxAttempts: 3, cancelled: false, deadlineExpired: false })).toEqual({ status: 'QUEUED', stage: 'RETRYING', progress: 0 });
    expect(decideAiJobFailure({ attemptCount: 3, maxAttempts: 3, cancelled: false, deadlineExpired: false })).toEqual({ status: 'FAILED', stage: 'FAILED', progress: 100 });
    expect(decideAiJobFailure({ attemptCount: 1, maxAttempts: 3, cancelled: true, deadlineExpired: false })).toEqual({ status: 'CANCELLED', stage: 'CANCELLED', progress: 100 });
    expect(decideAiJobFailure({ attemptCount: 1, maxAttempts: 3, cancelled: false, deadlineExpired: true })).toEqual({ status: 'FAILED', stage: 'TIMEOUT', progress: 100 });
  });

  it('accepts only membership roles that exist in the database schema', () => {
    expect(normalizeAiJobRole('STUDENT')).toBe('STUDENT');
    expect(normalizeAiJobRole('TEACHER')).toBe('TEACHER');
    expect(normalizeAiJobRole('SCHOOL_OWNER')).toBe('SCHOOL_OWNER');
    expect(normalizeAiJobRole('PLATFORM_ADMIN')).toBeNull();
    expect(normalizeAiJobRole('admin')).toBeNull();
  });
});
