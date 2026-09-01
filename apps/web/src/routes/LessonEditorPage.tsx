import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LessonBlockEditor } from '../components/ui/LessonBlockEditor.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FormField, SelectInput, TextInput } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type ClassOption, type SubjectOption } from '../lib/catalog.js';
import { parseLessonContent, type LessonBlock, type ResourceOption } from '../lib/lms.js';

interface LessonView {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  content: unknown;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

function validBlocks(blocks: LessonBlock[]): LessonBlock[] {
  const next: LessonBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'heading' && block.text.trim()) next.push({ ...block, text: block.text.trim() });
    else if (block.type === 'paragraph' && block.text.trim()) next.push({ ...block, text: block.text.trim() });
    else if (block.type === 'bullets') {
      const items = block.items.map((item) => item.trim()).filter(Boolean);
      if (items.length) next.push({ type: 'bullets', items });
    } else if (block.type === 'resource' && block.resourceId) next.push(block);
    else if (block.type === 'formula' && block.latex.trim()) next.push({ type: 'formula', latex: block.latex.trim() });
    else if (block.type === 'html' && block.html.trim()) next.push({ type: 'html', html: block.html.trim() });
    else if (block.type === 'video_url' && block.url.trim()) next.push({ type: 'video_url', url: block.url.trim() });
  }
  return next;
}

export function LessonEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const subjects = useCatalog<SubjectOption>('/api/v1/subjects');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<LessonBlock[]>([{ type: 'paragraph', text: '' }]);
  const [publish, setPublish] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const existing = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => apiRequest<LessonView>(`/api/v1/lessons/${id}`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!existing.data) return;
    setClassId(existing.data.classId);
    setSubjectId(existing.data.subjectId);
    setTitle(existing.data.title);
    const parsed = parseLessonContent(existing.data.content);
    setBlocks(parsed.blocks.length ? parsed.blocks : [{ type: 'paragraph', text: '' }]);
    setVideoUrl(parsed.video?.url ?? '');
    setAvailableFrom(parsed.availableFrom ? parsed.availableFrom.slice(0, 16) : '');
    setAvailableUntil(parsed.availableUntil ? parsed.availableUntil.slice(0, 16) : '');
  }, [existing.data]);

  const resourcesQuery = useQuery({
    queryKey: ['resources-ready', classId, subjectId],
    queryFn: () => apiRequest<{ items: ResourceOption[] }>('/api/v1/resources', { query: { classId, subjectId, status: 'READY', pageSize: '100' } }),
    enabled: Boolean(classId && subjectId),
  });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = {
      blocks: validBlocks(blocks),
      video: videoUrl.trim() ? { url: videoUrl.trim(), provider: 'YOUTUBE' as const } : {},
      availableFrom: availableFrom ? new Date(availableFrom).toISOString() : null,
      availableUntil: availableUntil ? new Date(availableUntil).toISOString() : null,
    };
    if (!title.trim() || content.blocks.length === 0) {
      setMessage('Cần tiêu đề và ít nhất một khối nội dung hợp lệ.');
      return;
    }
    setSending(true); setMessage('');
    try {
      if (id) {
        await apiRequest(`/api/v1/lessons/${id}`, { method: 'PATCH', idempotencyKey: newIdempotencyKey('lesson-update'), body: { title: title.trim(), content } });
        setMessage('Đã cập nhật bản nháp bài giảng.');
        navigate(`/app/lessons/${id}`);
      } else {
        const created = await apiRequest<{ id: string }>('/api/v1/lessons', {
          method: 'POST', idempotencyKey: newIdempotencyKey('lesson-create'),
          body: { classId, subjectId, title: title.trim(), content, publish },
        });
        navigate(`/app/lessons/${created.id}`);
      }
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu bài giảng.');
    } finally {
      setSending(false);
    }
  }

  if (id && existing.isPending) return <EmptyState>Đang tải bản nháp…</EmptyState>;
  if (id && existing.isError) return <ErrorState onRetry={() => void existing.refetch()}>Chưa thể tải bài giảng.</ErrorState>;

  return (
    <>
      <PageHeader eyebrow={id ? 'Sửa bản nháp' : 'Soạn bài mới'} title={id ? 'Cập nhật nội dung' : 'Soạn bài mới'} actions={<Link className="ws-btn ws-btn-quiet" to="/app/lessons">Hủy</Link>} />
      {message && <p className="form-message is-error" role="alert">{message}</p>}
      <form className="grid max-w-3xl gap-4" onSubmit={(event) => void save(event)}>
        {!id && (
          <>
            <FormField id="editorClassId" label="Lớp học">
              <SelectInput id="editorClassId" value={classId} required onChange={(event) => setClassId(event.target.value)}>
                <option value="">Chọn lớp</option>
                {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
              </SelectInput>
            </FormField>
            <FormField id="editorSubjectId" label="Môn học">
              <SelectInput id="editorSubjectId" value={subjectId} required onChange={(event) => setSubjectId(event.target.value)}>
                <option value="">Chọn môn học</option>
                {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </SelectInput>
            </FormField>
          </>
        )}
        <FormField id="lessonTitle" label="Tiêu đề">
          <TextInput id="lessonTitle" value={title} required minLength={3} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </FormField>
        <FormField id="lessonVideo" label="Video bài giảng (YouTube/Vimeo)">
          <TextInput id="lessonVideo" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        </FormField>
        <FormField id="lessonFrom" label="Mở từ (để trống = luôn mở)">
          <TextInput id="lessonFrom" type="datetime-local" value={availableFrom} onChange={(event) => setAvailableFrom(event.target.value)} />
        </FormField>
        <FormField id="lessonUntil" label="Đóng lúc">
          <TextInput id="lessonUntil" type="datetime-local" value={availableUntil} onChange={(event) => setAvailableUntil(event.target.value)} />
        </FormField>
        <LessonBlockEditor blocks={blocks} onChange={setBlocks} resources={resourcesQuery.data?.items ?? []} />
        {!id && <label className="ws-label"><input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} /> Xuất bản ngay sau khi tạo</label>}
        <button className="ws-btn ws-btn-primary justify-self-start" type="submit" disabled={sending}>{sending ? 'Đang lưu…' : id ? 'Lưu bản nháp' : 'Tạo bài giảng'}</button>
      </form>
    </>
  );
}
