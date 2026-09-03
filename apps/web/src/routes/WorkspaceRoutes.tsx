import { type ReactElement } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { useSession } from '../lib/SessionContext.js';
import type { WorkspaceRole } from '../lib/session.js';
import { AdaptiveDiagnosisPage } from './AdaptiveDiagnosisPage.js';
import { AdminBillingPage } from './AdminBillingPage.js';
import { AdminUsersPage } from './AdminUsersPage.js';
import { AiAssistantPage } from './AiAssistantPage.js';
import { AiKnowledgePage } from './AiKnowledgePage.js';
import { AiSettingsPage } from './AiSettingsPage.js';
import { AppLayout } from './AppLayout.js';
import { AspirationsPage } from './AspirationsPage.js';
import { AssignmentDetailPage } from './AssignmentDetailPage.js';
import { AssignmentsPage } from './AssignmentsPage.js';
import { AuditLogPage } from './AuditLogPage.js';
import { BillingPage } from './BillingPage.js';
import { CareerAiPage } from './CareerAiPage.js';
import { CareerGuidePage } from './CareerGuidePage.js';
import { CareerQuizPage } from './CareerQuizPage.js';
import { CareerResultsPage } from './CareerResultsPage.js';
import { CareerSchoolsPage } from './CareerSchoolsPage.js';
import { CareersPage } from './CareersPage.js';
import { ExamRoomPage } from './ExamRoomPage.js';
import { MessagesPage } from './MessagesPage.js';
import { SkillDraftsPage } from './SkillDraftsPage.js';
import { ProctorPage } from './ProctorPage.js';
import { ClassesPage } from './ClassesPage.js';
import { DashboardPage } from './DashboardPage.js';
import { EssayGradingPage } from './EssayGradingPage.js';
import { ForbiddenPage } from './ForbiddenPage.js';
import { GradebookPage } from './GradebookPage.js';
import { HomeroomPage, HomeroomStudentCareerPage } from './HomeroomPage.js';
import { LessonEditorPage } from './LessonEditorPage.js';
import { LessonReaderPage } from './LessonReaderPage.js';
import { LessonsPage } from './LessonsPage.js';
import { MyGradesPage } from './MyGradesPage.js';
import { MyLearningPathPage } from './MyLearningPathPage.js';
import { ProfilePage } from './ProfilePage.js';
import { ProgressReportPage } from './ProgressReportPage.js';
import { QuestionBanksPage } from './QuestionBanksPage.js';
import { RegistrationsPage } from './RegistrationsPage.js';
import { ResourcesPage } from './ResourcesPage.js';
import { SchoolRequestsPage } from './SchoolRequestsPage.js';
import { SchoolsPage } from './SchoolsPage.js';
import { SkillGraphsPage } from './SkillGraphsPage.js';

function RoleRoute({ roles, element }: { roles: WorkspaceRole[]; element: ReactElement }) {
  const { user } = useSession();
  return roles.includes(user.role) ? element : <ForbiddenPage />;
}

function StudentAiStudyRedirect() {
  const { user } = useSession();
  if (user.role === 'STUDENT') return <Navigate to="/app/ai-study" replace />;
  return <AiAssistantPage />;
}

function WorkspaceNotFound() {
  return (
    <div className="forbidden-panel" role="region" aria-label="Không tìm thấy trang này">
      <div className="not-found-badge" aria-hidden="true">
        <Compass size={32} />
        <span>404</span>
      </div>
      <h1>Không tìm thấy mục yêu cầu</h1>
      <p className="forbidden-lede">
        Chức năng hoặc địa chỉ bạn vừa truy cập không tồn tại hoặc đã được chuyển sang vị trí khác trong không gian làm việc.
      </p>
      <div className="forbidden-actions">
        <Link className="button button-primary" to="/app">
          <Home size={18} aria-hidden="true" /> Về tổng quan
        </Link>
      </div>
    </div>
  );
}

export function WorkspaceRoutes() {
  return (
    <Routes>
      <Route path="/app/exam" element={<RoleRoute roles={['STUDENT']} element={<ExamRoomPage />} />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<RoleRoute roles={['PLATFORM_ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<DashboardPage />} />} />
        <Route path="school-requests" element={<RoleRoute roles={['PLATFORM_ADMIN']} element={<SchoolRequestsPage />} />} />
        <Route path="admin-users" element={<RoleRoute roles={['PLATFORM_ADMIN']} element={<AdminUsersPage />} />} />
        <Route path="schools" element={<RoleRoute roles={['PLATFORM_ADMIN']} element={<SchoolsPage />} />} />
        <Route path="audit-log" element={<RoleRoute roles={['PLATFORM_ADMIN']} element={<AuditLogPage />} />} />
        <Route path="admin-billing" element={<RoleRoute roles={['PLATFORM_ADMIN']} element={<AdminBillingPage />} />} />
        <Route path="billing" element={<RoleRoute roles={['SCHOOL_OWNER']} element={<BillingPage />} />} />
        <Route path="classes" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<ClassesPage />} />} />
        <Route path="homeroom" element={<RoleRoute roles={['TEACHER']} element={<HomeroomPage />} />} />
        <Route path="homeroom/:studentId" element={<RoleRoute roles={['TEACHER']} element={<HomeroomStudentCareerPage />} />} />
        <Route path="registrations" element={<RoleRoute roles={['SCHOOL_OWNER']} element={<RegistrationsPage />} />} />
        <Route path="lessons" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<LessonsPage />} />} />
        <Route path="lessons/new" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<LessonEditorPage />} />} />
        <Route path="lessons/:id" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<LessonReaderPage />} />} />
        <Route path="lessons/:id/edit" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<LessonEditorPage />} />} />
        <Route path="digital-library" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<ResourcesPage />} />} />
        <Route path="resources" element={<Navigate to="/app/digital-library" replace />} />
        <Route path="question-banks" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<QuestionBanksPage />} />} />
        <Route path="skill-graphs" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<SkillGraphsPage />} />} />
        <Route path="adaptive" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<AdaptiveDiagnosisPage />} />} />
        <Route path="my-path" element={<RoleRoute roles={['STUDENT']} element={<MyLearningPathPage />} />} />
        <Route path="careers" element={<RoleRoute roles={['PLATFORM_ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<CareersPage />} />} />
        <Route path="career-quiz" element={<RoleRoute roles={['STUDENT']} element={<CareerQuizPage />} />} />
        <Route path="career-results" element={<RoleRoute roles={['STUDENT']} element={<CareerResultsPage />} />} />
        <Route path="career-schools" element={<RoleRoute roles={['STUDENT']} element={<CareerSchoolsPage />} />} />
        <Route path="career-dashboard" element={<Navigate to="/app/career-quiz" replace />} />
        <Route path="career-ai" element={<RoleRoute roles={['STUDENT']} element={<CareerAiPage />} />} />
        <Route path="career-guide" element={<RoleRoute roles={['STUDENT']} element={<CareerGuidePage />} />} />
        <Route path="messages" element={<RoleRoute roles={['STUDENT', 'TEACHER']} element={<MessagesPage />} />} />
        <Route path="skill-drafts" element={<RoleRoute roles={['STUDENT', 'TEACHER', 'SCHOOL_OWNER']} element={<SkillDraftsPage />} />} />
        <Route path="proctor" element={<RoleRoute roles={['TEACHER', 'SCHOOL_OWNER']} element={<ProctorPage />} />} />
        <Route path="aspirations" element={<RoleRoute roles={['STUDENT']} element={<AspirationsPage />} />} />
        <Route path="ai-settings" element={<RoleRoute roles={['SCHOOL_OWNER']} element={<AiSettingsPage />} />} />
        <Route path="ai-study" element={<RoleRoute roles={['STUDENT']} element={<AiAssistantPage />} />} />
        <Route path="ai-assistant" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<StudentAiStudyRedirect />} />} />
        <Route path="ai-knowledge" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<AiKnowledgePage />} />} />
        <Route path="assignments" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<AssignmentsPage />} />} />
        <Route path="assignments/new" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<AssignmentDetailPage />} />} />
        <Route path="assignments/:id" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<AssignmentDetailPage />} />} />
        <Route path="gradebook" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<GradebookPage />} />} />
        <Route path="progress" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<ProgressReportPage />} />} />
        <Route path="grading" element={<RoleRoute roles={['SCHOOL_OWNER', 'TEACHER']} element={<EssayGradingPage />} />} />
        <Route path="grades" element={<RoleRoute roles={['STUDENT']} element={<MyGradesPage />} />} />
        <Route path="profile" element={<RoleRoute roles={['PLATFORM_ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT']} element={<ProfilePage />} />} />
        <Route path="*" element={<WorkspaceNotFound />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
