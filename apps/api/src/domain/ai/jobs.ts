export type AiJobRole = 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT';

export function normalizeAiJobRole(value: string): AiJobRole | null {
  return value === 'SCHOOL_OWNER' || value === 'TEACHER' || value === 'STUDENT' ? value : null;
}

export function decideAiJobFailure(input: { attemptCount: number; maxAttempts: number; cancelled: boolean; deadlineExpired: boolean }): { status: 'QUEUED' | 'FAILED' | 'CANCELLED'; stage: 'RETRYING' | 'FAILED' | 'TIMEOUT' | 'CANCELLED'; progress: number } {
  if (input.cancelled) return { status: 'CANCELLED', stage: 'CANCELLED', progress: 100 };
  if (input.deadlineExpired) return { status: 'FAILED', stage: 'TIMEOUT', progress: 100 };
  if (input.attemptCount < input.maxAttempts) return { status: 'QUEUED', stage: 'RETRYING', progress: 0 };
  return { status: 'FAILED', stage: 'FAILED', progress: 100 };
}
