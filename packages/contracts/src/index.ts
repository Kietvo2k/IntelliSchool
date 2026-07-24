export const platformRoles = ['PLATFORM_ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT'] as const;
export type PlatformRole = (typeof platformRoles)[number];

export interface ApiError {
  error: { code: string; message: string; request_id: string; };
}

export interface SchoolRequestView {
  id: string;
  schoolName: string;
  principalName: string;
  principalEmail: string;
  province: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}
