export type WorkspaceRole = 'PLATFORM_ADMIN' | 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT';

export interface SessionUser {
  userId: string;
  role: WorkspaceRole;
  schoolId?: string;
  email: string;
  displayName: string;
  homeroomClassIds?: string[];
}
