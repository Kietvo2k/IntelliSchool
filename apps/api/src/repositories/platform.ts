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

export interface CreateQuestionBankInput {
  subjectId: string;
  name: string;
}

export interface CreateQuestionInput {
  bankId: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';
  prompt: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  rubric: Record<string, unknown>;
  maxScore: number;
}

export interface CreateAssignmentInput {
  classId: string;
  subjectId: string;
  title: string;
  instructions: string;
  dueAt: string | null;
  items: Array<{ questionVersionId: string; position: number; points: number }>;
}

export interface PublishAssignmentInput {
  assignmentId: string;
}

export interface GradeEssayInput {
  attemptId: string;
  assignmentItemId: string;
  score: number;
  feedback: string;
}

export interface GradebookQueryInput {
  classId: string;
  subjectId?: string;
  studentId?: string;
}

export interface ListAssignmentsInput {
  classId: string;
  subjectId?: string;
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
  createQuestionBank(actor: AuthContext, input: CreateQuestionBankInput, idempotencyKey: string): Promise<unknown>;
  createQuestion(actor: AuthContext, input: CreateQuestionInput, idempotencyKey: string): Promise<unknown>;
  createAssignment(actor: AuthContext, input: CreateAssignmentInput, idempotencyKey: string): Promise<unknown>;
  publishAssignment(actor: AuthContext, input: PublishAssignmentInput, idempotencyKey: string): Promise<unknown>;
  gradeEssay(actor: AuthContext, input: GradeEssayInput, idempotencyKey: string): Promise<unknown>;
  getGradebook(actor: AuthContext, input: GradebookQueryInput): Promise<unknown>;
  listAssignments(actor: AuthContext, input: ListAssignmentsInput): Promise<unknown>;
  getMyGrades(actor: AuthContext): Promise<unknown>;
  close?(): Promise<void>;
}
