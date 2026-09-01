import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { apiRequest } from '../lib/api.js';
import { useCatalog, type SubjectOption } from '../lib/catalog.js';

interface GradeEntry {
  id: string;
  subjectId: string;
  subjectName?: string;
  assignmentId: string | null;
  score: number;
  maxScore: number;
  source: string;
  status?: 'FINAL' | 'PROVISIONAL';
  assignmentTitle?: string | null;
  examPeriod?: string | null;
  recordedAt: string;
}

function sourceLabel(source: string): string {
  return source === 'OVERRIDE' ? 'Điểm đã điều chỉnh' : source === 'AUTO' ? 'Tự chấm' : 'Đã chấm';
}

function statusLabel(grade: GradeEntry): string {
  if (grade.status === 'PROVISIONAL') return 'Tạm tính · chờ chấm';
  return sourceLabel(grade.source);
}

const PERIOD_LABELS: Record<string, string> = {
  PRACTICE: 'Luyện tập', MIDTERM_1: 'Giữa kỳ I', FINAL_1: 'Cuối kỳ I',
  MIDTERM_2: 'Giữa kỳ II', FINAL_2: 'Cuối kỳ II', MOCK_GRADUATION: 'Thi thử tốt nghiệp', OTHER: 'Kỳ khác',
};

export function MyGradesPage() {
  const subjects = useCatalog<SubjectOption>('/api/v1/subjects');
  const query = useQuery({
    queryKey: ['my-grades'],
    queryFn: () => apiRequest<GradeEntry[]>('/api/v1/me/grades'),
  });
  const summaryQuery = useQuery({
    queryKey: ['my-learning-summary'],
    queryFn: () => apiRequest<{ narrative: string; series: Array<{ percent: number; label: string }> }>('/api/v1/me/learning-summary'),
  });
  const grades = query.data ?? [];

  const getSubjectName = (subjectId: string, directName?: string) =>
    subjects.items.find((s) => s.id === subjectId)?.name ?? directName ?? subjectId;

  return (
    <>
      <PageHeader eyebrow="Tiến độ học tập" title="Điểm của em" lede="Bảng điểm theo môn và kỳ. Điểm tạm tính chỉ gồm phần đã chấm tự động; điểm chính thức cập nhật sau khi giáo viên hoàn tất." />
      {summaryQuery.data?.narrative && <p className="workspace-feature" role="note">{summaryQuery.data.narrative}</p>}
      {summaryQuery.data?.series && summaryQuery.data.series.length > 0 && (
        <div className="progress-bars" aria-label="Biến thiên điểm">
          {summaryQuery.data.series.map((point, index) => (
            <span key={`${point.label}-${index}`} style={{ height: `${Math.max(8, point.percent)}%` }} title={`${point.label}: ${point.percent}%`} />
          ))}
        </div>
      )}
      {query.isPending && <EmptyState>Đang tải điểm…</EmptyState>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>Chưa thể tải điểm.</ErrorState>}
      {query.isSuccess && grades.length === 0 && <EmptyState>Chưa có điểm nào được ghi nhận.</EmptyState>}

      {grades.length > 0 && (
        <>
          <section className="grade-chart-panel" aria-label="Biểu đồ tổng quan điểm số theo môn">
            <h2>Biểu đồ điểm trung bình theo môn</h2>
            <div className="grade-chart-bars">
              {Array.from(new Set(grades.map((g) => g.subjectId))).map((sId) => {
                const sGrades = grades.filter((g) => g.subjectId === sId);
                const avgPct = sGrades.reduce((acc, curr) => acc + (curr.score / curr.maxScore), 0) / sGrades.length;
                const avg10 = (avgPct * 10).toFixed(1);
                const sName = getSubjectName(sId, sGrades[0]?.subjectName);
                return (
                  <div key={sId} className="grade-chart-item">
                    <span className="grade-chart-label" title={sName}>{sName}</span>
                    <div className="grade-chart-track" role="progressbar" aria-valuenow={Math.round(avgPct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Điểm trung bình môn ${sName}`}>
                      <div className="grade-chart-fill" style={{ width: `${Math.round(avgPct * 100)}%` }} />
                    </div>
                    <span className="grade-chart-val">{avg10}/10</span>
                  </div>
                );
              })}
            </div>
          </section>

      <DataTable headers={['Ngày', 'Môn / bài', 'Kỳ', 'Trạng thái', 'Điểm']}>
            {grades.map((grade) => (
              <tr key={grade.id}>
                <td>{new Date(grade.recordedAt).toLocaleDateString('vi-VN')}</td>
                <td><b>{getSubjectName(grade.subjectId, grade.subjectName)}</b>{grade.assignmentTitle && <small className="grade-assignment-title">{grade.assignmentTitle}</small>}</td>
                <td>{grade.examPeriod ? PERIOD_LABELS[grade.examPeriod] ?? grade.examPeriod : 'Trên lớp'}</td>
                <td><StatusBadge tone={grade.status === 'PROVISIONAL' ? 'pending' : grade.source === 'OVERRIDE' ? 'pending' : 'approved'}>{statusLabel(grade)}</StatusBadge></td>
                <td>
                  {grade.score}/{grade.maxScore}
                  <span className="grade-bar" aria-hidden="true" style={{ display: 'inline-block', width: '4rem', height: '0.5rem', marginLeft: '0.5rem', background: 'var(--cream, #f3f0e4)', borderRadius: '4px', verticalAlign: 'middle' }}>
                    <span style={{ display: 'block', height: '100%', borderRadius: '4px', width: `${Math.min(100, (grade.score / grade.maxScore) * 100)}%`, background: 'var(--green, #1e543c)' }} />
                  </span>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      )}
    </>
  );
}
