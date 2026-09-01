import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { GradeChip } from '../components/ui/GradeChip.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError } from '../lib/api.js';
import { useSession } from '../lib/SessionContext.js';

interface Person { id: string; displayName: string; email?: string; studentCode?: string }

export function HomeroomPage() {
  const { user } = useSession();
  const classId = user.homeroomClassIds?.[0];
  const query = useQuery({
    queryKey: ['homeroom-students', classId],
    queryFn: () => apiRequest<Person[]>('/api/v1/students', { query: { classId } }),
    enabled: Boolean(classId),
  });
  const students = query.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Lớp chủ nhiệm"
        title="Học sinh của lớp"
        lede="Xem danh sách lớp. Hồ sơ hướng nghiệp chỉ mở khi học sinh đã chia sẻ."
      />
      {!classId && <EmptyState>Tài khoản này chưa được phân công chủ nhiệm lớp nào.</EmptyState>}
      {query.isPending && classId && <EmptyState>Đang tải danh sách học sinh…</EmptyState>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>{query.error instanceof ApiRequestError ? query.error.message : 'Chưa tải được danh sách.'}</ErrorState>}
      {query.isSuccess && students.length === 0 && <EmptyState>Chưa có học sinh trong lớp chủ nhiệm.</EmptyState>}
      {students.length > 0 && (
        <DataTable headers={['Học sinh', 'Hồ sơ hướng nghiệp']}>
          {students.map((student) => (
            <tr key={student.id}>
              <td><b>{student.displayName}</b><small>{student.studentCode ?? student.email}</small></td>
              <td><Link className="text-link" to={`/app/homeroom/${student.id}`}>Xem nếu đã chia sẻ</Link></td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export function HomeroomStudentCareerPage() {
  const { studentId = '' } = useParams();
  const query = useQuery({
    queryKey: ['homeroom-career', studentId],
    queryFn: () => apiRequest<Record<string, unknown>>(`/api/v1/students/${studentId}/career-profile`),
    enabled: studentId.length > 8,
  });

  return (
    <>
      <PageHeader eyebrow="Lớp chủ nhiệm" title="Hồ sơ hướng nghiệp" lede="Chỉ hiện khi học sinh đã cấp quyền chia sẻ." />
      <p className="page-lede"><Link className="text-link" to="/app/homeroom">← Danh sách lớp</Link></p>
      {query.isPending && <EmptyState>Đang tải hồ sơ…</EmptyState>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>{query.error instanceof ApiRequestError ? query.error.message : 'Chưa xem được hồ sơ. Học sinh có thể chưa chia sẻ.'}</ErrorState>}
      {query.isSuccess && <HomeroomCareerSummary data={query.data} />}
    </>
  );
}

function asText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '—';
}

function HomeroomCareerSummary({ data }: { data: Record<string, unknown> }) {
  const snapshot = (data.snapshot && typeof data.snapshot === 'object' ? data.snapshot : data) as Record<string, unknown>;
  const grades = snapshot.classroomGrades && typeof snapshot.classroomGrades === 'object'
    ? Object.entries(snapshot.classroomGrades as Record<string, number>).filter(([, score]) => Number.isFinite(score))
    : [];
  const results = Array.isArray(data.results) ? data.results as Array<{ careerId?: string; score?: number; evidence?: Record<string, unknown> }> : [];

  return (
    <section className="workspace-feature">
      <h2>Thông tin đã chia sẻ</h2>
      <p>Tỉnh/thành: <b>{asText(snapshot.province)}</b></p>
      <p>Mục tiêu: <b>{asText(snapshot.studyGoal)}</b></p>
      <p>Loại mục tiêu: <b>{snapshot.studyGoalType === 'career' ? 'Theo nghề' : snapshot.studyGoalType === 'school' ? 'Theo trường' : snapshot.studyGoalType === 'undecided' ? 'Chưa quyết' : '—'}</b></p>
      {grades.length > 0 && (
        <div className="grade-chip-row">
          {grades.map(([code, score]) => <GradeChip key={code} code={code} score={score} />)}
        </div>
      )}
      {results.length > 0 && (
        <DataTable headers={['Gợi ý nghề', 'Độ phù hợp']}>
          {results.map((row, index) => (
            <tr key={row.careerId ?? index}>
              <td>{asText(row.evidence?.title ?? row.careerId)}</td>
              <td>{typeof row.score === 'number' ? `${Math.round(row.score * 100)}%` : '—'}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}
