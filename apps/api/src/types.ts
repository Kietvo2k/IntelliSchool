export const platformRoles = ['PLATFORM_ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT'] as const;
export type Role = (typeof platformRoles)[number];

export interface AuthContext {
  userId: string;
  role: Role;
  schoolId?: string;
  email: string;
  displayName: string;
  homeroomClassIds?: string[];
}

export interface SchoolRequest {
  id: string;
  schoolName: string;
  principalName: string;
  principalEmail: string;
  province: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
}

export interface School {
  id: string;
  code: string;
  name: string;
  province: string;
  ownerId: string;
}

export interface AuthSession {
  token: string;
  expiresAt: Date;
  user: AuthContext;
}
