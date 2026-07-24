import type { School, SchoolRequest } from '../types.js';

export interface SchoolAdministrationRepository {
  createSchoolRequest(input: Omit<SchoolRequest, 'id' | 'status' | 'createdAt'>): Promise<SchoolRequest>;
  listSchoolRequests(): Promise<SchoolRequest[]>;
  approveSchoolRequest(id: string, reviewedBy: string, reason: string): Promise<{ request: SchoolRequest; school: School } | null>;
}
