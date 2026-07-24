import type { AuthContext } from '../types.js';

export interface CreateLessonInput {
  classId: string;
  subjectId: string;
  title: string;
  content: Record<string, unknown>;
  publish: boolean;
}

export interface AssignmentSubmissionInput {
  answers: Array<{ assignmentItemId: string; answer: Record<string, unknown> }>;
}

export interface OfflineEventInput {
  clientEventId: string;
  kind: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface CreateClassInput {
  code: string;
  name: string;
  gradeLevel: number;
  schoolYear: string;
}

export interface AssignClassTeacherInput {
  classId: string;
  teacherId: string;
  subjectId: string | null;
  role: 'SUBJECT_TEACHER' | 'HOMEROOM_TEACHER';
}

export interface EnrollStudentInput {
  classId: string;
  studentId: string;
}

/** Stable application boundary: the HTTP layer never issues SQL directly. */
export interface PlatformRepository {
  getDashboard(actor: AuthContext): Promise<unknown>;
  createLesson(actor: AuthContext, input: CreateLessonInput, idempotencyKey: string): Promise<unknown>;
  submitAssignment(actor: AuthContext, assignmentId: string, input: AssignmentSubmissionInput, idempotencyKey: string): Promise<unknown>;
  saveRiasecAssessment(actor: AuthContext, answers: Record<string, number>, idempotencyKey: string): Promise<unknown>;
  getCareerRecommendations(actor: AuthContext): Promise<unknown>;
  syncOfflineEvents(actor: AuthContext, events: OfflineEventInput[], idempotencyKey: string): Promise<unknown>;
  getBillingQuote(schoolId: string): Promise<unknown>;
  queueCrawlJob(actor: AuthContext, url: string, idempotencyKey: string): Promise<unknown>;
  createClass(actor: AuthContext, input: CreateClassInput, idempotencyKey: string): Promise<unknown>;
  assignClassTeacher(actor: AuthContext, input: AssignClassTeacherInput, idempotencyKey: string): Promise<unknown>;
  enrollStudent(actor: AuthContext, input: EnrollStudentInput, idempotencyKey: string): Promise<unknown>;
  close?(): Promise<void>;
}
