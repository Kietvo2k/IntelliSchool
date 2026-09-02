import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import type { Readable } from 'node:stream';
import { AppError } from './errors.js';
import { CAREER_AGENT_TYPES } from './services/ai/career-orchestrator.js';
import { studentRecordsHmacMatches } from './domain/records/hmac.js';
import { PostgresAuthRepository } from './repositories/postgres-auth.js';
import type { CreateQuestionInput, PlatformRepository, RequestReportExportInput, UpdateLessonInput, UpdateQuestionInput } from './repositories/platform.js';
import type { SchoolAdministrationRepository } from './repositories/school-administration.js';
import type { AuthContext, Role } from './types.js';
import type { ResourceUploadService } from './services/resource-upload-service.js';
import type { ResourceDownloadService } from './services/resource-download-service.js';
import type { ReportExportDownloadService } from './services/report-export-download-service.js';
import { parseQuestionImport } from './services/question-import.js';

const sessionCookieName = 'smartpath_session';
const allowedWebOrigins = new Set((process.env.ALLOWED_WEB_ORIGINS ?? 'http://127.0.0.1:5176,http://127.0.0.1:5177').split(',').map((origin) => origin.trim()).filter(Boolean));
const schoolRequestSchema = z.object({ schoolName: z.string().trim().min(3).max(160), principalName: z.string().trim().min(3).max(120), principalEmail: z.string().trim().email().max(254), province: z.string().trim().min(2).max(100) });
const reviewSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(12).max(128) });
const tokenPasswordSchema = z.object({ token: z.string().trim().min(32).max(512), newPassword: z.string().min(12).max(128) });
const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(254) });
const registrationRequestSchema = z.object({ schoolCode: z.string().trim().regex(/^SP-[A-Z0-9]{8}$/), displayName: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), requestedRole: z.enum(['TEACHER', 'STUDENT']) });
const registrationReviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().min(3).max(2000).optional() }).superRefine((value, context) => {
  if (value.decision === 'REJECTED' && !value.reason) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cần nêu lý do từ chối.', path: ['reason'] });
});
const paginationQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
const lessonBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string().trim().min(1).max(2_000), level: z.union([z.literal(2), z.literal(3)]) }),
  z.object({ type: z.literal('paragraph'), text: z.string().trim().min(1).max(10_000) }),
  z.object({ type: z.literal('bullets'), items: z.array(z.string().trim().min(1).max(1_000)).min(1).max(100) }),
  z.object({ type: z.literal('resource'), resourceId: z.string().uuid() }),
  z.object({ type: z.literal('formula'), latex: z.string().trim().min(1).max(4_000) }),
  z.object({ type: z.literal('html'), html: z.string().trim().min(1).max(50_000) }),
  z.object({ type: z.literal('video_url'), url: z.string().url().max(2048) }),
]);
const lessonContentSchema = z.object({
  blocks: z.array(lessonBlockSchema).max(200),
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  video: z.object({
    url: z.string().url().max(2048).optional(),
    resourceId: z.string().uuid().optional(),
    provider: z.enum(['YOUTUBE', 'VIMEO', 'UPLOAD']).optional(),
  }).optional(),
});
const lessonSchema = z.object({ classId: z.string().uuid(), subjectId: z.string().uuid(), title: z.string().trim().min(3).max(200), content: lessonContentSchema, publish: z.boolean().default(false) });
const lessonUpdateSchema = z.object({ title: z.string().trim().min(3).max(200), content: lessonContentSchema });
const listLessonsQuerySchema = z.object({ classId: z.string().uuid(), subjectId: z.string().uuid().optional(), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional() });
const lessonProgressSchema = z.object({ status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']) });
const submissionSchema = z.object({ answers: z.array(z.object({ assignmentItemId: z.string().uuid(), answer: z.record(z.unknown()) })).min(1).max(200) });
const riasecSchema = z.object({ answers: z.record(z.number().int().min(1).max(5)).refine((answers) => Object.keys(answers).length > 0, 'At least one answer is required') });
const offlineEventsSchema = z.object({ events: z.array(z.object({ clientEventId: z.string().trim().min(8).max(200), kind: z.string().trim().min(1).max(100), occurredAt: z.string().datetime(), payload: z.record(z.unknown()) })).min(1).max(100) });
const crawlJobSchema = z.object({ url: z.string().url().max(2048) });
const createClassSchema = z.object({ code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(120), gradeLevel: z.number().int().min(10).max(12), schoolYear: z.string().trim().min(4).max(24) });
const assignClassTeacherSchema = z.object({ classId: z.string().uuid(), teacherId: z.string().uuid(), subjectId: z.string().uuid().nullable(), role: z.enum(['SUBJECT_TEACHER', 'HOMEROOM_TEACHER']) }).refine((value) => (value.role === 'SUBJECT_TEACHER' ? value.subjectId !== null : value.subjectId === null), 'Giáo viên bộ môn cần chọn môn học; giáo viên chủ nhiệm không chọn môn học.');
const enrollStudentSchema = z.object({ classId: z.string().uuid(), studentId: z.string().uuid() });
const createStudentSchema = z.object({ displayName: z.string().trim().min(3).max(120), email: z.string().trim().email().max(254) });
const inviteTeacherSchema = z.object({ displayName: z.string().trim().min(3).max(120), email: z.string().trim().email().max(254) });
const acceptInvitationSchema = z.object({ token: z.string().trim().min(16).max(400), newPassword: z.string().min(12).max(128) });
const updateProfileSchema = z.object({ displayName: z.string().trim().min(1).max(120).optional(), avatarObjectKey: z.string().trim().max(500).nullable().optional(), email: z.string().trim().email().max(254).optional() }).refine((value) => Object.keys(value).length > 0, 'Cần ít nhất một trường để cập nhật hồ sơ.');
const transcriptSchema = z.object({
  userId: z.string().uuid().optional(),
  term: z.string().trim().min(2).max(32),
  subjectCode: z.string().trim().min(2).max(16),
  score: z.number().min(0).max(10),
  source: z.enum(['STUDENT', 'SCHOOL', 'PORTAL']),
});
const knowledgeCardSchema = z.object({ userId: z.string().uuid().optional(), freeText: z.string().max(800) });
const createQuestionBankSchema = z.object({ subjectId: z.string().uuid(), name: z.string().trim().min(3).max(160) });
const questionBaseSchema = z.object({ bankId: z.string().uuid(), maxScore: z.number().positive().max(1000) });
const questionTextSchema = z.string().trim().min(1).max(10_000);
const questionRubricSchema = z.object({
  criteria: z.array(z.object({
    label: z.string().trim().min(1).max(240),
    maxScore: z.number().positive().max(1000),
    description: z.string().trim().max(2_000).optional(),
  })).min(1).max(30),
});
const createQuestionSchema = z.union([
  questionBaseSchema.extend({
    type: z.literal('MULTIPLE_CHOICE'),
    prompt: z.object({ text: questionTextSchema, choices: z.array(questionTextSchema).min(2).max(10), passage: questionTextSchema.optional(), imageResourceId: z.string().uuid().optional(), imageUrl: z.string().trim().max(4000).optional(), imageSvg: z.string().trim().max(20_000).optional() }),
    answerKey: z.object({ choice: questionTextSchema }),
    rubric: z.record(z.unknown()).default({}),
  }).superRefine((value, context) => {
    const normalizedChoices = value.prompt.choices.map((choice) => choice.toLocaleLowerCase('vi-VN'));
    if (new Set(normalizedChoices).size !== normalizedChoices.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['prompt', 'choices'], message: 'Các lựa chọn không được trùng nhau.' });
    if (!value.prompt.choices.includes(value.answerKey.choice)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['answerKey', 'choice'], message: 'Đáp án đúng phải là một trong các lựa chọn.' });
  }),
  questionBaseSchema.extend({
    type: z.literal('TRUE_FALSE'),
    prompt: z.object({
      stem: questionTextSchema.optional(),
      text: questionTextSchema.optional(),
      passage: questionTextSchema.optional(),
      imageResourceId: z.string().uuid().optional(),
      imageUrl: z.string().trim().max(4000).optional(),
      imageSvg: z.string().trim().max(20_000).optional(),
      statements: z.array(z.object({ key: z.enum(['a', 'b', 'c', 'd']), text: questionTextSchema })).length(4),
    }),
    answerKey: z.object({ values: z.object({ a: z.boolean(), b: z.boolean(), c: z.boolean(), d: z.boolean() }) }),
    rubric: z.record(z.unknown()).default({}),
  }).superRefine((value, context) => {
    const keys = value.prompt.statements.map((item) => item.key);
    if (new Set(keys).size !== 4) context.addIssue({ code: z.ZodIssueCode.custom, path: ['prompt', 'statements'], message: 'Đúng/sai cần đủ bốn ý a, b, c, d.' });
  }),
  questionBaseSchema.extend({
    type: z.literal('SHORT_ANSWER'),
    prompt: z.object({ text: questionTextSchema, passage: questionTextSchema.optional(), unit: z.string().trim().max(40).optional(), imageResourceId: z.string().uuid().optional(), imageUrl: z.string().trim().max(4000).optional(), imageSvg: z.string().trim().max(20_000).optional() }),
    answerKey: z.object({
      numeric: z.string().trim().max(80).optional(),
      tolerance: z.number().min(0).max(1).optional(),
      acceptable: z.array(questionTextSchema).max(30).optional(),
    }),
    rubric: z.record(z.unknown()).default({}),
  }).superRefine((value, context) => {
    const numeric = value.answerKey.numeric?.trim() ?? '';
    const acceptable = value.answerKey.acceptable ?? [];
    if (!numeric && acceptable.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['answerKey'], message: 'Câu trả lời ngắn cần đáp án số hoặc danh sách chấp nhận.' });
  }),
  questionBaseSchema.extend({
    type: z.literal('ESSAY'),
    prompt: z.object({ text: questionTextSchema, passage: questionTextSchema.optional(), imageResourceId: z.string().uuid().optional(), imageUrl: z.string().trim().max(4000).optional(), imageSvg: z.string().trim().max(20_000).optional() }),
    answerKey: z.record(z.unknown()).default({}),
    rubric: questionRubricSchema,
  }).superRefine((value, context) => {
    const total = value.rubric.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
    if (total > value.maxScore) context.addIssue({ code: z.ZodIssueCode.custom, path: ['rubric', 'criteria'], message: 'Tổng điểm rubric không được vượt quá điểm tối đa của câu hỏi.' });
  }),
]);
const createAssignmentSchema = z.object({ classId: z.string().uuid(), subjectId: z.string().uuid(), title: z.string().trim().min(3).max(200), instructions: z.string().trim().max(10000).default(''), dueAt: z.string().datetime().nullable().default(null), maxAttempts: z.number().int().min(1).max(10).default(1), gradingPolicy: z.enum(['HIGHEST', 'LATEST', 'AVERAGE']).default('HIGHEST'), items: z.array(z.object({ questionVersionId: z.string().uuid(), position: z.number().int().positive(), points: z.number().positive().max(1000) })).min(1).max(100), deliveryMode: z.enum(['HOMEWORK', 'EXAM']).default('HOMEWORK'), durationMinutes: z.number().int().min(1).max(300).nullable().optional(), examPin: z.string().trim().min(6).max(64).nullable().optional(), showScoreOnSubmit: z.boolean().default(true), examPeriod: z.enum(['PRACTICE', 'MIDTERM_1', 'FINAL_1', 'MIDTERM_2', 'FINAL_2', 'MOCK_GRADUATION', 'OTHER']).default('PRACTICE'), integrityMode: z.enum(['PRACTICE', 'STRICT_WEB']).optional() });
const gradeEssaySchema = z.object({ score: z.number().min(0).max(1000), feedback: z.string().trim().max(10000).default('') });
const returnAttemptSchema = z.object({ overallFeedback: z.string().trim().max(10000).default('') });
const gradebookQuerySchema = z.object({ classId: z.string().uuid(), subjectId: z.string().uuid().optional(), studentId: z.string().uuid().optional() });
const gradebookOverrideSchema = z.object({ score: z.number().min(0).max(1000), reason: z.string().trim().min(8).max(2000) });
const reportExportSchema = z.object({ kind: z.enum(['GRADEBOOK', 'PROGRESS']), format: z.enum(['CSV', 'XLSX']), classId: z.string().uuid(), subjectId: z.string().uuid().optional(), studentId: z.string().uuid().optional() });
const listAssignmentsQuerySchema = z.object({ classId: z.string().uuid(), subjectId: z.string().uuid().optional() });
const listQuestionBanksQuerySchema = z.object({ subjectId: z.string().uuid() });
const listQuestionsQuerySchema = z.object({ bankId: z.string().uuid(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional(), type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY']).optional(), approval: z.enum(['APPROVED', 'PENDING']).optional(), query: z.string().trim().min(1).max(200).optional() });
const listResourcesQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), classId: z.string().uuid().optional(), subjectId: z.string().uuid().optional(), status: z.enum(['QUARANTINED', 'PROCESSING', 'READY', 'REJECTED']).optional() });
const listStudentsQuerySchema = z.object({ classId: z.string().uuid().optional() });
const adminUsersQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), schoolId: z.string().uuid().optional(), role: z.enum(['PLATFORM_ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT']).optional(), status: z.enum(['ACTIVE', 'INACTIVE']).optional() });
const adminAuditQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), actorId: z.string().uuid().optional(), action: z.string().trim().min(1).max(120).optional(), schoolId: z.string().uuid().optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() });
const adminUserStatusSchema = z.object({ isActive: z.boolean() });
const invitePlatformAdminSchema = z.object({ email: z.string().trim().email().max(254), displayName: z.string().trim().min(1).max(120) });
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const skillCodeSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/, 'Mã kỹ năng không hợp lệ.');
const skillGraphDefinitionSchema = z.object({
  skills: z.array(z.object({ code: skillCodeSchema, name: z.string().trim().min(1).max(200), description: z.string().trim().max(2000).optional() })).min(1).max(500),
  edges: z.array(z.object({ prerequisite: skillCodeSchema, skill: skillCodeSchema })).max(2000).default([]),
});
const createSkillGraphSchema = z.object({ subjectId: z.string().uuid(), title: z.string().trim().min(3).max(200), definition: skillGraphDefinitionSchema });
const updateSkillGraphSchema = z.object({ title: z.string().trim().min(3).max(200), definition: skillGraphDefinitionSchema });
const reviewSkillGraphSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().min(3).max(2000).optional() }).superRefine((value, context) => {
  if (value.decision === 'REJECTED' && !value.reason) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cần nêu lý do từ chối.', path: ['reason'] });
});
const mapSkillItemsSchema = z.object({ questionVersionId: z.string().uuid(), skills: z.array(z.object({ skillCode: skillCodeSchema, weight: z.number().positive().max(1) })).max(50).default([]) });
const listSkillGraphsQuerySchema = z.object({ subjectId: z.string().uuid().optional() });
const adaptiveDiagnosesQuerySchema = z.object({ classId: z.string().uuid(), subjectId: z.string().uuid() });
const overrideAdaptiveSchema = z.object({ studentId: z.string().uuid(), subjectId: z.string().uuid(), decision: z.enum(['CONFIRM', 'DISMISS']), reason: z.string().trim().min(3).max(2000) });
const catalogCodeSchema = z.string().trim().regex(/^[A-Z0-9_-]{2,64}$/, 'Mã danh mục không hợp lệ.');
const listInstitutionsQuerySchema = z.object({ province: z.string().trim().min(1).max(100).optional(), query: z.string().trim().min(1).max(200).optional() });
const upsertCareerSchema = z.object({ code: catalogCodeSchema, name: z.string().trim().min(2).max(160), description: z.string().trim().max(4000).optional(), riasecWeights: z.record(z.number()).optional() });
const upsertMajorSchema = z.object({ code: catalogCodeSchema, name: z.string().trim().min(2).max(160), careerCode: catalogCodeSchema.nullable().optional() });
const upsertInstitutionSchema = z.object({ code: catalogCodeSchema, name: z.string().trim().min(2).max(240), province: z.string().trim().max(100).optional(), type: z.string().trim().max(60).optional(), description: z.string().trim().max(4000).optional(), website: z.string().trim().url().max(400).optional(), admissionMethod: z.string().trim().max(2000).optional() });
const importAdmissionScoresSchema = z.object({ rows: z.array(z.object({ institutionCode: catalogCodeSchema, majorCode: catalogCodeSchema, programCode: z.string().trim().max(64).nullable().optional(), year: z.number().int().min(2020).max(2100), examBlock: z.string().trim().regex(/^[A-Z][0-9]{2}$/), score: z.number().min(0).max(100), sourceUrl: z.string().trim().url().max(2048).nullable().optional() })).min(1).max(1000) });
const upsertScholarshipSchema = z.object({ institutionCode: catalogCodeSchema.nullable().optional(), title: z.string().trim().min(3).max(240), criteria: z.record(z.unknown()).default({}), deadlineAt: z.string().datetime().nullable().optional(), sourceUrl: z.string().trim().url().max(2048).nullable().optional() });
const aptitudeAnswerSchema = z.record(z.union([z.number(), z.string().max(800)]));
const aptitudeSchema = z.object({ answers: aptitudeAnswerSchema.refine((answers) => Object.keys(answers).length > 0, 'Cần ít nhất một câu trả lời.'), skippedIds: z.array(z.string().trim().min(1).max(40)).max(20).default([]) });
const aptitudeDraftSchema = z.object({ version: z.string().trim().min(1).max(32), answers: aptitudeAnswerSchema, skippedIds: z.array(z.string().trim().min(1).max(40)).max(20), currentIndex: z.number().int().min(0).max(19) });
const updateCareerProfileSchema = z.object({
  province: z.string().trim().max(100).optional(),
  tuitionBudgetVnd: z.number().int().min(0).max(1_000_000_000).optional(),
  householdIncomeVnd: z.number().int().min(0).max(1_000_000_000).optional(),
  subjectScores: z.record(z.number().min(0).max(10)).optional(),
  classroomGrades: z.record(z.number().min(0).max(10)).optional(),
  chosenBlocks: z.array(z.string().trim().regex(/^[A-Z][0-9]{2}$/)).max(12).optional(),
  chosenSubjects: z.array(z.string().trim().regex(/^[A-Z0-9_-]{2,16}$/)).max(20).optional(),
  priorities: z.record(z.number().min(0).max(5)).optional(),
  studyGoal: z.string().trim().max(240).optional(),
  studyGoalType: z.enum(['career', 'school', 'undecided']).optional(),
  preferredStudyRegion: z.enum(['near_home', 'same_region', 'nationwide']).optional(),
  preferredSchoolType: z.enum(['any', 'public', 'private', 'international']).optional(),
  schoolPriority: z.record(z.number().min(1).max(5)).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Cần ít nhất một trường để cập nhật.');
const shareGrantSchema = z.object({ scope: z.enum(['PROFILE', 'RESULTS', 'FULL']), granted: z.boolean() });
const admissionProbabilitySchema = z.object({ institutionMajorId: z.string().uuid(), priorityBonus: z.number().min(0).max(2.75).optional() });
const addAspirationSchema = z.object({ institutionMajorId: z.string().uuid(), note: z.string().trim().max(500).optional() });
const reorderAspirationsSchema = z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(50) });
const addSavedItemSchema = z.object({ itemType: z.enum(['CAREER', 'MAJOR', 'INSTITUTION', 'SCHOLARSHIP']), itemId: z.string().uuid() });
const addGoalSchema = z.object({ title: z.string().trim().min(3).max(240), targetAt: z.string().datetime().nullable().optional() });
const addReminderSchema = z.object({ goalId: z.string().uuid().nullable().optional(), dueAt: z.string().datetime(), message: z.string().trim().min(1).max(500) });
const upsertAiModelSchema = z.object({ id: z.string().uuid().optional(), provider: z.string().trim().min(2).max(80), modelName: z.string().trim().min(2).max(160), tier: z.enum(['LOCAL_FAST', 'LOCAL_QUALITY', 'CLOUD']), endpointUrl: z.string().trim().url().max(400).nullable().optional(), isEnabled: z.boolean(), monthlyCostLimitVnd: z.number().int().min(0).max(100_000_000_000).nullable().optional(), inputVndPer1k: z.number().int().min(0).max(1_000_000).optional(), outputVndPer1k: z.number().int().min(0).max(1_000_000).optional() });
const ingestRagSchema = z.object({ sourceKind: z.enum(['LESSON', 'TEXT']), title: z.string().trim().min(3).max(200), lessonId: z.string().uuid().nullable().optional(), text: z.string().trim().max(50_000).nullable().optional(), classId: z.string().uuid().nullable().optional(), subjectId: z.string().uuid().nullable().optional() });
const searchRagSchema = z.object({ query: z.string().trim().min(1).max(500), classId: z.string().uuid().nullable().optional(), subjectId: z.string().uuid().nullable().optional(), topK: z.number().int().min(1).max(20).optional(), sourceMode: z.enum(['AUTO', 'SCHOOL_LIBRARY', 'MY_UPLOADS', 'SELECTED']).default('AUTO') });
const aiChatSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(4000),
  classId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  purpose: z.enum(['ASSISTANT', 'TEACHER_COMPOSE', 'PERSONAL_STUDY', 'CAREER_CHAT', 'EXTRACURRICULAR_INTERVIEW']).optional(),
  documentIds: z.array(z.string().uuid()).max(20).optional(),
  lessonIds: z.array(z.string().uuid()).max(20).optional(),
  runCode: z.boolean().optional(),
  reasoningMode: z.enum(['STANDARD', 'THINKING']).default('STANDARD'),
  agentic: z.boolean().default(false),
  sourceMode: z.enum(['AUTO', 'SCHOOL_LIBRARY', 'MY_UPLOADS', 'SELECTED']).default('AUTO'),
  attachmentResourceIds: z.array(z.string().uuid()).max(10).default([]),
});
const updateSubscriptionSchema = z.object({ status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED']), includedClassQuota: z.number().int().min(0).max(100000), basePriceVnd: z.number().int().min(0).max(1_000_000_000_000), extraClassPriceVnd: z.number().int().min(0).max(1_000_000_000_000), trialEndsAt: z.string().datetime().nullable().optional(), manualOverrideReason: z.string().trim().max(500).nullable().optional() });
const recordBillingEventSchema = z.object({ kind: z.string().trim().min(2).max(100), amountVnd: z.number().int().min(0).max(1_000_000_000_000), note: z.string().trim().max(500).optional() });
const extraSchema = z.object({ answers: z.record(z.string().max(2000)).refine((answers) => Object.keys(answers).length > 0, 'Cần ít nhất một câu trả lời.') });
const examRecordsSchema = z.object({ records: z.array(z.object({ subjectCode: z.string().trim().min(2).max(16), score: z.number().min(0).max(10), year: z.number().int().min(2020).max(2100), source: z.enum(['CLASSROOM', 'GRADUATION']) })).min(1).max(40) });
const rankSchoolsQuerySchema = z.object({ province: z.string().trim().min(1).max(100).optional(), query: z.string().trim().min(1).max(200).optional(), examBlock: z.string().trim().regex(/^[A-Z][0-9]{2}$/).optional(), majorCode: catalogCodeSchema.optional() });
const careerAnalyzeSchema = z.object({
  agentTypes: z.array(z.string().trim().min(2).max(40)).max(10).optional(),
  targetMajor: z.string().trim().max(160).optional(),
  message: z.string().trim().max(4000).optional(),
  compareMajors: z.array(z.string().trim().min(2).max(160)).min(2).max(3).optional(),
  mode: z.enum(['analyze', 'post_quiz', 'compare']).optional(),
  academicScores: z.record(z.number().min(0).max(10)).optional(),
}).superRefine((value, context) => {
  const unknown = (value.agentTypes ?? []).filter((item) => !(CAREER_AGENT_TYPES as readonly string[]).includes(item));
  if (unknown.length > 0) context.addIssue({ code: z.ZodIssueCode.custom, message: `Tác vụ không hợp lệ: ${unknown.join(', ')}`, path: ['agentTypes'] });
  if (value.mode === 'compare' && (value.compareMajors?.length ?? 0) < 2) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'So sánh cần 2–3 ngành.', path: ['compareMajors'] });
  }
});
const classMessageSchema = z.object({
  classId: z.string().uuid(),
  recipientId: z.string().uuid().nullable().optional(),
  channelKind: z.enum(['CLASS', 'DIRECT']).default('DIRECT'),
  body: z.string().trim().min(1).max(4000),
}).superRefine((value, context) => {
  if (value.channelKind === 'DIRECT' && !value.recipientId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['recipientId'], message: 'Tin nhắn trực tiếp cần người nhận.' });
});
const listMessagesQuerySchema = z.object({
  classId: z.string().uuid(),
  peerId: z.string().uuid().optional(),
  channelKind: z.enum(['CLASS', 'DIRECT']).default('DIRECT'),
});
const createSkillSuggestionSchema = z.object({ studentId: z.string().uuid().optional(), subjectId: z.string().uuid().nullable().optional() });
const reviewSkillSuggestionSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().max(2000).optional() });
const assignProctorSchema = z.object({ assignmentId: z.string().uuid(), userId: z.string().uuid() });
const startExamSchema = z.object({ assignmentId: z.string().uuid(), studentCode: z.string().trim().min(4).max(40), pin: z.string().trim().min(6).max(64) });
const saveExamSchema = z.object({ sessionId: z.string().uuid(), answers: z.array(z.object({ assignmentItemId: z.string().uuid(), answer: z.record(z.unknown()) })).min(1).max(200) });
const examIntegritySchema = z.object({
  sessionId: z.string().uuid(),
  kind: z.enum(['visibilitychange', 'blur', 'fullscreen_exit', 'network_loss', 'heartbeat_timeout', 'clipboard', 'contextmenu', 'devtools']),
  payload: z.record(z.unknown()).optional(),
  exemptionToken: z.string().trim().min(32).max(512).optional(),
});
const examIncidentRestoreSchema = z.object({ incidentId: z.string().uuid() });
const examIncidentCloseSchema = z.object({ incidentId: z.string().uuid(), reason: z.string().trim().min(3).max(2000) });
const examUnlockSchema = z.object({ reason: z.string().trim().min(3).max(2000) });
const contributionReviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), scope: z.enum(['CLASS', 'SCHOOL']).default('SCHOOL'), reason: z.string().trim().max(2000).optional() });

interface ResourceListRepository {
  list(actor: AuthContext, input: { page: number; pageSize: number; classId?: string; subjectId?: string; status?: 'QUARANTINED' | 'PROCESSING' | 'READY' | 'REJECTED' }): Promise<unknown>;
  requestContribution(actor: AuthContext, resourceId: string, idempotencyKey: string): Promise<unknown>;
  reviewContribution(actor: AuthContext, resourceId: string, input: { decision: 'APPROVED' | 'REJECTED'; scope: 'CLASS' | 'SCHOOL'; reason?: string }, idempotencyKey: string): Promise<unknown>;
}

export interface BuildAppOptions { authRepository?: PostgresAuthRepository; schoolAdministrationRepository?: SchoolAdministrationRepository; platformRepository?: PlatformRepository; resourceRepository?: ResourceListRepository; resourceUploadService?: Pick<ResourceUploadService, 'upload'>; resourceDownloadService?: Pick<ResourceDownloadService, 'getDownload'> & Partial<Pick<ResourceDownloadService, 'getFile'>>; reportExportDownloadService?: Pick<ReportExportDownloadService, 'getDownload'> & Partial<Pick<ReportExportDownloadService, 'getFile'>>; openSignedFile?: (token: string) => Promise<{ stream: Readable; mimeType: string; filename: string }>; }

function errorBody(request: FastifyRequest, code: string, message: string) { return { error: { code, message, request_id: request.id } }; }
function isAiRoute(request: FastifyRequest): boolean { return request.url.startsWith('/api/v1/ai/'); }
function writeAiOperationalLog(event: 'ai_request_finished' | 'ai_request_failed', request: FastifyRequest, fields: Record<string, unknown>): void {
  const entry = JSON.stringify({
    event,
    requestId: request.id,
    method: request.method,
    route: request.routeOptions.url ?? request.url.split('?')[0],
    ...fields,
  });
  if (event === 'ai_request_failed') console.error(entry);
  else console.info(entry);
}
function requestOriginIsAllowed(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  return typeof origin !== 'string' || allowedWebOrigins.has(origin);
}
function headerValue(value: string | string[] | undefined): string | undefined { return typeof value === 'string' ? value : undefined; }
function multipartFieldValue(fields: unknown, key: string): string | undefined {
  const candidate = (fields as Record<string, unknown> | undefined)?.[key];
  const field = Array.isArray(candidate) ? candidate[0] : candidate;
  return field && typeof field === 'object' && 'value' in field && typeof (field as { value?: unknown }).value === 'string'
    ? (field as { value: string }).value
    : undefined;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false, genReqId: () => crypto.randomUUID() });
  const aiRequestStartedAt = new WeakMap<FastifyRequest, number>();
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieSecure = process.env.COOKIE_SECURE === 'true' || (isProduction && process.env.COOKIE_SECURE !== 'false');
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? (isProduction ? 100 : 1_000));
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    if (isAiRoute(request)) aiRequestStartedAt.set(request, Date.now());
  });
  app.addHook('onResponse', async (request, reply) => {
    const startedAt = aiRequestStartedAt.get(request);
    if (startedAt !== undefined) writeAiOperationalLog('ai_request_finished', request, { statusCode: reply.statusCode, durationMs: Date.now() - startedAt });
  });
  void app.register(cookie);
  void app.register(cors, {
    credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: (origin, callback) => (!origin || allowedWebOrigins.has(origin) ? callback(null, true) : callback(new Error('Origin is not allowed by CORS policy.'), false)),
  });
  void app.register(helmet, { contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } });
  void app.register(rateLimit, { max: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 1_000, timeWindow: '1 minute' });
  void app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 4 } });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      if (isAiRoute(request)) writeAiOperationalLog('ai_request_failed', request, { statusCode: error.statusCode, code: error.code, retryable: error.retryable });
      return reply.code(error.statusCode).send(errorBody(request, error.code, error.message));
    }
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : 500;
    if (statusCode >= 400 && statusCode < 500) {
      const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'REQUEST_ERROR';
      const message = error instanceof Error && error.message.trim() ? error.message : 'Yêu cầu không hợp lệ.';
      if (isAiRoute(request)) writeAiOperationalLog('ai_request_failed', request, { statusCode, code, retryable: false });
      return reply.code(statusCode).send(errorBody(request, code, message));
    }
    if (isAiRoute(request)) writeAiOperationalLog('ai_request_failed', request, { statusCode: 500, code: 'INTERNAL_ERROR', retryable: false });
    else console.error({ requestId: request.id, code: 'INTERNAL_ERROR' });
    return reply.code(500).send(errorBody(request, 'INTERNAL_ERROR', 'Hệ thống gặp lỗi không mong muốn. Vui lòng thử lại.'));
  });

  async function currentAuth(request: FastifyRequest): Promise<AuthContext | null> {
    const token = request.cookies[sessionCookieName];
    if (!token || !options.authRepository) return null;
    return options.authRepository.getSession(token);
  }
  async function requireRole(request: FastifyRequest, allowed: Role[]): Promise<AuthContext | null> {
    const auth = await currentAuth(request);
    return auth && allowed.includes(auth.role) ? auth : null;
  }
  async function requireAuthenticated(request: FastifyRequest, reply: FastifyReply): Promise<AuthContext | null> {
    const auth = await currentAuth(request);
    if (!auth) {
      reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Bạn cần đăng nhập để tiếp tục.'));
      return null;
    }
    return auth;
  }
  async function requirePlatformRole(request: FastifyRequest, reply: FastifyReply, allowed: Role[]): Promise<AuthContext | null> {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return null;
    if (!allowed.includes(auth.role)) {
      reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'));
      return null;
    }
    return auth;
  }
  function requireIdempotencyKey(request: FastifyRequest, reply: FastifyReply): string | null {
    const parsed = idempotencyKeySchema.safeParse(headerValue(request.headers['x-idempotency-key']));
    if (!parsed.success) {
      reply.code(400).send(errorBody(request, 'IDEMPOTENCY_KEY_REQUIRED', 'Thao tác này cần X-Idempotency-Key hợp lệ.'));
      return null;
    }
    return parsed.data;
  }
  function requirePlatformRepository(request: FastifyRequest, reply: FastifyReply): PlatformRepository | null {
    if (options.platformRepository) return options.platformRepository;
    reply.code(503).send(errorBody(request, 'PLATFORM_UNAVAILABLE', 'Dịch vụ nền tảng chưa sẵn sàng.'));
    return null;
  }
  function requireSchoolAdministrationRepository(request: FastifyRequest, reply: FastifyReply): SchoolAdministrationRepository | null {
    if (options.schoolAdministrationRepository) return options.schoolAdministrationRepository;
    reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    return null;
  }
  function requireResourceUploadService(request: FastifyRequest, reply: FastifyReply): Pick<ResourceUploadService, 'upload'> | null {
    if (options.resourceUploadService) return options.resourceUploadService;
    reply.code(503).send(errorBody(request, 'RESOURCE_UNAVAILABLE', 'Dịch vụ tài nguyên chưa sẵn sàng.'));
    return null;
  }
  function requireResourceDownloadService(request: FastifyRequest, reply: FastifyReply): Pick<ResourceDownloadService, 'getDownload'> & Partial<Pick<ResourceDownloadService, 'getFile'>> | null {
    if (options.resourceDownloadService) return options.resourceDownloadService;
    reply.code(503).send(errorBody(request, 'RESOURCE_UNAVAILABLE', 'Dịch vụ tài nguyên chưa sẵn sàng.'));
    return null;
  }
  function requireResourceRepository(request: FastifyRequest, reply: FastifyReply): ResourceListRepository | null {
    if (options.resourceRepository) return options.resourceRepository;
    reply.code(503).send(errorBody(request, 'RESOURCE_UNAVAILABLE', 'Dịch vụ tài nguyên chưa sẵn sàng.'));
    return null;
  }
  function requireReportExportDownloadService(request: FastifyRequest, reply: FastifyReply): Pick<ReportExportDownloadService, 'getDownload'> & Partial<Pick<ReportExportDownloadService, 'getFile'>> | null {
    if (options.reportExportDownloadService) return options.reportExportDownloadService;
    reply.code(503).send(errorBody(request, 'REPORT_EXPORT_UNAVAILABLE', 'Dịch vụ tải export chưa sẵn sàng.'));
    return null;
  }
  function clearSession(reply: FastifyReply): void {
    reply.clearCookie(sessionCookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: cookieSecure });
  }

  app.get('/healthz', async () => ({ data: { status: 'ok', product: 'Smart Path Platform' } }));

  app.get('/api/v1/files/:token', async (request, reply) => {
    if (!options.openSignedFile) return reply.code(404).send(errorBody(request, 'NOT_FOUND', 'Không tìm thấy tệp.'));
    const token = (request.params as { token: string }).token;
    const file = await options.openSignedFile(token);
    reply.header('content-type', file.mimeType);
    reply.header('content-disposition', `attachment; filename="${file.filename.replaceAll(/[\r\n"]/g, '')}"`);
    return reply.send(file.stream);
  });

  app.post('/api/v1/auth/login', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Email hoặc mật khẩu không hợp lệ.'));
    if (!options.authRepository) return reply.code(503).send(errorBody(request, 'AUTH_UNAVAILABLE', 'Dịch vụ đăng nhập chưa sẵn sàng.'));
    const session = await options.authRepository.login(parsed.data.email, parsed.data.password);
    if (!session) return reply.code(401).send(errorBody(request, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.'));
    reply.setCookie(sessionCookieName, session.token, { path: '/', httpOnly: true, sameSite: 'lax', secure: cookieSecure, expires: session.expiresAt });
    return reply.send({ data: { user: session.user, expiresAt: session.expiresAt.toISOString() } });
  });

  app.post('/api/v1/auth/activate', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = tokenPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Liên kết kích hoạt hoặc mật khẩu không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    const accepted = await repository.acceptInvitation(parsed.data.token, parsed.data.newPassword);
    return reply.send({ data: { userId: accepted.userId, role: accepted.role, activated: true } });
  });

  app.post('/api/v1/auth/forgot-password', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Email không hợp lệ.'));
    // Keep this response neutral so email enumeration is not possible.
    if (options.authRepository) await options.authRepository.requestPasswordReset(parsed.data.email);
    return reply.send({ data: { accepted: true, message: 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.' } });
  });

  app.post('/api/v1/auth/reset-password', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = tokenPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Liên kết đặt lại hoặc mật khẩu không hợp lệ.'));
    if (!options.authRepository) return reply.code(503).send(errorBody(request, 'AUTH_UNAVAILABLE', 'Dịch vụ tài khoản chưa sẵn sàng.'));
    await options.authRepository.resetPassword(parsed.data.token, parsed.data.newPassword);
    return reply.send({ data: { reset: true } });
  });

  app.get('/api/v1/me/sessions', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const token = request.cookies[sessionCookieName];
    if (!token || !options.authRepository) return reply.code(503).send(errorBody(request, 'AUTH_UNAVAILABLE', 'Dịch vụ tài khoản chưa sẵn sàng.'));
    return reply.send({ data: await options.authRepository.listSessions(auth.userId, token) });
  });

  app.post('/api/v1/me/sessions/:id/revoke', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const sessionId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(sessionId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã phiên không hợp lệ.'));
    if (!options.authRepository) return reply.code(503).send(errorBody(request, 'AUTH_UNAVAILABLE', 'Dịch vụ tài khoản chưa sẵn sàng.'));
    await options.authRepository.revokeSessionById(auth.userId, sessionId, idempotencyKey);
    return reply.send({ data: { revoked: true, idempotencyKey } });
  });

  app.post('/api/v1/me/sessions/revoke-others', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const token = request.cookies[sessionCookieName];
    if (!token || !options.authRepository) return reply.code(503).send(errorBody(request, 'AUTH_UNAVAILABLE', 'Dịch vụ tài khoản chưa sẵn sàng.'));
    await options.authRepository.revokeOtherSessions(auth.userId, token, idempotencyKey);
    return reply.send({ data: { revokedOthers: true, idempotencyKey } });
  });

  app.get('/api/v1/auth/session', async (request, reply) => {
    const auth = await currentAuth(request);
    return reply.send({ data: { user: auth ?? null } });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookieName];
    if (token && options.authRepository) await options.authRepository.revokeSession(token);
    clearSession(reply);
    return reply.code(204).send();
  });

  app.post('/api/v1/public/school-requests', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (request, reply) => {
    const parsed = schoolRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin yêu cầu mở trường không hợp lệ.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    const createdRequest = await options.schoolAdministrationRepository.createSchoolRequest(parsed.data);
    return reply.code(createdRequest.duplicate ? 200 : 201).send({ data: createdRequest });
  });

  app.post('/api/v1/public/registration-requests', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = registrationRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin đăng ký không hợp lệ.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'REGISTRATION_UNAVAILABLE', 'Dịch vụ đăng ký chưa sẵn sàng.'));
    return reply.code(201).send({ data: await options.schoolAdministrationRepository.createRegistrationRequest(parsed.data) });
  });

  app.get('/api/v1/registrations', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    const parsed = paginationQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Phân trang không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listRegistrationRequests(auth, parsed.data.page, parsed.data.pageSize) });
  });

  app.post('/api/v1/registrations/:id/review', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const requestId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(requestId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã yêu cầu đăng ký không hợp lệ.'));
    const parsed = registrationReviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Quyết định duyệt không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.reviewRegistrationRequest(auth, requestId, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/admin/school-requests', async (request, reply) => {
    const auth = await requireRole(request, ['PLATFORM_ADMIN']);
    if (!auth) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền xem yêu cầu mở trường.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    return reply.send({ data: await options.schoolAdministrationRepository.listSchoolRequests() });
  });

  app.get('/api/v1/admin/users', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    const parsed = adminUsersQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Bộ lọc người dùng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listAdminUsers(auth, parsed.data) });
  });

  app.get('/api/v1/admin/schools', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    const parsed = paginationQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Phân trang trường học không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listAdminSchools(auth, parsed.data) });
  });
  app.get('/api/v1/admin/schools/export.csv', async (request, reply) => {
    const auth = await requireRole(request, ['PLATFORM_ADMIN']);
    if (!auth) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền tải danh sách trường.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    const rows = await repository.exportAdminSchools(auth);
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = '\uFEFF' + [['Mã trường', 'Tên trường', 'Hiệu trưởng', 'Email', 'Người dùng hoạt động', 'Ngày tạo'], ...rows.map((row) => [row.code, row.name, row.ownerName, row.ownerEmail, row.activeUserCount, row.createdAt])].map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n';
    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', `attachment; filename="smartpath-schools-${new Date().toISOString().slice(0, 10)}.csv"`);
    return reply.send(csv);
  });

  app.get('/api/v1/admin/schools/:schoolId', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    const schoolId = (request.params as { schoolId: string }).schoolId;
    if (!z.string().uuid().safeParse(schoolId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã trường không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getAdminSchool(auth, schoolId) });
  });

  app.get('/api/v1/admin/audit-events', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    const parsed = adminAuditQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Bộ lọc audit không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listAdminAuditEvents(auth, parsed.data) });
  });

  app.post('/api/v1/admin/platform-admins/invitations', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = invitePlatformAdminSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin mời admin nền tảng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.invitePlatformAdmin(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/users/:id/status', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const userId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(userId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã người dùng không hợp lệ.'));
    const parsed = adminUserStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Trạng thái tài khoản không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.setAdminUserStatus(auth, userId, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/users/:id/revoke-sessions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const userId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(userId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã người dùng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.revokeAdminUserSessions(auth, userId, idempotencyKey) });
  });

  app.post('/api/v1/admin/school-requests/:id/approve', async (request, reply) => {
    const auth = await requireRole(request, ['PLATFORM_ADMIN']);
    if (!auth) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền duyệt trường.'));
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Lý do duyệt không hợp lệ.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    const params = request.params as { id: string };
    const approved = await options.schoolAdministrationRepository.approveSchoolRequest(params.id, auth.userId, parsed.data.reason, idempotencyKey);
    if (!approved) return reply.code(409).send(errorBody(request, 'SCHOOL_REQUEST_NOT_PENDING', 'Yêu cầu không tồn tại hoặc đã được xử lý.'));
    return reply.send({ data: { status: approved.request.status, school: approved.school, activationEmailQueued: approved.activationEmailQueued ?? false } });
  });

  app.post('/api/v1/admin/school-requests/:id/reject', async (request, reply) => {
    const auth = await requireRole(request, ['PLATFORM_ADMIN']);
    if (!auth) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền từ chối trường.'));
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Lý do từ chối không hợp lệ.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    const params = request.params as { id: string };
    if (!z.string().uuid().safeParse(params.id).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã yêu cầu mở trường không hợp lệ.'));
    const rejected = await options.schoolAdministrationRepository.rejectSchoolRequest(params.id, auth.userId, parsed.data.reason, idempotencyKey);
    if (!rejected) return reply.code(409).send(errorBody(request, 'SCHOOL_REQUEST_NOT_PENDING', 'Yêu cầu không tồn tại hoặc đã được xử lý.'));
    return reply.send({ data: rejected });
  });
  app.post('/api/v1/admin/school-requests/:id/resend-activation', async (request, reply) => {
    const auth = await requireRole(request, ['PLATFORM_ADMIN']);
    if (!auth) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Bạn không có quyền gửi lại email kích hoạt.'));
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const requestId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(requestId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã yêu cầu mở trường không hợp lệ.'));
    if (!options.schoolAdministrationRepository) return reply.code(503).send(errorBody(request, 'SCHOOL_REQUESTS_UNAVAILABLE', 'Dịch vụ mở trường chưa sẵn sàng.'));
    return reply.send({ data: await options.schoolAdministrationRepository.resendSchoolActivation(requestId, auth.userId, idempotencyKey) });
  });

  app.get('/api/v1/dashboard', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getDashboard(auth) });
  });

  app.post('/api/v1/lessons', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = lessonSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin bài giảng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createLesson(auth, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/lessons', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const parsed = listLessonsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số bài giảng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listLessons(auth, parsed.data) });
  });

  app.get('/api/v1/lessons/:id', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const lessonId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(lessonId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài giảng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getLesson(auth, lessonId) });
  });

  app.patch('/api/v1/lessons/:id', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const lessonId = (request.params as { id: string }).id;
    const parsed = lessonUpdateSchema.safeParse(request.body);
    if (!z.string().uuid().safeParse(lessonId).success || !parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin bài giảng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.updateLesson(auth, lessonId, parsed.data as UpdateLessonInput, idempotencyKey) });
  });

  app.post('/api/v1/lessons/:id/publish', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const lessonId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(lessonId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài giảng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.publishLesson(auth, lessonId, idempotencyKey) });
  });

  app.post('/api/v1/lessons/:id/archive', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const lessonId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(lessonId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài giảng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.archiveLesson(auth, lessonId, idempotencyKey) });
  });

  app.post('/api/v1/lessons/:id/progress', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const lessonId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(lessonId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài giảng không hợp lệ.'));
    const parsed = lessonProgressSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Trạng thái tiến độ không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.setLessonProgress(auth, lessonId, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/resources', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const service = requireResourceUploadService(request, reply);
    if (!service) return;
    const file = await request.file();
    if (!file) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Cần chọn một tệp để tải lên.'));
    const bytes = await file.toBuffer();
    const classId = multipartFieldValue(file.fields, 'classId');
    const subjectId = multipartFieldValue(file.fields, 'subjectId');
    const lessonId = multipartFieldValue(file.fields, 'lessonId');
    if ([classId, subjectId, lessonId].some((id) => id !== undefined && !z.string().uuid().safeParse(id).success)) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Liên kết lớp, môn học hoặc bài giảng không hợp lệ.'));
    return reply.code(201).send({ data: await service.upload(auth, { filename: file.filename, declaredMimeType: file.mimetype, bytes }, { idempotencyKey, classId, subjectId, lessonId }) });
  });

  app.post('/api/v1/library/uploads', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const service = requireResourceUploadService(request, reply);
    if (!service) return;
    const file = await request.file();
    if (!file) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Cần chọn một tệp để học.'));
    const bytes = await file.toBuffer();
    return reply.code(201).send({ data: await service.upload(auth, { filename: file.filename, declaredMimeType: file.mimetype, bytes }, { idempotencyKey, ownerUserId: auth.userId, visibility: 'PRIVATE' }) });
  });

  app.post('/api/v1/resources/:id/contribution', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const resourceId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(resourceId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã tài liệu không hợp lệ.'));
    const repository = requireResourceRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.requestContribution(auth, resourceId, idempotencyKey) });
  });

  app.post('/api/v1/resources/:id/contribution/review', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const resourceId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(resourceId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã tài liệu không hợp lệ.'));
    const parsed = contributionReviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Quyết định duyệt tài liệu không hợp lệ.'));
    const repository = requireResourceRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.reviewContribution(auth, resourceId, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/resources', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const parsed = listResourcesQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Bộ lọc tài nguyên không hợp lệ.'));
    const repository = requireResourceRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.list(auth, parsed.data) });
  });

  app.get('/api/v1/resources/:id/download', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const resourceId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(resourceId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã tài nguyên không hợp lệ.'));
    const service = requireResourceDownloadService(request, reply);
    if (!service) return;
    if (!service.getFile) return reply.send({ data: await service.getDownload(auth, resourceId) });
    const file = await service.getFile(auth, resourceId);
    reply.header('content-type', file.mimeType);
    reply.header('content-disposition', `attachment; filename="${file.filename.replaceAll(/[\r\n"]/g, '')}"`);
    return reply.send(file.stream);
  });
  app.get('/api/v1/resources/:id/content', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const resourceId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(resourceId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã tài nguyên không hợp lệ.'));
    const service = requireResourceDownloadService(request, reply);
    if (!service?.getFile) return reply.code(503).send(errorBody(request, 'RESOURCE_UNAVAILABLE', 'Dịch vụ tài nguyên chưa sẵn sàng.'));
    const file = await service.getFile(auth, resourceId);
    reply.header('content-type', file.mimeType);
    reply.header('content-disposition', 'inline');
    return reply.send(file.stream);
  });

  app.post('/api/v1/assignments/:id/submissions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = submissionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Bài nộp không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    const assignmentId = (request.params as { id: string }).id;
    return reply.code(201).send({ data: await repository.submitAssignment(auth, assignmentId, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/career/assessments/riasec', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = riasecSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Câu trả lời RIASEC không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.saveRiasecAssessment(auth, parsed.data.answers, idempotencyKey) });
  });

  app.get('/api/v1/career/recommendations', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getCareerRecommendations(auth) });
  });

  app.get('/api/v1/career/aptitude/questions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getAptitudeQuestions(auth) });
  });

  app.get('/api/v1/career/assessments/aptitude/draft', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getAptitudeDraft(auth) });
  });

  app.patch('/api/v1/career/assessments/aptitude/draft', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = aptitudeDraftSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Bản nháp năng lực không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.saveAptitudeDraft(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/career/assessments/aptitude', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = aptitudeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Câu trả lời năng lực không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.saveAptitudeAssessment(auth, parsed.data.answers, idempotencyKey, request.id) });
  });

  app.get('/api/v1/career/profile', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getCareerProfile(auth) });
  });

  app.patch('/api/v1/career/profile', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = updateCareerProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin hồ sơ không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.updateCareerProfile(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/career/share-grants', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = shareGrantSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Cấu hình chia sẻ không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.setCareerShareGrant(auth, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/students/:id/career-profile', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const studentId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(studentId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã học sinh không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getStudentCareerProfile(auth, studentId) });
  });

  const studentMutation = (schema: z.ZodTypeAny, invalidMessage: string, run: (repo: PlatformRepository, auth: AuthContext, body: unknown, key: string, request: FastifyRequest) => Promise<unknown>, status = 201) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await requirePlatformRole(request, reply, ['STUDENT']);
      if (!auth) return;
      if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
      const idempotencyKey = requireIdempotencyKey(request, reply);
      if (!idempotencyKey) return;
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', invalidMessage));
      const repository = requirePlatformRepository(request, reply);
      if (!repository) return;
      return reply.code(status).send({ data: await run(repository, auth, parsed.data, idempotencyKey, request) });
    };
  const studentQuery = (run: (repo: PlatformRepository, auth: AuthContext) => Promise<unknown>) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await requirePlatformRole(request, reply, ['STUDENT']);
      if (!auth) return;
      const repository = requirePlatformRepository(request, reply);
      if (!repository) return;
      return reply.send({ data: await run(repository, auth) });
    };
  const studentIdMutation = (operation: (repo: PlatformRepository, auth: AuthContext, id: string, key: string) => Promise<unknown>, invalidMessage: string) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await requirePlatformRole(request, reply, ['STUDENT']);
      if (!auth) return;
      if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
      const idempotencyKey = requireIdempotencyKey(request, reply);
      if (!idempotencyKey) return;
      const id = (request.params as { id: string }).id;
      if (!z.string().uuid().safeParse(id).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', invalidMessage));
      const repository = requirePlatformRepository(request, reply);
      if (!repository) return;
      return reply.send({ data: await operation(repository, auth, id, idempotencyKey) });
    };

  app.post('/api/v1/career/admission-probability', studentMutation(admissionProbabilitySchema, 'Yêu cầu xác suất không hợp lệ.', (repo, auth, body) => repo.computeAdmissionProbability(auth, body as never), 200));
  app.get('/api/v1/career/scholarship-matches', studentQuery((repo, auth) => repo.getMatchedScholarships(auth)));
  app.get('/api/v1/aspirations', studentQuery((repo, auth) => repo.listAspirations(auth)));
  app.post('/api/v1/aspirations', studentMutation(addAspirationSchema, 'Thông tin nguyện vọng không hợp lệ.', (repo, auth, body, key) => repo.addAspiration(auth, body as never, key)));
  app.post('/api/v1/aspirations/reorder', studentMutation(reorderAspirationsSchema, 'Danh sách sắp xếp không hợp lệ.', (repo, auth, body, key) => repo.reorderAspirations(auth, body as never, key), 200));
  app.post('/api/v1/aspirations/:id/delete', studentIdMutation((repo, auth, id, key) => repo.deleteAspiration(auth, id, key), 'Mã nguyện vọng không hợp lệ.'));
  app.get('/api/v1/saved-items', studentQuery((repo, auth) => repo.listSavedItems(auth)));
  app.post('/api/v1/saved-items', studentMutation(addSavedItemSchema, 'Mục lưu không hợp lệ.', (repo, auth, body, key) => repo.addSavedItem(auth, body as never, key)));
  app.post('/api/v1/saved-items/:id/delete', studentIdMutation((repo, auth, id, key) => repo.removeSavedItem(auth, id, key), 'Mã mục lưu không hợp lệ.'));
  app.get('/api/v1/goals', studentQuery((repo, auth) => repo.listGoals(auth)));
  app.post('/api/v1/goals', studentMutation(addGoalSchema, 'Thông tin mục tiêu không hợp lệ.', (repo, auth, body, key) => repo.addGoal(auth, body as never, key)));
  app.post('/api/v1/goals/:id/complete', studentIdMutation((repo, auth, id, key) => repo.completeGoal(auth, id, key), 'Mã mục tiêu không hợp lệ.'));
  app.get('/api/v1/reminders', studentQuery((repo, auth) => repo.listReminders(auth)));
  app.post('/api/v1/reminders', studentMutation(addReminderSchema, 'Thông tin nhắc hẹn không hợp lệ.', (repo, auth, body, key) => repo.addReminder(auth, body as never, key)));
  app.post('/api/v1/reminders/:id/complete', studentIdMutation((repo, auth, id, key) => repo.completeReminder(auth, id, key), 'Mã nhắc hẹn không hợp lệ.'));

  app.get('/api/v1/career/riasec/questions', studentQuery((repo, auth) => repo.getRiasecQuestions(auth)));
  app.get('/api/v1/career/extracurricular/questions', studentQuery((repo, auth) => repo.getExtracurricularQuestions(auth)));
  app.get('/api/v1/career/exam-blocks', studentQuery((repo, auth) => repo.listExamBlocks(auth)));
  app.post('/api/v1/career/assessments/extracurricular', studentMutation(extraSchema, 'Câu trả lời ngoại khóa không hợp lệ.', (repo, auth, body, key) => repo.saveExtracurricularAssessment(auth, (body as { answers: Record<string, string> }).answers, key)));
  app.get('/api/v1/career/exam-records', studentQuery((repo, auth) => repo.listExamRecords(auth)));
  app.put('/api/v1/career/exam-records', studentMutation(examRecordsSchema, 'Hồ sơ điểm không hợp lệ.', (repo, auth, body, key) => repo.upsertExamRecords(auth, (body as { records: never[] }).records, key), 200));
  app.get('/api/v1/career/schools/rank', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const parsed = rankSchoolsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Bộ lọc trường không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.rankSchools(auth, parsed.data) });
  });
  app.get('/api/v1/career/ai/agents', studentQuery((repo, auth) => repo.listCareerAgents(auth)));
  app.get('/api/v1/career/ai/runs', studentQuery((repo, auth) => repo.listCareerAnalysisRuns(auth)));
  app.post('/api/v1/career/ai/analyze', studentMutation(careerAnalyzeSchema, 'Yêu cầu phân tích không hợp lệ.', (repo, auth, body, key, request) => repo.analyzeCareer(auth, body as never, key, request.id)));
  app.get('/api/v1/exams/open', studentQuery((repo, auth) => repo.listOpenExams(auth)));
  app.post('/api/v1/exams/sessions', studentMutation(startExamSchema, 'Thông tin vào ca thi không hợp lệ.', (repo, auth, body, key) => repo.startExamSession(auth, body as never, key)));
  app.get('/api/v1/exams/sessions/:id', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const id = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(id).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã ca thi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getExamSession(auth, id) });
  });
  app.patch('/api/v1/exams/sessions/:id/answers', studentMutation(saveExamSchema, 'Câu trả lời không hợp lệ.', (repo, auth, body, key) => repo.saveExamAnswers(auth, body as never, key), 200));
  app.post('/api/v1/exams/sessions/:id/heartbeat', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const id = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(id).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã ca thi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.heartbeatExamSession(auth, id, idempotencyKey) });
  });
  app.post('/api/v1/exams/sessions/:id/attachment-exemption', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const id = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(id).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã ca thi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.issueExamAttachmentExemption(auth, id, idempotencyKey) });
  });
  app.post('/api/v1/exams/integrity', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = examIntegritySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Nhật ký không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.logExamIntegrity(auth, parsed.data, idempotencyKey) });
  });
  app.post('/api/v1/exams/sessions/:id/integrity/restore', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const sessionId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(sessionId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã ca thi không hợp lệ.'));
    const parsed = examIncidentRestoreSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Incident cần được chỉ định để phục hồi.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.restoreExamIncident(auth, sessionId, parsed.data.incidentId, idempotencyKey) });
  });
  app.post('/api/v1/exams/sessions/:id/integrity/close', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const sessionId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(sessionId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã ca thi không hợp lệ.'));
    const parsed = examIncidentCloseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Lý do đóng incident không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.closeExamIncident(auth, sessionId, parsed.data, idempotencyKey) });
  });
  app.post('/api/v1/exams/sessions/:id/unlock', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const sessionId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(sessionId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã ca thi không hợp lệ.'));
    const parsed = examUnlockSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Lý do mở khóa ca thi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.unlockExamSession(auth, sessionId, parsed.data.reason, idempotencyKey) });
  });
  app.post('/api/v1/exams/sessions/:id/submit', studentIdMutation((repo, auth, id, key) => repo.submitExamSession(auth, id, key), 'Mã ca thi không hợp lệ.'));
  app.post('/api/v1/exams/sessions/:id/attachments', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const id = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(id).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã ca thi không hợp lệ.'));
    const service = requireResourceUploadService(request, reply);
    if (!service) return;
    const file = await request.file();
    if (!file) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Cần chọn một tệp để đính kèm.'));
    const bytes = await file.toBuffer();
    const exemptionToken = multipartFieldValue(file.fields, 'exemptionToken');
    if (exemptionToken) {
      const repository = requirePlatformRepository(request, reply);
      if (!repository) return;
      const exemption = await repository.consumeExamAttachmentExemption(auth, id, exemptionToken, idempotencyKey);
      if (!exemption.authorized) return reply.code(403).send(errorBody(request, 'EXAM_ATTACHMENT_EXEMPTION_INVALID', 'Quyền mở hộp chọn tệp đã hết hạn hoặc không hợp lệ. Hãy mở lại hộp chọn tệp.'));
    }
    return reply.code(201).send({ data: await service.upload(auth, { filename: file.filename, declaredMimeType: file.mimetype, bytes }, { idempotencyKey, examSessionId: id }) });
  });
  app.get('/api/v1/exams/:id/integrity', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const id = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(id).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài thi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listExamIntegrity(auth, id) });
  });

  app.get('/api/v1/ai/models', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listAiModels(auth) });
  });

  app.post('/api/v1/ai/models', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = upsertAiModelSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Cấu hình model AI không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.upsertAiModel(auth, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/ai/usage', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getAiUsageSummary(auth) });
  });

  app.get('/api/v1/ai/health', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.aiHealthCheck(auth, request.id) });
  });

  app.get('/api/v1/ai/rag/documents', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listRagDocuments(auth) });
  });

  app.post('/api/v1/ai/rag/documents', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = ingestRagSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Dữ liệu nạp tài nguyên không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.ingestRagContent(auth, parsed.data, idempotencyKey) });
  });

  app.delete('/api/v1/ai/rag/documents/:documentId', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const documentId = (request.params as { documentId: string }).documentId;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.deleteRagDocument(auth, documentId, idempotencyKey) });
  });

  app.post('/api/v1/ai/rag/search', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const parsed = searchRagSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Yêu cầu tìm kiếm không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.searchRag(auth, parsed.data) });
  });

  app.get('/api/v1/ai/sessions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listAiSessions(auth) });
  });

  app.get('/api/v1/ai/sessions/:sessionId/messages', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const sessionId = (request.params as { sessionId: string }).sessionId;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getAiSessionMessages(auth, sessionId) });
  });

  app.post('/api/v1/ai/chat', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = aiChatSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Nội dung trò chuyện không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.chatWithAi(auth, parsed.data, idempotencyKey, request.id) });
  });

  app.post('/api/v1/ai/jobs', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = aiChatSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Nội dung AI job không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(202).send({ data: await repository.createAiJob(auth, parsed.data, idempotencyKey, request.id) });
  });
  app.get('/api/v1/ai/jobs', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listAiJobs(auth) });
  });

  app.get('/api/v1/ai/jobs/:jobId', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const jobId = (request.params as { jobId: string }).jobId;
    if (!z.string().uuid().safeParse(jobId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã AI job không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getAiJob(auth, jobId) });
  });

  app.post('/api/v1/ai/jobs/:jobId/cancel', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const jobId = (request.params as { jobId: string }).jobId;
    if (!z.string().uuid().safeParse(jobId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã AI job không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.cancelAiJob(auth, jobId, idempotencyKey, request.id) });
  });

  app.post('/api/v1/sync/events', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = offlineEventsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Sự kiện đồng bộ không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.syncOfflineEvents(auth, parsed.data.events, idempotencyKey) });
  });

  app.get('/api/v1/admin/schools/:schoolId/billing-quote', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    const schoolId = (request.params as { schoolId: string }).schoolId;
    if (!z.string().uuid().safeParse(schoolId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã trường không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getBillingQuote(schoolId) });
  });

  app.get('/api/v1/billing/overview', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getSchoolBillingOverview(auth) });
  });

  app.get('/api/v1/admin/billing/subscriptions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.adminListSubscriptions(auth) });
  });

  app.put('/api/v1/admin/schools/:schoolId/subscription', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const schoolId = (request.params as { schoolId: string }).schoolId;
    if (!z.string().uuid().safeParse(schoolId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã trường không hợp lệ.'));
    const parsed = updateSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Dữ liệu gói dịch vụ không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.adminUpdateSubscription(auth, schoolId, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/admin/schools/:schoolId/billing-events', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    const schoolId = (request.params as { schoolId: string }).schoolId;
    if (!z.string().uuid().safeParse(schoolId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã trường không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.adminListBillingEvents(auth, schoolId) });
  });

  app.post('/api/v1/admin/schools/:schoolId/billing-events', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const schoolId = (request.params as { schoolId: string }).schoolId;
    if (!z.string().uuid().safeParse(schoolId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã trường không hợp lệ.'));
    const parsed = recordBillingEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Dữ liệu sự kiện thanh toán không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.adminRecordBillingEvent(auth, schoolId, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/skill-graphs', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const parsed = listSkillGraphsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số truy vấn đồ thị kỹ năng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listSkillGraphs(auth, parsed.data) });
  });

  app.get('/api/v1/skill-graphs/:id', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const graphId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(graphId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã đồ thị kỹ năng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getSkillGraph(auth, graphId) });
  });

  app.post('/api/v1/skill-graphs', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createSkillGraphSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin đồ thị kỹ năng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createSkillGraph(auth, parsed.data, idempotencyKey) });
  });

  app.put('/api/v1/skill-graphs/:id', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const graphId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(graphId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã đồ thị kỹ năng không hợp lệ.'));
    const parsed = updateSkillGraphSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin đồ thị kỹ năng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.updateSkillGraph(auth, graphId, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/skill-graphs/:id/submit', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const graphId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(graphId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã đồ thị kỹ năng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.submitSkillGraphForReview(auth, graphId, idempotencyKey) });
  });

  app.post('/api/v1/skill-graphs/:id/review', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const graphId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(graphId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã đồ thị kỹ năng không hợp lệ.'));
    const parsed = reviewSkillGraphSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Quyết định duyệt không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.reviewSkillGraph(auth, graphId, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/skill-graphs/:id/mappings', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const graphId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(graphId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã đồ thị kỹ năng không hợp lệ.'));
    const parsed = mapSkillItemsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin gán câu hỏi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.mapSkillItems(auth, graphId, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/adaptive/diagnoses', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const parsed = adaptiveDiagnosesQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số chẩn đoán không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getAdaptiveDiagnoses(auth, parsed.data) });
  });

  app.post('/api/v1/adaptive/overrides', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = overrideAdaptiveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin ghi đè chẩn đoán không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.overrideAdaptiveDiagnosis(auth, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/adaptive/my', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getMyAdaptivePlan(auth) });
  });

  app.get('/api/v1/careers', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listCareers(auth) });
  });

  app.get('/api/v1/institutions', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const parsed = listInstitutionsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số tìm trường không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listInstitutions(auth, parsed.data) });
  });

  app.get('/api/v1/institutions/:id', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const institutionId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(institutionId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã trường không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getInstitutionDetail(auth, institutionId) });
  });

  app.get('/api/v1/scholarships', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listScholarships(auth, {}) });
  });

  app.post('/api/v1/admin/careers', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = upsertCareerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin nghề không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.adminUpsertCareer(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/majors', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = upsertMajorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin ngành không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.adminUpsertMajor(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/institutions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = upsertInstitutionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin trường không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.adminUpsertInstitution(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/admission-scores/import', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = importAdmissionScoresSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Dữ liệu điểm chuẩn không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.adminImportAdmissionScores(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/scholarships', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = upsertScholarshipSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin học bổng không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.adminUpsertScholarship(auth, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/subjects', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listSubjects(auth) });
  });

  app.get('/api/v1/classes', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listClasses(auth) });
  });

  app.get('/api/v1/teachers', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listTeachers(auth) });
  });

  app.get('/api/v1/students', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const parsed = listStudentsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số truy vấn học sinh không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listStudents(auth, parsed.data.classId) });
  });

  app.post('/api/v1/classes', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createClassSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin lớp học không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createClass(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/classes/:classId/teachers', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const classId = (request.params as { classId: string }).classId;
    const parsed = assignClassTeacherSchema.safeParse({ ...(request.body as object), classId });
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin phân công giáo viên không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.assignClassTeacher(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/classes/:classId/students', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const classId = (request.params as { classId: string }).classId;
    const parsed = enrollStudentSchema.safeParse({ ...(request.body as object), classId });
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin ghi danh học sinh không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.enrollStudent(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/students', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createStudentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin học sinh không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createStudent(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/admin/teachers/invitations', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = inviteTeacherSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin lời mời không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    const invitation = await repository.inviteTeacher(auth, parsed.data, idempotencyKey);
    const { invitationToken: _invitationToken, activationToken: _activationToken, token: _token, ...safeInvitation } = invitation as Record<string, unknown>;
    return reply.code(201).send({ data: safeInvitation });
  });

  app.post('/api/v1/auth/invitations/accept', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const parsed = acceptInvitationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin lời mời không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    const accepted = await repository.acceptInvitation(parsed.data.token, parsed.data.newPassword);
    return reply.code(200).send({ data: accepted });
  });

  app.patch('/api/v1/me/profile', async (request, reply) => {
    const auth = await requireAuthenticated(request, reply);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin hồ sơ không hợp lệ.'));
    const repository = requireSchoolAdministrationRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.updateProfile(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/question-banks', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createQuestionBankSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin ngân hàng câu hỏi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createQuestionBank(auth, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/questions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createQuestionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin câu hỏi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createQuestion(auth, parsed.data as CreateQuestionInput, idempotencyKey) });
  });

  app.post('/api/v1/question-imports', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const file = await request.file();
    if (!file) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Cần chọn tệp CSV hoặc XLSX để import.'));
    const bankId = multipartFieldValue(file.fields, 'bankId');
    if (!z.string().uuid().safeParse(bankId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Cần chọn ngân hàng câu hỏi hợp lệ.'));
    const preview = await parseQuestionImport(await file.toBuffer(), file.filename);
    const safePreview = {
      canCommit: preview.canCommit,
      rows: preview.rows.map((row) => ({ row: row.row, type: row.input.type, prompt: String((row.input.prompt as { text?: unknown }).text ?? ''), maxScore: row.input.maxScore })),
      errors: preview.errors,
    };
    const commit = multipartFieldValue(file.fields, 'commit') === 'true';
    if (!commit) return reply.send({ data: safePreview });
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    if (!preview.canCommit) return reply.code(422).send({ data: safePreview, ...errorBody(request, 'QUESTION_IMPORT_INVALID', 'Cần sửa toàn bộ lỗi trước khi xác nhận import.') });
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    const imported = await repository.importQuestions(auth, bankId!, preview.rows.map((row) => row.input), idempotencyKey);
    return reply.code(201).send({ data: { ...safePreview, imported } });
  });

  app.get('/api/v1/question-imports/template', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const csv = '\uFEFFtype,prompt,choice_a,choice_b,choice_c,choice_d,correct_answer,acceptable_answers,rubric,max_score\nMULTIPLE_CHOICE,Câu hỏi mẫu,A,B,C,D,A,,,1\nTRUE_FALSE,Cho các ý,Ý a,Ý b,Ý c,Ý d,T|F|T|F,,,1\nSHORT_ANSWER,Kết quả số,,,,,,2.5,,1\nESSAY,Câu hỏi tự luận,,,,,,,Tiêu chí 1|2|Mô tả;Tiêu chí 2|1|Mô tả,3\n';
    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="smartpath-question-import-template.csv"');
    return reply.send(csv);
  });

  app.post('/api/v1/question-versions/:id/approve', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const questionVersionId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(questionVersionId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã phiên bản câu hỏi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.approveQuestion(auth, { questionVersionId }, idempotencyKey) });
  });

  app.patch('/api/v1/questions/:id', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const questionId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(questionId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã câu hỏi không hợp lệ.'));
    const parsed = createQuestionSchema.safeParse({ ...(request.body as object), bankId: '00000000-0000-4000-8000-000000000000' });
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Phiên bản câu hỏi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    const { bankId: _bankId, ...input } = parsed.data;
    return reply.send({ data: await repository.updateQuestion(auth, questionId, input as UpdateQuestionInput, idempotencyKey) });
  });

  app.post('/api/v1/assignments', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createAssignmentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin bài tập không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createAssignment(auth, parsed.data, idempotencyKey) });
  });

  app.put('/api/v1/assignments/:id', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const assignmentId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(assignmentId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài tập không hợp lệ.'));
    const parsed = createAssignmentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin bài tập không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.updateAssignment(auth, assignmentId, parsed.data, idempotencyKey) });
  });

  app.post('/api/v1/assignments/:id/publish', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const assignmentId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(assignmentId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài tập không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(200).send({ data: await repository.publishAssignment(auth, { assignmentId }, idempotencyKey) });
  });

  app.post('/api/v1/assignments/:id/close', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const assignmentId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(assignmentId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài tập không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.closeAssignment(auth, assignmentId, idempotencyKey) });
  });

  app.post('/api/v1/assignments/:id/archive', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const assignmentId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(assignmentId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài tập không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.archiveAssignment(auth, assignmentId, idempotencyKey) });
  });

  app.post('/api/v1/attempts/:attemptId/answers/:assignmentItemId/grade', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const params = request.params as { attemptId: string; assignmentItemId: string };
    if (!z.string().uuid().safeParse(params.attemptId).success || !z.string().uuid().safeParse(params.assignmentItemId).success) {
      return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài nộp hoặc câu hỏi không hợp lệ.'));
    }
    const parsed = gradeEssaySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin chấm bài không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(200).send({ data: await repository.gradeEssay(auth, { attemptId: params.attemptId, assignmentItemId: params.assignmentItemId, score: parsed.data.score, feedback: parsed.data.feedback }, idempotencyKey) });
  });

  app.post('/api/v1/attempts/:attemptId/return', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const attemptId = (request.params as { attemptId: string }).attemptId;
    if (!z.string().uuid().safeParse(attemptId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài nộp không hợp lệ.'));
    const parsed = returnAttemptSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Phản hồi tổng thể không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.returnAssignmentAttempt(auth, { attemptId, overallFeedback: parsed.data.overallFeedback }, idempotencyKey) });
  });

  app.get('/api/v1/grading/pending-essays', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listPendingEssays(auth) });
  });

  app.get('/api/v1/gradebook', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const parsed = gradebookQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số truy vấn sổ điểm không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getGradebook(auth, parsed.data) });
  });

  app.post('/api/v1/report-exports', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = reportExportSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thông tin export không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.requestReportExport(auth, parsed.data as RequestReportExportInput, idempotencyKey) });
  });
  app.get('/api/v1/report-exports', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listReportExports(auth) });
  });
  app.get('/api/v1/report-exports/:id/download', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const exportId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(exportId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã export không hợp lệ.'));
    const service = requireReportExportDownloadService(request, reply);
    if (!service) return;
    if (!service.getFile) return reply.send({ data: await service.getDownload(auth, exportId) });
    const file = await service.getFile(auth, exportId);
    reply.header('content-type', file.mimeType);
    reply.header('content-disposition', `attachment; filename="${file.filename.replaceAll(/[\r\n"]/g, '')}"`);
    return reply.send(file.stream);
  });
  app.post('/api/v1/report-exports/:id/retry', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const exportId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(exportId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã export không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.retryReportExport(auth, exportId, idempotencyKey) });
  });

  app.post('/api/v1/gradebook/:id/override', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const entryId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(entryId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã điểm không hợp lệ.'));
    const parsed = gradebookOverrideSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Điểm hoặc lý do override không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.overrideGradebookEntry(auth, entryId, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/progress', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const parsed = gradebookQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số báo cáo tiến độ không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getLearningProgress(auth, parsed.data) });
  });

  app.get('/api/v1/assignments', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const parsed = listAssignmentsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số truy vấn bài tập không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listAssignments(auth, parsed.data) });
  });

  app.get('/api/v1/assignments/:id/attempts', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const assignmentId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(assignmentId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài tập không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getMyAssignmentAttempts(auth, assignmentId) });
  });

  app.get('/api/v1/assignments/:id', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER', 'STUDENT']);
    if (!auth) return;
    const assignmentId = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(assignmentId).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã bài tập không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getAssignment(auth, assignmentId) });
  });

  app.get('/api/v1/question-banks', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const parsed = listQuestionBanksQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số truy vấn ngân hàng câu hỏi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listQuestionBanks(auth, parsed.data) });
  });

  app.get('/api/v1/questions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER', 'TEACHER']);
    if (!auth) return;
    const parsed = listQuestionsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số truy vấn câu hỏi không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listQuestions(auth, parsed.data) });
  });

  app.get('/api/v1/me/grades', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getMyGrades(auth) });
  });

  app.get('/api/v1/messages/channel', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getHomeroomChannel(auth) });
  });
  app.get('/api/v1/messages', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    const parsed = listMessagesQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tham số tin nhắn không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listClassMessages(auth, parsed.data) });
  });
  app.post('/api/v1/messages', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = classMessageSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Tin nhắn không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.sendClassMessage(auth, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/transcripts', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    const userId = typeof (request.query as { userId?: string }).userId === 'string' ? (request.query as { userId?: string }).userId : undefined;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listTranscripts(auth, userId) });
  });
  app.post('/api/v1/transcripts', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = transcriptSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Học bạ không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.upsertTranscript(auth, parsed.data, idempotencyKey) });
  });
  app.get('/api/v1/knowledge-card', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    const userId = typeof (request.query as { userId?: string }).userId === 'string' ? (request.query as { userId?: string }).userId : undefined;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getKnowledgeCard(auth, userId) });
  });
  app.put('/api/v1/knowledge-card', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = knowledgeCardSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Thẻ kiến thức không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.updateKnowledgeCard(auth, parsed.data, idempotencyKey) });
  });
  app.get('/api/v1/me/learning-summary', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getMyLearningSummary(auth) });
  });

  app.get('/api/v1/skill-suggestions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    const studentId = z.string().uuid().optional().safeParse((request.query as { studentId?: string }).studentId);
    if (!studentId.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã học sinh không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listSkillSuggestions(auth, studentId.data) });
  });
  app.post('/api/v1/skill-suggestions', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['STUDENT', 'TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = createSkillSuggestionSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Yêu cầu skill nháp không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.createSkillSuggestion(auth, { studentId: parsed.data.studentId ?? auth.userId, subjectId: parsed.data.subjectId }, idempotencyKey) });
  });
  app.post('/api/v1/skill-suggestions/:id/review', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const id = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(id).success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Mã skill nháp không hợp lệ.'));
    const parsed = reviewSkillSuggestionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Quyết định duyệt không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.reviewSkillSuggestion(auth, id, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/exams/proctoring', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['TEACHER', 'SCHOOL_OWNER']);
    if (!auth) return;
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.listProctoredExams(auth) });
  });
  app.post('/api/v1/exams/proctors', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['SCHOOL_OWNER']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = assignProctorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'Phân công giám thị không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.assignExamProctor(auth, parsed.data, idempotencyKey) });
  });

  app.get('/api/v1/internal/student-records/:studentCode', async (request, reply) => {
    const secret = process.env.STUDENT_RECORDS_HMAC_SECRET?.trim() || process.env.STUDENT_IDENTITY_HMAC_SECRET?.trim();
    if (!secret) return reply.code(503).send(errorBody(request, 'STUDENT_RECORDS_DISABLED', 'Cổng học bạ nội bộ chưa được cấu hình.'));
    const studentCode = (request.params as { studentCode: string }).studentCode;
    const timestamp = headerValue(request.headers['x-internal-timestamp']) ?? '';
    const hmac = headerValue(request.headers['x-internal-hmac']) ?? '';
    if (!timestamp || !hmac || !studentRecordsHmacMatches(secret, timestamp, studentCode, hmac)) {
      return reply.code(401).send(errorBody(request, 'STUDENT_RECORDS_UNAUTHORIZED', 'Chữ ký HMAC không hợp lệ.'));
    }
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.send({ data: await repository.getInternalStudentRecord(studentCode) });
  });

  app.post('/api/v1/admin/crawl-jobs', async (request, reply) => {
    const auth = await requirePlatformRole(request, reply, ['PLATFORM_ADMIN']);
    if (!auth) return;
    if (!requestOriginIsAllowed(request)) return reply.code(403).send(errorBody(request, 'ORIGIN_NOT_ALLOWED', 'Nguồn gửi yêu cầu không được phép.'));
    const idempotencyKey = requireIdempotencyKey(request, reply);
    if (!idempotencyKey) return;
    const parsed = crawlJobSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(errorBody(request, 'VALIDATION_ERROR', 'URL crawl không hợp lệ.'));
    const repository = requirePlatformRepository(request, reply);
    if (!repository) return;
    return reply.code(201).send({ data: await repository.queueCrawlJob(auth, parsed.data.url, idempotencyKey) });
  });

  return app;
}
