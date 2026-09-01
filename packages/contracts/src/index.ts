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

export type RegistrationRole = 'TEACHER' | 'STUDENT';
export type RegistrationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface RegistrationRequest {
  id: string;
  schoolId: string;
  schoolCode: string;
  email: string;
  displayName: string;
  requestedRole: RegistrationRole;
  status: RegistrationRequestStatus;
  reviewReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface SessionView {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent?: string;
}

export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  role?: PlatformRole;
  schoolId?: string;
  schoolName?: string;
  createdAt: string;
}

export type AssignmentGradingPolicy = 'HIGHEST' | 'LATEST' | 'AVERAGE';
export interface AttemptTiming {
  startedAt: string;
  submittedAt?: string;
  gradedAt?: string;
  isLate: boolean;
}

export interface AssignmentAttemptView {
  id: string;
  assignmentId: string;
  attemptNumber: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'RETURNED';
  timing: AttemptTiming;
  score?: number;
  maxScore: number;
  overallFeedback?: string;
}

export type QuestionInput =
  | { type: 'MULTIPLE_CHOICE'; prompt: string; choices: Array<{ key: string; label: string }>; choice: string; maxScore: number }
  | { type: 'TRUE_FALSE'; prompt: string; value: boolean; maxScore: number }
  | { type: 'SHORT_ANSWER'; prompt: string; acceptable: string[]; maxScore: number }
  | { type: 'ESSAY'; prompt: string; rubric: { criteria: Array<{ label: string; maxScore: number; description?: string }> }; maxScore: number };

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ResourceView {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  status: 'QUARANTINED' | 'PROCESSING' | 'READY' | 'REJECTED';
  classId?: string | null;
  subjectId?: string | null;
  lessonId?: string | null;
  createdAt: string;
}

export interface LessonView {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  content: LessonBlock[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type LessonBlock =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'resource'; resourceId: string };

export interface LessonProgressView {
  lessonId: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt?: string;
  completedAt?: string;
}

export interface ReportExportView {
  id: string;
  kind: 'GRADEBOOK' | 'PROGRESS';
  format: 'CSV' | 'XLSX';
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  expiresAt: string;
  createdAt: string;
}

export type SkillGraphStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface SkillNodeView {
  code: string;
  name: string;
  description?: string;
}

export interface SkillEdgeView {
  prerequisite: string;
  skill: string;
}

export interface SkillGraphDefinitionView {
  skills: SkillNodeView[];
  edges: SkillEdgeView[];
}

export interface SkillGraphSummaryView {
  id: string;
  subjectId: string;
  subjectName?: string;
  title: string;
  version: number;
  status: SkillGraphStatus;
  skillCount: number;
  createdBy?: string;
  createdByName?: string;
  reviewReason?: string;
  approvedByName?: string;
  updatedAt: string;
  createdAt: string;
}

export interface SkillItemMappingView {
  id: string;
  questionVersionId: string;
  skillCode: string;
  weight: number;
}

export interface SkillGraphDetailView extends SkillGraphSummaryView {
  definition: SkillGraphDefinitionView;
  mappings: SkillItemMappingView[];
}

export type RagSourceKind = 'RESOURCE' | 'LESSON' | 'TEXT';
export type RagDocumentStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface RagDocumentView {
  id: string;
  title: string;
  sourceKind: RagSourceKind;
  status: RagDocumentStatus;
  classId: string | null;
  className?: string | null;
  subjectId: string | null;
  subjectName?: string | null;
  chunkCount: number;
  createdByName?: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface RagCitation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  ordinal: number;
  score: number;
  snippet: string;
}

export interface RagSearchResultView {
  query: string;
  citations: RagCitation[];
}

export type AiChatRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface AiChatMessageView {
  id: string;
  role: AiChatRole;
  content: string;
  citations: RagCitation[];
  createdAt: string;
}

export type AiAnswerMode = 'GROUNDED' | 'GENERAL' | 'REFUSED';

export interface AiChatReplyView {
  sessionId: string;
  message: AiChatMessageView;
  mode: AiAnswerMode;
  usedModel: string | null;
  notice?: string;
}
