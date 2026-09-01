import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FilterBar } from '../components/ui/FilterBar.js';
import { FormField, SelectInput } from '../components/ui/FormField.js';
import { MetricCard } from '../components/ui/MetricCard.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { apiRequest } from '../lib/api.js';
import { useCatalog, type ClassOption, type PersonOption, type SubjectOption } from '../lib/catalog.js';
import { ReportExportsPanel } from './ReportExportsPanel.js';

interface ProgressStudent {
  studentId: string;
  displayName: string;
  studentCode: string;
  assignedCount: number;
  submittedCount: number;
  completionPercent: number;
  averagePercent: number;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE' | 'NO_DATA';
  needsSupport: boolean;
}

interface ProgressReport {
  students: ProgressStudent[];
  summary: {
    learnerCount: number;
    averageCompletionPercent: number;
    averageScorePercent: number;
    needsSupportCount: number;
    narrative?: string;
  };
}

const trendLabel: Record<ProgressStudent['trend'], string> = {
  IMPROVING: 'Đang tiến bộ',
  DECLINING: 'Cần theo dõi',
  STABLE: 'Ổn định',
  NO_DATA: 'Chưa đủ dữ liệu',
};

export function ProgressReportPage() {
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const subjects = useCatalog<SubjectOption>('/api/v1/subjects');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const students = useCatalog<PersonOption>(classId ? `/api/v1/students?classId=${encodeURIComponent(classId)}` : null);

  useEffect(() => {
    if (!classId && classes.items[0]) setClassId(classes.items[0].id);
  }, [classId, classes.items]);

  const query = useQuery({
    queryKey: ['progress', classId, subjectId, studentId],
    queryFn: () => apiRequest<ProgressReport>('/api/v1/progress', { query: { classId, subjectId: subjectId || undefined, studentId: studentId || undefined } }),
    enabled: Boolean(classId),
  });

  const report = query.data;
  return (
    <>
      <PageHeader eyebrow="Báo cáo lớp học" title="Tiến độ học tập" lede="Đối chiếu mức hoàn thành, điểm trung bình và tín hiệu cần hỗ trợ theo dữ liệu bài tập đã xuất bản." />
      <FilterBar>
        <FormField id="progressClassId" label="Lớp học">
          <SelectInput id="progressClassId" value={classId} onChange={(event) => { setClassId(event.target.value); setStudentId(''); }}>
            <option value="">{classes.state === 'loading' ? 'Đang tải lớp…' : 'Chọn lớp'}</option>
            {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
          </SelectInput>
        </FormField>
        <FormField id="progressSubjectId" label="Môn học">
          <SelectInput id="progressSubjectId" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">Tất cả môn học</option>
            {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField id="progressStudentId" label="Học sinh">
          <SelectInput id="progressStudentId" value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!classId}>
            <option value="">Tất cả học sinh</option>
            {students.items.map((item) => <option key={item.id} value={item.id}>{item.displayName}{item.studentCode ? ` · ${item.studentCode}` : ''}</option>)}
          </SelectInput>
        </FormField>
      </FilterBar>
      {query.isPending && classId && <EmptyState>Đang tổng hợp…</EmptyState>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>Chưa thể tải báo cáo tiến độ.</ErrorState>}
      {report && (
        <>
          <section className="metric-grid" aria-label="Tóm tắt tiến độ">
            <MetricCard label="Học sinh" value={report.summary.learnerCount} />
            <MetricCard label="Hoàn thành trung bình" value={report.summary.averageCompletionPercent} unit="%" />
            <MetricCard label="Điểm trung bình" value={report.summary.averageScorePercent} unit="%" />
            <MetricCard label="Cần hỗ trợ" value={report.summary.needsSupportCount} />
          </section>
          {report.summary.narrative && <p className="workspace-feature" role="note">{report.summary.narrative}</p>}
          {report.students.length > 0 && (
            <div className="progress-bars" aria-hidden="true">
              {report.students.slice(0, 24).map((student) => (
                <span key={student.studentId} style={{ height: `${Math.max(8, student.averagePercent)}%` }} title={`${student.displayName}: ${student.averagePercent}%`} />
              ))}
            </div>
          )}
          {report.students.length === 0 ? <EmptyState>Chưa có học sinh hoặc bài tập đã xuất bản trong phạm vi đã chọn.</EmptyState> : (
            <DataTable headers={['Học sinh', 'Hoàn thành', 'Điểm TB', 'Xu hướng', '']}>
              {report.students.map((student) => (
                <tr key={student.studentId}>
                  <td><b>{student.displayName}</b><small>{student.studentCode} · {student.submittedCount}/{student.assignedCount} bài đã nộp</small></td>
                  <td>{student.completionPercent}%</td>
                  <td>{student.averagePercent}%</td>
                  <td><StatusBadge tone={student.needsSupport ? 'rejected' : student.trend === 'IMPROVING' ? 'approved' : 'pending'}>{trendLabel[student.trend]}</StatusBadge></td>
                  <td>{student.needsSupport ? 'Cần hỗ trợ' : ''}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </>
      )}
      <ReportExportsPanel classId={classId} />
    </>
  );
}
