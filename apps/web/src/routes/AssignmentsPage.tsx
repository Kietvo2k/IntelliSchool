import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FilterBar } from '../components/ui/FilterBar.js';
import { FormField, SelectInput } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type ClassOption } from '../lib/catalog.js';
import { useSession } from '../lib/SessionContext.js';

interface AssignmentView {
  id: string;
  subjectId: string;
  title: string;
  status: string;
  dueAt: string | null;
  maxAttempts?: number;
  attemptsUsed?: number;
  deliveryMode?: 'HOMEWORK' | 'EXAM';
  examPeriod?: string;
  examPeriodLabel?: string;
  itemCount?: number;
}

const statusLabel: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang mở',
  CLOSED: 'Đã đóng',
  ARCHIVED: 'Đã lưu trữ',
};

export function AssignmentsPage() {
  const { user } = useSession();
  const learner = user.role === 'STUDENT';
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const [classId, setClassId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!classId && classes.items[0]) setClassId(classes.items[0].id);
  }, [classId, classes.items]);

  const query = useQuery({
    queryKey: ['assignments', classId],
    queryFn: () => apiRequest<AssignmentView[]>('/api/v1/assignments', { query: { classId } }),
    enabled: Boolean(classId),
  });

  async function transition(assignmentId: string, action: 'publish' | 'close' | 'archive') {
    setMessage('');
    try {
      await apiRequest(`/api/v1/assignments/${assignmentId}/${action}`, { method: 'POST', idempotencyKey: newIdempotencyKey(`assignment-${action}`) });
      setMessage(action === 'publish' ? 'Đã xuất bản bài tập.' : action === 'close' ? 'Đã đóng bài tập. Học sinh không thể bắt đầu lượt mới.' : 'Đã lưu trữ bài tập.');
      await query.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể cập nhật trạng thái bài tập.');
    }
  }

  const assignments = query.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow={learner ? 'Bài tập của em' : 'Quản lý bài tập'}
        title="Bài tập theo lớp"
        lede={learner ? 'Làm bài trên một trang, nộp một lần cho mỗi lượt. Hệ thống không lưu nháp trên máy chủ.' : 'Tạo đề ở trạng thái nháp, rồi xuất bản khi sẵn sàng.'}
        actions={!learner && <Link className="ws-btn ws-btn-primary" to="/app/assignments/new">Tạo bài tập</Link>}
      />
      {message && <p className={`form-message ${message.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{message}</p>}
      <FilterBar>
        <FormField id="viewClassId" label="Lớp học">
          <SelectInput id="viewClassId" value={classId} onChange={(event) => setClassId(event.target.value)} disabled={classes.state === 'loading'}>
            <option value="">{classes.state === 'loading' ? 'Đang tải lớp…' : 'Chọn lớp'}</option>
            {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
          </SelectInput>
        </FormField>
      </FilterBar>
      {query.isPending && classId && <EmptyState>Đang tải bài tập…</EmptyState>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>Chưa thể tải bài tập.</ErrorState>}
      {classId && query.isSuccess && assignments.length === 0 && <EmptyState>Chưa có bài tập cho lớp này.</EmptyState>}
      {assignments.length > 0 && (
        <DataTable headers={learner ? ['Bài tập', 'Kỳ', 'Hạn nộp', 'Lượt làm', ''] : ['Bài tập', 'Kỳ', 'Trạng thái', 'Hạn nộp', '']}>
          {assignments.map((assignment) => (
            <tr key={assignment.id}>
              <td><b>{assignment.title}</b>{assignment.deliveryMode === 'EXAM' ? ' · thi thử' : ''}</td>
              <td>{assignment.deliveryMode === 'EXAM' ? assignment.examPeriodLabel ?? assignment.examPeriod ?? 'Luyện tập' : 'Bài tập'}</td>
              {!learner && <td><StatusBadge tone={assignment.status.toLowerCase()}>{statusLabel[assignment.status] ?? assignment.status}</StatusBadge></td>}
              <td>{assignment.dueAt ? new Date(assignment.dueAt).toLocaleString('vi-VN') : 'Không hạn'}</td>
              {learner && <td>{assignment.attemptsUsed ?? 0}/{assignment.maxAttempts ?? 1}</td>}
              <td>
                <span className="table-actions">
                  <Link className="ws-btn ws-btn-quiet" to={learner && assignment.deliveryMode === 'EXAM' ? '/app/exam' : `/app/assignments/${assignment.id}`}>{learner ? (assignment.deliveryMode === 'EXAM' ? 'Vào phòng thi' : 'Làm bài / xem') : assignment.status === 'DRAFT' ? 'Sửa nháp' : 'Xem đề'}</Link>
                  {!learner && assignment.status === 'DRAFT' && <button className="ws-btn ws-btn-primary" type="button" disabled={(assignment.itemCount ?? 0) < 5} title={(assignment.itemCount ?? 0) < 5 ? 'Cần tối thiểu 5 câu để xuất bản' : undefined} onClick={() => void transition(assignment.id, 'publish')}>Xuất bản</button>}
                  {!learner && assignment.status === 'PUBLISHED' && <button className="ws-btn ws-btn-quiet" type="button" onClick={() => void transition(assignment.id, 'close')}>Đóng</button>}
                  {!learner && assignment.status === 'CLOSED' && <button className="ws-btn ws-btn-quiet" type="button" onClick={() => void transition(assignment.id, 'archive')}>Lưu trữ</button>}
                </span>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
