import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader.js';
import { FilterBar } from '../components/ui/FilterBar.js';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { FormField, SelectInput } from '../components/ui/FormField.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type ClassOption } from '../lib/catalog.js';
import { parseLessonContent, type LessonStatus } from '../lib/lms.js';
import { useSession } from '../lib/SessionContext.js';

interface LessonView {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  content: unknown;
  status: LessonStatus;
  publishedAt: string | null;
  progress?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

const statusLabel: Record<LessonStatus, string> = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã xuất bản', ARCHIVED: 'Đã lưu trữ' };

export function LessonsPage() {
  const { user } = useSession();
  const learner = user.role === 'STUDENT';
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const [classId, setClassId] = useState('');
  const [message, setMessage] = useState('');

  const lessonsQuery = useQuery({
    queryKey: ['lessons', classId],
    queryFn: () => apiRequest<LessonView[]>('/api/v1/lessons', { query: { classId } }),
    enabled: Boolean(classId),
  });

  useEffect(() => {
    if (!classId && classes.items[0]) setClassId(classes.items[0].id);
  }, [classId, classes.items]);

  async function changeState(lessonId: string, action: 'publish' | 'archive') {
    setMessage('');
    try {
      await apiRequest(`/api/v1/lessons/${lessonId}/${action}`, { method: 'POST', idempotencyKey: newIdempotencyKey(`lesson-${action}`) });
      setMessage(action === 'publish' ? 'Đã xuất bản bài giảng.' : 'Đã lưu trữ bài giảng.');
      await lessonsQuery.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể cập nhật trạng thái bài giảng.');
    }
  }

  const lessons = lessonsQuery.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow={learner ? 'Bài giảng của em' : 'Quản lý bài giảng'}
        title="Bài giảng theo lớp"
        lede="Chọn lớp để xem nội dung đang mở. Tiến độ được lưu riêng cho từng học sinh."
        actions={!learner && <Link className="ws-btn ws-btn-primary" to="/app/lessons/new">Soạn bài mới</Link>}
      />
      {message && <p className={`form-message ${message.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{message}</p>}
      <FilterBar>
        <FormField id="lessonClassId" label="Lớp học">
          <SelectInput id="lessonClassId" value={classId} onChange={(event) => setClassId(event.target.value)} disabled={classes.state === 'loading'}>
            <option value="">{classes.state === 'loading' ? 'Đang tải lớp…' : 'Chọn lớp'}</option>
            {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
          </SelectInput>
        </FormField>
      </FilterBar>
      {lessonsQuery.isPending && classId && <EmptyState>Đang tải bài giảng…</EmptyState>}
      {lessonsQuery.isError && <ErrorState onRetry={() => void lessonsQuery.refetch()}>Chưa thể tải bài giảng.</ErrorState>}
      {classId && lessonsQuery.isSuccess && lessons.length === 0 && <EmptyState>Chưa có bài giảng phù hợp với lớp này.</EmptyState>}
      {lessons.length > 0 && (
        <DataTable headers={learner ? ['Bài giảng', 'Tiến độ', ''] : ['Bài giảng', 'Trạng thái', '']}>
          {lessons.map((lesson) => {
            const preview = parseLessonContent(lesson.content).blocks.find((block) => block.type === 'paragraph' || block.type === 'heading');
            return (
              <tr key={lesson.id}>
                <td>
                  <b>{lesson.title}</b>
                  <small>{preview && 'text' in preview ? preview.text.slice(0, 120) : 'Mở để đọc toàn bộ nội dung.'}</small>
                </td>
                <td>
                  {learner
                    ? <StatusBadge tone={lesson.progress === 'COMPLETED' ? 'approved' : 'pending'}>{lesson.progress === 'COMPLETED' ? 'Đã hoàn thành' : lesson.progress === 'IN_PROGRESS' ? 'Đang học' : 'Chưa bắt đầu'}</StatusBadge>
                    : <StatusBadge tone={lesson.status.toLowerCase()}>{statusLabel[lesson.status]}</StatusBadge>}
                </td>
                <td>
                  <span className="table-actions">
                    <Link className="ws-btn ws-btn-quiet" to={`/app/lessons/${lesson.id}`}>Đọc bài</Link>
                    {!learner && lesson.status === 'DRAFT' && <Link className="ws-btn ws-btn-quiet" to={`/app/lessons/${lesson.id}/edit`}>Sửa bản nháp</Link>}
                    {!learner && lesson.status === 'DRAFT' && <button className="ws-btn ws-btn-primary" type="button" onClick={() => void changeState(lesson.id, 'publish')}>Xuất bản</button>}
                    {!learner && lesson.status !== 'ARCHIVED' && <button className="ws-btn ws-btn-quiet" type="button" onClick={() => void changeState(lesson.id, 'archive')}>Lưu trữ</button>}
                  </span>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
