import type { AuthContext, School, SchoolRequest } from '../types.js';

import type { Role } from '../types.js';

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

export interface CreateRegistrationRequestInput {
  schoolCode: string;
  displayName: string;
  email: string;
  requestedRole: 'TEACHER' | 'STUDENT';
}

export interface ReviewRegistrationRequestInput {
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
}

export interface AcceptedInvitation {
  userId: string;
  schoolId?: string;
  role: Role;
  email: string;
}

export interface SchoolAdministrationRepository {
  createSchoolRequest(input: Omit<SchoolRequest, 'id' | 'status' | 'createdAt'>): Promise<SchoolRequest & { duplicate?: boolean }>;
  listSchoolRequests(): Promise<SchoolRequest[]>;
  approveSchoolRequest(id: string, reviewedBy: string, reason: string, idempotencyKey?: string): Promise<{ request: SchoolRequest; school: School; activationEmailQueued?: boolean } | null>;
  resendSchoolActivation(id: string, reviewedBy: string, idempotencyKey: string): Promise<{ requestId: string; activationEmailQueued: boolean }>;
  rejectSchoolRequest(id: string, reviewedBy: string, reason: string, idempotencyKey: string): Promise<SchoolRequest | null>;
  createStudent(actor: AuthContext, input: CreateStudentInput, idempotencyKey: string): Promise<unknown>;
  inviteTeacher(actor: AuthContext, input: InviteTeacherInput, idempotencyKey: string): Promise<unknown>;
  acceptInvitation(token: string, newPassword: string): Promise<AcceptedInvitation>;
  updateProfile(actor: AuthContext, input: UpdateProfileInput, idempotencyKey: string): Promise<unknown>;
  createRegistrationRequest(input: CreateRegistrationRequestInput): Promise<unknown>;
  listRegistrationRequests(actor: AuthContext, page: number, pageSize: number): Promise<unknown>;
  reviewRegistrationRequest(actor: AuthContext, requestId: string, input: ReviewRegistrationRequestInput, idempotencyKey: string): Promise<unknown>;
  close?(): Promise<void>;
}
