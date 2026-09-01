import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader.js';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { apiRequest, ApiRequestError } from '../lib/api.js';

interface ProctoredExam { id: string; title: string; subjectName: string; dueAt: string | null; lockedCount: number }
interface IntegrityEvent { id: string; kind: string; occurredAt: string; studentName: string; studentCode: string | null }

export function ProctorPage() {
  const exams = useQuery({ queryKey: ['proctor-exams'], queryFn: () => apiRequest<ProctoredExam[]>('/api/v1/exams/proctoring') });
  const items = exams.data ?? [];
  const firstId = items[0]?.id;
  const log = useQuery({
    queryKey: ['exam-integrity', firstId],
    queryFn: () => apiRequest<IntegrityEvent[]>(`/api/v1/exams/${firstId}/integrity`),
    enabled: Boolean(firstId),
  });

  return (
    <>
      <PageHeader eyebrow="Thi thử của trường" title="Giám thị" lede="Theo dõi nhật ký rời trang. Đây không phải phần mềm thi của Bộ." />
      {exams.isPending && <EmptyState>Đang tải ca thi…</EmptyState>}
      {exams.isError && <ErrorState onRetry={() => void exams.refetch()}>{exams.error instanceof ApiRequestError ? exams.error.message : 'Chưa tải được.'}</ErrorState>}
      {exams.isSuccess && items.length === 0 && <EmptyState>Chưa được phân công giám thị ca nào.</EmptyState>}
      {items.length > 0 && (
        <DataTable headers={['Ca thi', 'Môn', 'Đã khóa']}>
          {items.map((exam) => (
            <tr key={exam.id}><td>{exam.title}</td><td>{exam.subjectName}</td><td>{exam.lockedCount}</td></tr>
          ))}
        </DataTable>
      )}
      {(log.data ?? []).length > 0 && (
        <section className="workspace-feature">
          <h2>Nhật ký ca gần nhất</h2>
          <ul>{(log.data ?? []).slice(0, 20).map((event) => <li key={event.id}>{event.studentName} · {event.kind} · {new Date(event.occurredAt).toLocaleString('vi-VN')}</li>)}</ul>
        </section>
      )}
    </>
  );
}
