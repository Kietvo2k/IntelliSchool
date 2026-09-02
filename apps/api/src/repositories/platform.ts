import type { AuthContext } from '../types.js';

export interface CreateLessonInput {
  classId: string;
  subjectId: string;
  title: string;
  content: Record<string, unknown>;
  publish: boolean;
}
export interface UpdateLessonInput { title: string; content: Record<string, unknown>; }

export interface ListLessonsInput {
  classId: string;
  subjectId?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface LessonProgressInput {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface AdminUserQueryInput {
  page: number;
  pageSize: number;
  schoolId?: string;
  role?: 'PLATFORM_ADMIN' | 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT';
  status?: 'ACTIVE' | 'INACTIVE';
}
export interface AdminSchoolQueryInput { page: number; pageSize: number; }

export interface AdminUserStatusInput { isActive: boolean; }
export interface InvitePlatformAdminInput { email: string; displayName: string; }
export interface AdminAuditQueryInput {
  page: number;
  pageSize: number;
  actorId?: string;
  action?: string;
  schoolId?: string;
  from?: string;
  to?: string;
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
export type UpdateQuestionInput = Omit<CreateQuestionInput, 'bankId'>;

export interface CreateAssignmentInput {
  classId: string;
  subjectId: string;
  title: string;
  instructions: string;
  dueAt: string | null;
  maxAttempts: number;
  gradingPolicy: 'HIGHEST' | 'LATEST' | 'AVERAGE';
  items: Array<{ questionVersionId: string; position: number; points: number }>;
  deliveryMode?: 'HOMEWORK' | 'EXAM';
  durationMinutes?: number | null;
  examPin?: string | null;
  showScoreOnSubmit?: boolean;
  examPeriod?: 'PRACTICE' | 'MIDTERM_1' | 'FINAL_1' | 'MIDTERM_2' | 'FINAL_2' | 'MOCK_GRADUATION' | 'OTHER';
  integrityMode?: 'PRACTICE' | 'STRICT_WEB';
}
export type UpdateAssignmentInput = CreateAssignmentInput;

export interface PublishAssignmentInput {
  assignmentId: string;
}

export interface ApproveQuestionInput {
  questionVersionId: string;
}

export interface GradeEssayInput {
  attemptId: string;
  assignmentItemId: string;
  score: number;
  feedback: string;
}
export interface ReturnAssignmentAttemptInput { attemptId: string; overallFeedback: string; }

export interface GradebookQueryInput {
  classId: string;
  subjectId?: string;
  studentId?: string;
}
export interface OverrideGradebookInput { score: number; reason: string; }
export interface RequestReportExportInput { kind: 'GRADEBOOK' | 'PROGRESS'; format: 'CSV' | 'XLSX'; classId: string; subjectId?: string; studentId?: string; }

export interface ListAssignmentsInput {
  classId: string;
  subjectId?: string;
}

export interface ListQuestionBanksInput {
  subjectId: string;
}

export interface ListQuestionsInput {
  bankId: string;
  page?: number;
  pageSize?: number;
  type?: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';
  approval?: 'APPROVED' | 'PENDING';
  query?: string;
}

export interface SkillGraphDefinitionInput {
  skills: Array<{ code: string; name: string; description?: string }>;
  edges: Array<{ prerequisite: string; skill: string }>;
}
export interface CreateSkillGraphInput {
  subjectId: string;
  title: string;
  definition: SkillGraphDefinitionInput;
}
export interface UpdateSkillGraphInput {
  title: string;
  definition: SkillGraphDefinitionInput;
}
export interface ReviewSkillGraphInput {
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
}
export interface MapSkillItemsInput {
  questionVersionId: string;
  skills: Array<{ skillCode: string; weight: number }>;
}
export interface ListSkillGraphsInput {
  subjectId?: string;
}

export interface AdaptiveDiagnosisQueryInput {
  classId: string;
  subjectId: string;
}
export interface OverrideAdaptiveInput {
  studentId: string;
  subjectId: string;
  decision: 'CONFIRM' | 'DISMISS';
  reason: string;
}

export interface ListInstitutionsInput { province?: string; query?: string; }
export interface UpsertCareerInput { code: string; name: string; description?: string; riasecWeights?: Record<string, number>; }
export interface UpsertMajorInput { code: string; name: string; careerCode?: string | null; }
export interface UpsertInstitutionInput { code: string; name: string; province?: string; type?: string; description?: string; website?: string; admissionMethod?: string; }
export interface AdmissionScoreRow { institutionCode: string; majorCode: string; programCode?: string | null; year: number; examBlock: string; score: number; sourceUrl?: string | null; }
export interface ImportAdmissionScoresInput { rows: AdmissionScoreRow[]; }
export interface UpsertScholarshipInput { institutionCode?: string | null; title: string; criteria: Record<string, unknown>; deadlineAt?: string | null; sourceUrl?: string | null; }
export interface ScholarshipMatchInput { income?: number; gpa?: number; province?: string; majorCode?: string; }

export interface UpdateCareerProfileInput {
  province?: string;
  tuitionBudgetVnd?: number;
  householdIncomeVnd?: number;
  subjectScores?: Record<string, number>;
  classroomGrades?: Record<string, number>;
  chosenBlocks?: string[];
  chosenSubjects?: string[];
  priorities?: Record<string, number>;
  studyGoal?: string;
  studyGoalType?: 'career' | 'school' | 'undecided';
  preferredStudyRegion?: 'near_home' | 'same_region' | 'nationwide';
  preferredSchoolType?: 'any' | 'public' | 'private' | 'international';
  schoolPriority?: Record<string, number>;
}

export interface ExamRecordInput {
  subjectCode: string;
  score: number;
  year: number;
  source: 'CLASSROOM' | 'GRADUATION';
}

export interface RankSchoolsInput {
  province?: string;
  query?: string;
  examBlock?: string;
  majorCode?: string;
}

export interface CareerAnalyzeInput {
  agentTypes?: string[];
  targetMajor?: string;
  message?: string;
  compareMajors?: string[];
  mode?: 'analyze' | 'post_quiz' | 'compare';
  academicScores?: Record<string, number>;
}

export interface StartExamSessionInput {
  assignmentId: string;
  studentCode: string;
  pin: string;
}

export interface SaveExamAnswersInput {
  sessionId: string;
  answers: Array<{ assignmentItemId: string; answer: Record<string, unknown> }>;
}

export interface ExamIntegrityInput {
  sessionId: string;
  kind: string;
  payload?: Record<string, unknown>;
  exemptionToken?: string;
}

export interface ExamAttachmentExemption {
  sessionId: string;
  token: string;
  expiresAt: string;
}

export interface AptitudeDraftInput {
  version: string;
  answers: Record<string, number | string>;
  skippedIds: string[];
  currentIndex: number;
}

export interface SendClassMessageInput {
  classId: string;
  recipientId?: string | null;
  channelKind?: 'CLASS' | 'DIRECT';
  body: string;
}

export interface ListClassMessagesInput {
  classId: string;
  peerId?: string;
  channelKind?: 'CLASS' | 'DIRECT';
}

export interface CreateSkillSuggestionInput {
  studentId: string;
  subjectId?: string | null;
}

export interface ReviewSkillSuggestionInput {
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
}

export interface AssignExamProctorInput {
  assignmentId: string;
  userId: string;
}
export interface SetShareGrantInput { scope: 'PROFILE' | 'RESULTS' | 'FULL'; granted: boolean; }

export interface AdmissionProbabilityInput { institutionMajorId: string; priorityBonus?: number; }
export interface AddAspirationInput { institutionMajorId: string; note?: string; }
export interface ReorderAspirationsInput { orderedIds: string[]; }
export interface AddSavedItemInput { itemType: 'CAREER' | 'MAJOR' | 'INSTITUTION' | 'SCHOLARSHIP'; itemId: string; }
export interface AddGoalInput { title: string; targetAt?: string | null; }
export interface AddReminderInput { goalId?: string | null; dueAt: string; message: string; }

export interface UpsertAiModelInput {
  id?: string;
  provider: string;
  modelName: string;
  tier: 'LOCAL_FAST' | 'LOCAL_QUALITY' | 'CLOUD';
  endpointUrl?: string | null;
  isEnabled: boolean;
  monthlyCostLimitVnd?: number | null;
  inputVndPer1k?: number;
  outputVndPer1k?: number;
}

export interface IngestRagInput {
  sourceKind: 'LESSON' | 'TEXT';
  title: string;
  lessonId?: string | null;
  text?: string | null;
  classId?: string | null;
  subjectId?: string | null;
}

export interface SearchRagInput {
  query: string;
  classId?: string | null;
  subjectId?: string | null;
  topK?: number;
  documentIds?: string[];
  lessonIds?: string[];
  sourceMode?: 'AUTO' | 'SCHOOL_LIBRARY' | 'MY_UPLOADS' | 'SELECTED';
  attachmentResourceIds?: string[];
}

export interface AiChatInput {
  sessionId?: string | null;
  message: string;
  classId?: string | null;
  subjectId?: string | null;
  purpose?: 'ASSISTANT' | 'TEACHER_COMPOSE' | 'PERSONAL_STUDY' | 'CAREER_CHAT' | 'EXTRACURRICULAR_INTERVIEW';
  documentIds?: string[];
  lessonIds?: string[];
  runCode?: boolean;
  reasoningMode?: 'STANDARD' | 'THINKING';
  agentic?: boolean;
  sourceMode?: 'AUTO' | 'SCHOOL_LIBRARY' | 'MY_UPLOADS' | 'SELECTED';
  attachmentResourceIds?: string[];
}

export interface UpsertTranscriptInput {
  userId?: string;
  term: string;
  subjectCode: string;
  score: number;
  source: 'STUDENT' | 'SCHOOL' | 'PORTAL';
}

export interface UpdateKnowledgeCardInput {
  userId?: string;
  freeText: string;
}

export interface UpdateSubscriptionInput {
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  includedClassQuota: number;
  basePriceVnd: number;
  extraClassPriceVnd: number;
  trialEndsAt?: string | null;
  manualOverrideReason?: string | null;
}

export interface RecordBillingEventInput {
  kind: string;
  amountVnd: number;
  note?: string;
}

/** Stable application boundary: the HTTP layer never issues SQL directly. */
export interface PlatformRepository {
  getDashboard(actor: AuthContext): Promise<unknown>;
  listAdminUsers(actor: AuthContext, input: AdminUserQueryInput): Promise<unknown>;
  listAdminSchools(actor: AuthContext, input: AdminSchoolQueryInput): Promise<unknown>;
  exportAdminSchools(actor: AuthContext): Promise<Array<{ code: string; name: string; ownerName: string | null; ownerEmail: string | null; activeUserCount: number; createdAt: string }>>;
  getAdminSchool(actor: AuthContext, schoolId: string): Promise<unknown>;
  listAdminAuditEvents(actor: AuthContext, input: AdminAuditQueryInput): Promise<unknown>;
  invitePlatformAdmin(actor: AuthContext, input: InvitePlatformAdminInput, idempotencyKey: string): Promise<unknown>;
  setAdminUserStatus(actor: AuthContext, userId: string, input: AdminUserStatusInput, idempotencyKey: string): Promise<unknown>;
  revokeAdminUserSessions(actor: AuthContext, userId: string, idempotencyKey: string): Promise<unknown>;
  createLesson(actor: AuthContext, input: CreateLessonInput, idempotencyKey: string): Promise<unknown>;
  updateLesson(actor: AuthContext, lessonId: string, input: UpdateLessonInput, idempotencyKey: string): Promise<unknown>;
  publishLesson(actor: AuthContext, lessonId: string, idempotencyKey: string): Promise<unknown>;
  archiveLesson(actor: AuthContext, lessonId: string, idempotencyKey: string): Promise<unknown>;
  listLessons(actor: AuthContext, input: ListLessonsInput): Promise<unknown>;
  getLesson(actor: AuthContext, lessonId: string): Promise<unknown>;
  setLessonProgress(actor: AuthContext, lessonId: string, input: LessonProgressInput, idempotencyKey: string): Promise<unknown>;
  submitAssignment(actor: AuthContext, assignmentId: string, input: AssignmentSubmissionInput, idempotencyKey: string): Promise<unknown>;
  saveRiasecAssessment(actor: AuthContext, answers: Record<string, number>, idempotencyKey: string): Promise<unknown>;
  getCareerRecommendations(actor: AuthContext): Promise<unknown>;
  getAptitudeDraft(actor: AuthContext): Promise<unknown>;
  saveAptitudeDraft(actor: AuthContext, input: AptitudeDraftInput, idempotencyKey: string): Promise<unknown>;
  syncOfflineEvents(actor: AuthContext, events: OfflineEventInput[], idempotencyKey: string): Promise<unknown>;
  getBillingQuote(schoolId: string): Promise<unknown>;
  queueCrawlJob(actor: AuthContext, url: string, idempotencyKey: string): Promise<unknown>;
  createClass(actor: AuthContext, input: CreateClassInput, idempotencyKey: string): Promise<unknown>;
  assignClassTeacher(actor: AuthContext, input: AssignClassTeacherInput, idempotencyKey: string): Promise<unknown>;
  enrollStudent(actor: AuthContext, input: EnrollStudentInput, idempotencyKey: string): Promise<unknown>;
  createQuestionBank(actor: AuthContext, input: CreateQuestionBankInput, idempotencyKey: string): Promise<unknown>;
  createQuestion(actor: AuthContext, input: CreateQuestionInput, idempotencyKey: string): Promise<unknown>;
  updateQuestion(actor: AuthContext, questionId: string, input: UpdateQuestionInput, idempotencyKey: string): Promise<unknown>;
  importQuestions(actor: AuthContext, bankId: string, rows: UpdateQuestionInput[], idempotencyKey: string): Promise<unknown>;
  approveQuestion(actor: AuthContext, input: ApproveQuestionInput, idempotencyKey: string): Promise<unknown>;
  createAssignment(actor: AuthContext, input: CreateAssignmentInput, idempotencyKey: string): Promise<unknown>;
  updateAssignment(actor: AuthContext, assignmentId: string, input: UpdateAssignmentInput, idempotencyKey: string): Promise<unknown>;
  publishAssignment(actor: AuthContext, input: PublishAssignmentInput, idempotencyKey: string): Promise<unknown>;
  closeAssignment(actor: AuthContext, assignmentId: string, idempotencyKey: string): Promise<unknown>;
  archiveAssignment(actor: AuthContext, assignmentId: string, idempotencyKey: string): Promise<unknown>;
  gradeEssay(actor: AuthContext, input: GradeEssayInput, idempotencyKey: string): Promise<unknown>;
  returnAssignmentAttempt(actor: AuthContext, input: ReturnAssignmentAttemptInput, idempotencyKey: string): Promise<unknown>;
  listPendingEssays(actor: AuthContext): Promise<unknown>;
  getGradebook(actor: AuthContext, input: GradebookQueryInput): Promise<unknown>;
  overrideGradebookEntry(actor: AuthContext, entryId: string, input: OverrideGradebookInput, idempotencyKey: string): Promise<unknown>;
  getLearningProgress(actor: AuthContext, input: GradebookQueryInput): Promise<unknown>;
  listAssignments(actor: AuthContext, input: ListAssignmentsInput): Promise<unknown>;
  getAssignment(actor: AuthContext, assignmentId: string): Promise<unknown>;
  getMyAssignmentAttempts(actor: AuthContext, assignmentId: string): Promise<unknown>;
  requestReportExport(actor: AuthContext, input: RequestReportExportInput, idempotencyKey: string): Promise<unknown>;
  listReportExports(actor: AuthContext): Promise<unknown>;
  retryReportExport(actor: AuthContext, exportId: string, idempotencyKey: string): Promise<unknown>;
  getReadyReportExport(actor: AuthContext, exportId: string): Promise<{ objectKey: string }>;
  getMyGrades(actor: AuthContext): Promise<unknown>;
  listQuestionBanks(actor: AuthContext, input: ListQuestionBanksInput): Promise<unknown>;
  listQuestions(actor: AuthContext, input: ListQuestionsInput): Promise<unknown>;
  listSubjects(actor: AuthContext): Promise<unknown>;
  listClasses(actor: AuthContext): Promise<unknown>;
  listTeachers(actor: AuthContext): Promise<unknown>;
  listStudents(actor: AuthContext, classId?: string): Promise<unknown>;
  createSkillGraph(actor: AuthContext, input: CreateSkillGraphInput, idempotencyKey: string): Promise<unknown>;
  updateSkillGraph(actor: AuthContext, graphId: string, input: UpdateSkillGraphInput, idempotencyKey: string): Promise<unknown>;
  submitSkillGraphForReview(actor: AuthContext, graphId: string, idempotencyKey: string): Promise<unknown>;
  reviewSkillGraph(actor: AuthContext, graphId: string, input: ReviewSkillGraphInput, idempotencyKey: string): Promise<unknown>;
  mapSkillItems(actor: AuthContext, graphId: string, input: MapSkillItemsInput, idempotencyKey: string): Promise<unknown>;
  listSkillGraphs(actor: AuthContext, input: ListSkillGraphsInput): Promise<unknown>;
  getSkillGraph(actor: AuthContext, graphId: string): Promise<unknown>;
  getAdaptiveDiagnoses(actor: AuthContext, input: AdaptiveDiagnosisQueryInput): Promise<unknown>;
  overrideAdaptiveDiagnosis(actor: AuthContext, input: OverrideAdaptiveInput, idempotencyKey: string): Promise<unknown>;
  getMyAdaptivePlan(actor: AuthContext): Promise<unknown>;
  listCareers(actor: AuthContext): Promise<unknown>;
  listInstitutions(actor: AuthContext, input: ListInstitutionsInput): Promise<unknown>;
  getInstitutionDetail(actor: AuthContext, institutionId: string): Promise<unknown>;
  listScholarships(actor: AuthContext, input: ScholarshipMatchInput): Promise<unknown>;
  adminUpsertCareer(actor: AuthContext, input: UpsertCareerInput, idempotencyKey: string): Promise<unknown>;
  adminUpsertMajor(actor: AuthContext, input: UpsertMajorInput, idempotencyKey: string): Promise<unknown>;
  adminUpsertInstitution(actor: AuthContext, input: UpsertInstitutionInput, idempotencyKey: string): Promise<unknown>;
  adminImportAdmissionScores(actor: AuthContext, input: ImportAdmissionScoresInput, idempotencyKey: string): Promise<unknown>;
  adminUpsertScholarship(actor: AuthContext, input: UpsertScholarshipInput, idempotencyKey: string): Promise<unknown>;
  getAptitudeQuestions(actor: AuthContext): Promise<unknown>;
  saveAptitudeAssessment(actor: AuthContext, answers: Record<string, number | string>, idempotencyKey: string, requestId?: string): Promise<unknown>;
  getCareerProfile(actor: AuthContext): Promise<unknown>;
  updateCareerProfile(actor: AuthContext, input: UpdateCareerProfileInput, idempotencyKey: string): Promise<unknown>;
  setCareerShareGrant(actor: AuthContext, input: SetShareGrantInput, idempotencyKey: string): Promise<unknown>;
  getStudentCareerProfile(actor: AuthContext, studentId: string): Promise<unknown>;
  computeAdmissionProbability(actor: AuthContext, input: AdmissionProbabilityInput): Promise<unknown>;
  listAspirations(actor: AuthContext): Promise<unknown>;
  addAspiration(actor: AuthContext, input: AddAspirationInput, idempotencyKey: string): Promise<unknown>;
  deleteAspiration(actor: AuthContext, aspirationId: string, idempotencyKey: string): Promise<unknown>;
  reorderAspirations(actor: AuthContext, input: ReorderAspirationsInput, idempotencyKey: string): Promise<unknown>;
  getMatchedScholarships(actor: AuthContext): Promise<unknown>;
  listSavedItems(actor: AuthContext): Promise<unknown>;
  addSavedItem(actor: AuthContext, input: AddSavedItemInput, idempotencyKey: string): Promise<unknown>;
  removeSavedItem(actor: AuthContext, savedItemId: string, idempotencyKey: string): Promise<unknown>;
  listGoals(actor: AuthContext): Promise<unknown>;
  addGoal(actor: AuthContext, input: AddGoalInput, idempotencyKey: string): Promise<unknown>;
  completeGoal(actor: AuthContext, goalId: string, idempotencyKey: string): Promise<unknown>;
  listReminders(actor: AuthContext): Promise<unknown>;
  addReminder(actor: AuthContext, input: AddReminderInput, idempotencyKey: string): Promise<unknown>;
  completeReminder(actor: AuthContext, reminderId: string, idempotencyKey: string): Promise<unknown>;
  listAiModels(actor: AuthContext): Promise<unknown>;
  upsertAiModel(actor: AuthContext, input: UpsertAiModelInput, idempotencyKey: string): Promise<unknown>;
  getAiUsageSummary(actor: AuthContext): Promise<unknown>;
  aiHealthCheck(actor: AuthContext, requestId?: string): Promise<unknown>;
  ingestRagContent(actor: AuthContext, input: IngestRagInput, idempotencyKey: string): Promise<unknown>;
  listRagDocuments(actor: AuthContext): Promise<unknown>;
  deleteRagDocument(actor: AuthContext, documentId: string, idempotencyKey: string): Promise<unknown>;
  searchRag(actor: AuthContext, input: SearchRagInput): Promise<unknown>;
  chatWithAi(actor: AuthContext, input: AiChatInput, idempotencyKey: string, requestId?: string, signal?: AbortSignal, jobId?: string): Promise<unknown>;
  createAiJob(actor: AuthContext, input: AiChatInput, idempotencyKey: string, requestId?: string): Promise<unknown>;
  cancelAiJob(actor: AuthContext, jobId: string, idempotencyKey: string, requestId?: string): Promise<unknown>;
  listAiJobs(actor: AuthContext): Promise<unknown>;
  getAiJob(actor: AuthContext, jobId: string): Promise<unknown>;
  listAiSessions(actor: AuthContext): Promise<unknown>;
  getAiSessionMessages(actor: AuthContext, sessionId: string): Promise<unknown>;
  getSchoolBillingOverview(actor: AuthContext): Promise<unknown>;
  adminListSubscriptions(actor: AuthContext): Promise<unknown>;
  adminUpdateSubscription(actor: AuthContext, schoolId: string, input: UpdateSubscriptionInput, idempotencyKey: string): Promise<unknown>;
  adminRecordBillingEvent(actor: AuthContext, schoolId: string, input: RecordBillingEventInput, idempotencyKey: string): Promise<unknown>;
  adminListBillingEvents(actor: AuthContext, schoolId: string): Promise<unknown>;
  getRiasecQuestions(actor: AuthContext): Promise<unknown>;
  getExtracurricularQuestions(actor: AuthContext): Promise<unknown>;
  listExamBlocks(actor: AuthContext): Promise<unknown>;
  saveExtracurricularAssessment(actor: AuthContext, answers: Record<string, string>, idempotencyKey: string): Promise<unknown>;
  listExamRecords(actor: AuthContext): Promise<unknown>;
  upsertExamRecords(actor: AuthContext, records: ExamRecordInput[], idempotencyKey: string): Promise<unknown>;
  rankSchools(actor: AuthContext, input: RankSchoolsInput): Promise<unknown>;
  analyzeCareer(actor: AuthContext, input: CareerAnalyzeInput, idempotencyKey: string, requestId?: string): Promise<unknown>;
  listCareerAnalysisRuns(actor: AuthContext): Promise<unknown>;
  listCareerAgents(actor: AuthContext): Promise<unknown>;
  listOpenExams(actor: AuthContext): Promise<unknown>;
  startExamSession(actor: AuthContext, input: StartExamSessionInput, idempotencyKey: string): Promise<unknown>;
  getExamSession(actor: AuthContext, sessionId: string): Promise<unknown>;
  saveExamAnswers(actor: AuthContext, input: SaveExamAnswersInput, idempotencyKey: string): Promise<unknown>;
  heartbeatExamSession(actor: AuthContext, sessionId: string, idempotencyKey: string): Promise<unknown>;
  issueExamAttachmentExemption(actor: AuthContext, sessionId: string, idempotencyKey: string): Promise<ExamAttachmentExemption>;
  consumeExamAttachmentExemption(actor: AuthContext, sessionId: string, token: string, idempotencyKey: string): Promise<{ authorized: boolean }>;
  logExamIntegrity(actor: AuthContext, input: ExamIntegrityInput, idempotencyKey: string): Promise<unknown>;
  restoreExamIncident(actor: AuthContext, sessionId: string, incidentId: string, idempotencyKey: string): Promise<unknown>;
  closeExamIncident(actor: AuthContext, sessionId: string, input: { incidentId: string; reason: string }, idempotencyKey: string): Promise<unknown>;
  unlockExamSession(actor: AuthContext, sessionId: string, reason: string, idempotencyKey: string): Promise<unknown>;
  submitExamSession(actor: AuthContext, sessionId: string, idempotencyKey: string): Promise<unknown>;
  listExamIntegrity(actor: AuthContext, assignmentId: string): Promise<unknown>;
  listClassMessages(actor: AuthContext, input: ListClassMessagesInput): Promise<unknown>;
  sendClassMessage(actor: AuthContext, input: SendClassMessageInput, idempotencyKey: string): Promise<unknown>;
  getHomeroomChannel(actor: AuthContext): Promise<unknown>;
  listTranscripts(actor: AuthContext, userId?: string): Promise<unknown>;
  upsertTranscript(actor: AuthContext, input: UpsertTranscriptInput, idempotencyKey: string): Promise<unknown>;
  getKnowledgeCard(actor: AuthContext, userId?: string): Promise<unknown>;
  updateKnowledgeCard(actor: AuthContext, input: UpdateKnowledgeCardInput, idempotencyKey: string): Promise<unknown>;
  getMyLearningSummary(actor: AuthContext): Promise<unknown>;
  listSkillSuggestions(actor: AuthContext, studentId?: string): Promise<unknown>;
  createSkillSuggestion(actor: AuthContext, input: CreateSkillSuggestionInput, idempotencyKey: string): Promise<unknown>;
  reviewSkillSuggestion(actor: AuthContext, suggestionId: string, input: ReviewSkillSuggestionInput, idempotencyKey: string): Promise<unknown>;
  listProctoredExams(actor: AuthContext): Promise<unknown>;
  assignExamProctor(actor: AuthContext, input: AssignExamProctorInput, idempotencyKey: string): Promise<unknown>;
  getInternalStudentRecord(studentCode: string): Promise<unknown>;
  close?(): Promise<void>;
}
