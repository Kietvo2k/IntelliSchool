import type { AuthContext, School, SchoolRequest } from '../types.js';

export interface CreateStudentInput {
  displayName: string;
  email: string;
}

export interface InviteTeacherInput {
  displayName: string;
  email: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  avatarObjectKey?: string | null;
  email?: string;
}

export interface AcceptedInvitation {
  userId: string;
  schoolId: string;
  role: 'SCHOOL_OWNER' | 'TEACHER';
  email: string;
}

export interface SchoolAdministrationRepository {
  createSchoolRequest(input: Omit<SchoolRequest, 'id' | 'status' | 'createdAt'>): Promise<SchoolRequest>;
  listSchoolRequests(): Promise<SchoolRequest[]>;
  approveSchoolRequest(id: string, reviewedBy: string, reason: string): Promise<{ request: SchoolRequest; school: School } | null>;
  createStudent(actor: AuthContext, input: CreateStudentInput, idempotencyKey: string): Promise<unknown>;
  inviteTeacher(actor: AuthContext, input: InviteTeacherInput, idempotencyKey: string): Promise<unknown>;
  acceptInvitation(token: string, newPassword: string): Promise<AcceptedInvitation>;
  updateProfile(actor: AuthContext, input: UpdateProfileInput, idempotencyKey: string): Promise<unknown>;
  close?(): Promise<void>;
}
