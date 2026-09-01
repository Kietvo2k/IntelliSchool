import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';

interface RagDocument { id: string; title: string; sourceKind: 'RESOURCE' | 'LESSON' | 'TEXT'; status: string; className: string | null; subjectName: string | null; chunkCount: number; createdByName: string | null; updatedAt: string; }
interface LessonOption { id: string; title: string; }
interface ClassOption { id: string; }

const SOURCE_LABEL: Record<RagDocument['sourceKind'], string> = { RESOURCE: 'Tệp', LESSON: 'Bài giảng', TEXT: 'Văn bản' };

export function AiKnowledgePage() {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [sourceKind, setSourceKind] = useState<'TEXT' | 'LESSON'>('TEXT');
  const [state, setState] = useState<'idle' | 'loading' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function reload() {
    setState('loading');
    try {
      const [docs, classes] = await Promise.all([
        apiRequest<RagDocument[]>('/api/v1/ai/rag/documents'),
        apiRequest<ClassOption[]>('/api/v1/classes'),
      ]);
      const lessonLists = await Promise.all(classes.map((schoolClass) => (
        apiRequest<LessonOption[]>('/api/v1/lessons', { query: { classId: schoolClass.id } }).catch(() => [])
      )));
      setDocuments(docs ?? []);
      setLessons(lessonLists.flat());
      setState('idle');
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải danh sách tài liệu.');
    }
  }

  useEffect(() => { void reload(); }, []);

  async function ingest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState('sending');
    setMessage('');
    try {
      const body = sourceKind === 'LESSON'
        ? { sourceKind: 'LESSON' as const, title: String(data.get('title') ?? ''), lessonId: String(data.get('lessonId') ?? '') || null }
        : { sourceKind: 'TEXT' as const, title: String(data.get('title') ?? ''), text: String(data.get('text') ?? '') };
      const result = await apiRequest<{ chunkCount: number }>('/api/v1/ai/rag/documents', { method: 'POST', idempotencyKey: newIdempotencyKey('rag-ingest'), body });
      setMessage(`Đã nạp tài liệu thành ${result.chunkCount} đoạn tri thức.`);
      setState('idle');
      form.reset();
      await reload();
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể nạp tài liệu.');
    }
  }

  async function remove(documentId: string) {
    setState('sending');
    setMessage('');
    try {
      await apiRequest(`/api/v1/ai/rag/documents/${documentId}`, { method: 'DELETE', idempotencyKey: newIdempotencyKey('rag-del') });
      setDocuments((current) => current.filter((doc) => doc.id !== documentId));
      setState('idle');
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể xóa tài liệu.');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Soạn bài AI" title="Kho tri thức cho AI" lede="Nạp tài liệu để AI trả lời bám sát nội dung của trường và trích dẫn nguồn. Có thể nạp trực tiếp từ bài giảng hoặc dán văn bản. Nội dung được tách đoạn và lập chỉ mục để truy hồi." />
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</p>}

      <section className="workspace-feature" aria-labelledby="ingest-title">
        <h2 id="ingest-title">Nạp tài liệu mới</h2>
        <form className="login-form" onSubmit={ingest}>
          <label htmlFor="ragSource">Nguồn</label>
          <select id="ragSource" name="sourceKind" value={sourceKind} onChange={(e) => setSourceKind(e.target.value as 'TEXT' | 'LESSON')}>
            <option value="TEXT">Dán văn bản</option>
            <option value="LESSON">Từ bài giảng</option>
          </select>
          <label htmlFor="ragTitle">Tiêu đề tài liệu</label>
          <input id="ragTitle" name="title" required minLength={3} maxLength={200} placeholder="Ví dụ: Chương 1 - Quang hợp" />
          {sourceKind === 'LESSON' ? (
            <>
              <label htmlFor="ragLesson">Bài giảng</label>
              <select id="ragLesson" name="lessonId" required>
                <option value="">— Chọn bài giảng —</option>
                {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
              </select>
            </>
          ) : (
            <>
              <label htmlFor="ragText">Nội dung</label>
              <textarea id="ragText" name="text" required rows={6} minLength={20} maxLength={50000} placeholder="Dán nội dung tài liệu (tối thiểu 20 ký tự)…" />
            </>
          )}
          <button className="button button-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Đang nạp…' : 'Nạp tài liệu'}</button>
        </form>
      </section>

      <section aria-labelledby="docs-title" style={{ marginTop: '1.25rem' }}>
        <h2 id="docs-title">Tài liệu đã nạp</h2>
        {documents.length === 0 ? <p className="workspace-state">Chưa có tài liệu nào.</p> : (
          <ul className="workspace-list">
            {documents.map((doc) => (
              <li key={doc.id} className="workspace-list-item">
                <div>
                  <strong>{doc.title}</strong> · {SOURCE_LABEL[doc.sourceKind]} · {doc.chunkCount} đoạn<br />
                  <small>{[doc.subjectName, doc.className].filter(Boolean).join(' · ') || 'Phạm vi toàn trường'} · {doc.status}{doc.createdByName ? ` · ${doc.createdByName}` : ''}</small>
                </div>
                <button type="button" className="button button-quiet" onClick={() => void remove(doc.id)} disabled={state === 'sending'}>Xóa</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
