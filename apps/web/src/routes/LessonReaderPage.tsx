import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { apiRequest, apiUrl, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { isImageMime, parseLessonContent, embedVideoSrc, type LessonBlock, type ResourceOption } from '../lib/lms.js';
import { useSession } from '../lib/SessionContext.js';

interface LessonView {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  content: unknown;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  progress?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

function ResourceBlock({ block, resources }: { block: Extract<LessonBlock, { type: 'resource' }>; resources: ResourceOption[] }) {
  const resource = resources.find((item) => item.id === block.resourceId);
  if (!block.resourceId) return <p className="text-muted">Chưa chọn tệp.</p>;
  const contentUrl = apiUrl(`/api/v1/resources/${block.resourceId}/content`);
  if (resource && isImageMime(resource.mimeType)) {
    return <img src={contentUrl} alt={resource.originalName} className="max-w-full rounded-xl border border-line" />;
  }
  return (
    <p>
      {resource?.originalName ?? 'Tài nguyên đính kèm'}{' '}
      <a className="text-link" href={apiUrl(`/api/v1/resources/${block.resourceId}/download`)}>Mở / tải</a>
    </p>
  );
}

export function LessonReaderPage() {
  const { id = '' } = useParams();
  const { user } = useSession();
  const learner = user.role === 'STUDENT';
  const [message, setMessage] = useState('');
  const lessonQuery = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => apiRequest<LessonView>(`/api/v1/lessons/${id}`),
    enabled: Boolean(id),
  });
  const lesson = lessonQuery.data;
  useEffect(() => {
    if (!learner || !lesson || lesson.progress !== 'NOT_STARTED') return;
    void apiRequest(`/api/v1/lessons/${id}/progress`, { method: 'POST', idempotencyKey: newIdempotencyKey('lesson-auto-start'), body: { status: 'IN_PROGRESS' } }).catch(() => undefined);
  }, [id, learner, lesson]);
  const resourcesQuery = useQuery({
    queryKey: ['resources-ready', lesson?.classId, lesson?.subjectId],
    queryFn: () => apiRequest<{ items: ResourceOption[] }>('/api/v1/resources', { query: { classId: lesson?.classId, subjectId: lesson?.subjectId, status: 'READY', pageSize: '100' } }),
    enabled: Boolean(lesson?.classId),
  });

  async function updateProgress(status: 'IN_PROGRESS' | 'COMPLETED') {
    setMessage('');
    try {
      await apiRequest(`/api/v1/lessons/${id}/progress`, { method: 'POST', idempotencyKey: newIdempotencyKey('lesson-progress'), body: { status } });
      setMessage(status === 'COMPLETED' ? 'Đã đánh dấu hoàn thành.' : 'Đã bắt đầu học.');
      await lessonQuery.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể cập nhật tiến độ.');
    }
  }

  if (lessonQuery.isPending) return <EmptyState>Đang tải bài giảng…</EmptyState>;
  if (lessonQuery.isError || !lesson) return <ErrorState onRetry={() => void lessonQuery.refetch()}>Chưa thể tải bài giảng.</ErrorState>;
  const parsed = parseLessonContent(lesson.content);
  const blocks = parsed.blocks;
  const resources = resourcesQuery.data?.items ?? [];
  const embed = embedVideoSrc(parsed.video);
  const completed = lesson.progress === 'COMPLETED';

  return (
    <>
      <PageHeader
        eyebrow="Đọc bài"
        title={lesson.title}
        actions={(
          <>
            <Link className="ws-btn ws-btn-quiet" to="/app/lessons">Danh sách</Link>
            {!learner && lesson.status === 'DRAFT' && <Link className="ws-btn ws-btn-primary" to={`/app/lessons/${lesson.id}/edit`}>Sửa bản nháp</Link>}
          </>
        )}
      />
      {message && <p className="form-message is-success" role="status">{message}</p>}
      {learner && <p><StatusBadge tone={completed ? 'approved' : 'pending'}>{completed ? 'Đã hoàn thành' : lesson.progress === 'IN_PROGRESS' ? 'Đang học' : 'Chưa bắt đầu'}</StatusBadge></p>}
      {embed && (
        <div className="lesson-video">
          <iframe title="Video bài giảng" src={embed} referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          <p className="muted-copy">Nếu trình phát không mở được, <a className="text-link" href={parsed.video?.url} target="_blank" rel="noreferrer">mở video trên trang gốc</a>.</p>
        </div>
      )}
      <article className={`grid max-w-3xl gap-4${completed ? ' lesson-complete' : ''}`}>
        {blocks.length === 0 && !embed && <EmptyState>Nội dung bài giảng đang được cập nhật.</EmptyState>}
        {blocks.map((block, index) => {
          if (block.type === 'heading') return block.level === 3 ? <h3 key={index}>{block.text}</h3> : <h2 key={index}>{block.text}</h2>;
          if (block.type === 'paragraph') return <p key={index} className="leading-7 text-ink">{block.text}</p>;
          if (block.type === 'bullets') return <ul key={index} className="list-disc pl-6">{block.items.filter(Boolean).map((item) => <li key={item}>{item}</li>)}</ul>;
          if (block.type === 'formula') return <p key={index} className="lesson-formula" lang="la">{block.latex}</p>;
          if (block.type === 'html') return <div key={index} className="lesson-html" dangerouslySetInnerHTML={{ __html: block.html }} />;
          if (block.type === 'video_url') {
            const src = embedVideoSrc({ url: block.url });
            return src ? <div key={index} className="lesson-video"><iframe title="Video" src={src} referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /><p className="muted-copy">Nếu trình phát không mở được, <a className="text-link" href={block.url} target="_blank" rel="noreferrer">mở video trên trang gốc</a>.</p></div> : <p key={index} className="form-message is-error" role="alert">URL video chưa được hỗ trợ: {block.url}</p>;
          }
          if (block.type === 'resource') return <ResourceBlock key={index} block={block} resources={resources} />;
          return null;
        })}
      </article>
      {learner && lesson.progress !== 'COMPLETED' && (
        <div className="table-actions mt-6">
          {lesson.progress === 'NOT_STARTED' && <button className="ws-btn ws-btn-quiet" type="button" onClick={() => void updateProgress('IN_PROGRESS')}>Bắt đầu học</button>}
          <button className="ws-btn ws-btn-primary" type="button" onClick={() => void updateProgress('COMPLETED')}>Đánh dấu hoàn thành</button>
        </div>
      )}
    </>
  );
}
