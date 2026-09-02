import { useEffect, useState } from 'react';
import { ChatShell, type ChatAttachment, type ChatSessionItem } from '../components/ui/ChatShell.js';
import { type ChatBubble } from '../components/ui/ChatThread.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, apiUrl, ApiRequestError, ensureApiBase, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type ClassOption, type SubjectOption } from '../lib/catalog.js';
import { presentAssistantText } from '../lib/present-assistant.js';
import { useSession } from '../lib/SessionContext.js';
import { STUDY_CHAT_DEFAULTS } from './ai-study-defaults.js';
import './ai-study.css';
import { visibleAiStudyNotice } from './ai-study-notice.js';

interface Citation { documentId: string; documentTitle: string; chunkId: string; ordinal: number; score: number; snippet: string }
interface ChatReply {
  sessionId: string;
  mode: 'GROUNDED' | 'GENERAL' | 'REFUSED';
  executionMode: 'MODEL' | 'UNAVAILABLE';
  provider: string | null;
  usedModel: string | null;
  requestId: string;
  usage: { inputTokens: number; outputTokens: number; estimatedCostVnd: number };
  notice?: string;
  overflow?: boolean;
  tokenCount?: number;
  tokenLimit?: number;
  message: { id: string; role: 'ASSISTANT'; content: string; citations: Citation[]; createdAt: string };
}
interface RagDoc { id: string; title: string; status: string }
interface LessonOption { id: string; title: string }
interface ResourceOption { id: string; title?: string; originalName?: string; status?: string }

export function AiAssistantPage() {
  const { user } = useSession();
  const learner = user.role === 'STUDENT';
  const subjects = useCatalog<SubjectOption>(learner ? null : '/api/v1/subjects');
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [ragDocs, setRagDocs] = useState<RagDoc[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenLimit, setTokenLimit] = useState(128_000);
  const [runCode, setRunCode] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  async function loadSessions() {
    const rows = await apiRequest<Array<{ id: string; title?: string; lastAt?: string | null; createdAt: string; status?: string; tokenCount?: number }>>('/api/v1/ai/sessions').catch(() => []);
    setSessions((rows ?? []).map((row) => ({
      id: row.id,
      title: row.title || 'Cuộc trò chuyện',
      updatedAt: row.lastAt ?? row.createdAt,
      status: row.status,
    })));
  }

  useEffect(() => {
    void loadSessions();
    let timer: number | undefined;
    const recover = async () => {
      const jobs = await apiRequest<Array<{ jobId: string; status: string; stage: string; progress: number }>>('/api/v1/ai/jobs').catch(() => []);
      const active = jobs[0];
      if (!active) return;
      setActiveJobId(active.jobId);
      setNotice(`Thinking đang tiếp tục · ${active.stage} · ${active.progress}%`);
      timer = window.setInterval(async () => {
        const job = await apiRequest<{ status: string; stage: string; progress: number }>(`/api/v1/ai/jobs/${active.jobId}`).catch(() => null);
        if (!job) return;
        setNotice(`Thinking · ${job.stage} · ${job.progress}%`);
        if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
          if (timer !== undefined) window.clearInterval(timer);
          setActiveJobId(null);
          await loadSessions();
          if (job.status === 'COMPLETED') setNotice('Thinking đã hoàn tất. Hãy mở phiên trò chuyện để xem kết quả.');
        }
      }, 1_000);
    };
    void recover();
    return () => { if (timer !== undefined) window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    void apiRequest<RagDoc[]>('/api/v1/ai/rag/documents').then(setRagDocs).catch(() => setRagDocs([]));
  }, []);

  useEffect(() => {
    if (!classId) { setLessons([]); setResources([]); return; }
    void apiRequest<LessonOption[]>('/api/v1/lessons', { query: { classId, subjectId: subjectId || undefined } }).then(setLessons).catch(() => setLessons([]));
    void apiRequest<{ items: ResourceOption[] }>('/api/v1/resources', { query: { classId, status: 'READY', pageSize: '50' } })
      .then((data) => setResources(data.items ?? []))
      .catch(() => setResources([]));
  }, [classId, subjectId]);

  async function openSession(id: string) {
    setSessionId(id);
    try {
      const rows = await apiRequest<Array<{ id: string; role: 'USER' | 'ASSISTANT'; content: string; citations?: Citation[] }>>(`/api/v1/ai/sessions/${id}/messages`);
      setMessages((rows ?? []).map((row) => ({
        id: row.id,
        role: row.role,
        content: row.role === 'ASSISTANT' ? presentAssistantText(learner ? 'PERSONAL_STUDY' : 'ASSISTANT', row.content) : row.content,
        citations: row.citations,
      })));
    } catch {
      setMessages([]);
    }
  }

  function newSession() {
    setSessionId(null);
    setMessages([]);
    setTokenCount(0);
    setNotice('');
  }

  async function send(text: string) {
    setSending(true);
    setNotice('');
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'USER', content: text }]);
    try {
      const requestBody = {
        message: text,
        sessionId,
        classId: classId || null,
        subjectId: subjectId || null,
        purpose: learner ? 'PERSONAL_STUDY' : 'ASSISTANT',
        documentIds: documentIds.length ? documentIds : undefined,
        lessonIds: lessonIds.length ? lessonIds : undefined,
        runCode: STUDY_CHAT_DEFAULTS.agentic && (runCode || text.includes('```')),
        ...STUDY_CHAT_DEFAULTS,
        attachmentResourceIds: attachments.filter((item) => item.status === 'READY').map((item) => item.id),
      };
      const reply = await apiRequest<ChatReply>('/api/v1/ai/chat', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('ai-chat'),
        body: requestBody,
      });
      setSessionId(reply.sessionId);
      setTokenCount(reply.tokenCount ?? 0);
      setTokenLimit(reply.tokenLimit ?? 128_000);
      setMessages((prev) => [...prev, {
        id: reply.message.id,
        role: 'ASSISTANT',
        content: presentAssistantText(learner ? 'PERSONAL_STUDY' : 'ASSISTANT', reply.message.content),
        citations: reply.message.citations,
      }]);
      setNotice(visibleAiStudyNotice(reply));
      await loadSessions();
    } catch (error) {
      setNotice(error instanceof ApiRequestError ? error.message : 'Chưa gửi được câu hỏi.');
    } finally {
      setActiveJobId(null);
      setSending(false);
    }
  }

  async function cancelThinking() {
    if (!activeJobId) return;
    try {
      await apiRequest(`/api/v1/ai/jobs/${activeJobId}/cancel`, { method: 'POST', idempotencyKey: newIdempotencyKey('ai-job-cancel') });
      setNotice('Thinking đã được hủy trên máy chủ.');
    } catch (error) {
      setNotice(error instanceof ApiRequestError ? error.message : 'Chưa hủy được Thinking.');
    }
  }

  async function attachFile(file: File) {
    const localId = `upload-${Date.now()}`;
    setAttachments((current) => [...current, { id: localId, name: file.name, status: 'UPLOADING' }]);
    try {
      await ensureApiBase();
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(apiUrl('/api/v1/library/uploads'), { method: 'POST', credentials: 'include', headers: { 'x-idempotency-key': newIdempotencyKey('library-upload') }, body: form });
      const payload = await response.json() as { data?: { id?: string } };
      if (!response.ok || !payload.data?.id) throw new Error('Tài liệu chưa được tải lên.');
      setAttachments((current) => current.map((item) => item.id === localId ? { ...item, id: payload.data!.id!, status: 'READY' } : item));
      setNotice('Đã thêm tài liệu riêng. AI sẽ tự cân nhắc tài liệu này trong phạm vi an toàn.');
    } catch (error) {
      setAttachments((current) => current.map((item) => item.id === localId ? { ...item, status: 'FAILED' } : item));
      setNotice(error instanceof Error ? error.message : 'Chưa tải được tài liệu.');
    }
  }

  const ratio = tokenLimit > 0 ? tokenCount / tokenLimit : 0;
  const banner = ratio >= 0.9 ? (
    <p className="token-banner" role="status">Phiên gần đầy ngữ cảnh (~{Math.round(ratio * 100)}% của 128k). Hệ thống sẽ tự mở tab mới khi đầy.</p>
  ) : null;

  function toggle(list: string[], id: string, setter: (value: string[]) => void) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <div className="ai-study-page">
      <PageHeader
        compact
        eyebrow={learner ? 'Học tập cá nhân' : 'Soạn bài AI'}
        title={learner ? 'AI học tập' : 'Soạn bài AI'}
        lede={learner
          ? 'AI học tập ưu tiên tài liệu lớp/môn khi có, nêu rõ kiến thức chung, và không đưa đáp án trực tiếp cho bài đang mở.'
          : 'Ưu tiên trả lời dựa trên tài liệu của trường và trích dẫn nguồn. Khi không có tài liệu phù hợp, câu trả lời dùng kiến thức chung và ghi rõ điều đó. Không đưa đáp án trực tiếp cho bài đang mở.'}
      />

      <div className="ai-study-chat">
      <ChatShell
        sessions={sessions}
        currentSessionId={sessionId}
        onSelectSession={(id) => void openSession(id)}
        onNewSession={newSession}
        messages={messages}
        sending={sending}
        notice={notice}
        onSend={send}
        placeholder="Nhập câu hỏi học tập…"
        submitLabel="Gửi câu hỏi"
        banner={banner}
        footerNote={activeJobId ? <button type="button" className="button button-quiet text-xs" onClick={() => void cancelThinking()}>Hủy Thinking</button> : undefined}
        onAttachFile={attachFile}
        attachments={attachments}
        contextSlot={(
          <section className="workspace-feature ai-context-panel" aria-labelledby="scope-title">
            <h2 id="scope-title">AI tự chọn tài liệu</h2>
            <p className="muted-copy">Mỗi câu hỏi sẽ tự đọc bài giảng và tài liệu phù hợp với lớp/môn. Em không cần mở từng tài liệu; có thể điều chỉnh phạm vi khi muốn.</p>
            <details className="ai-context-advanced">
              <summary>Tài liệu: tự động · Điều chỉnh phạm vi</summary>
            <div className="filter-row">
              {!learner && (
                <>
                  <label htmlFor="chatSubject">Môn</label>
                  <select id="chatSubject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                    <option value="">Tất cả môn</option>
                    {subjects.items.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                </>
              )}
              <label htmlFor="chatClass">Lớp</label>
              <select id="chatClass" value={classId} onChange={(event) => setClassId(event.target.value)}>
                <option value="">Tất cả lớp</option>
                {classes.items.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
              <label>
                <input type="checkbox" checked={runCode} onChange={(event) => setRunCode(event.target.checked)} />
                Cho phép chạy mã khi cần
              </label>
            </div>
            {ragDocs.length > 0 && (
              <fieldset>
                <legend>Tài liệu bổ sung (tùy chọn)</legend>
                <div className="context-picks">
                  {ragDocs.filter((doc) => doc.status === 'READY' || !doc.status).slice(0, 20).map((doc) => (
                    <label key={doc.id} style={{ fontWeight: 400 }}>
                      <input type="checkbox" checked={documentIds.includes(doc.id)} onChange={() => toggle(documentIds, doc.id, setDocumentIds)} />
                      {doc.title}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {lessons.length > 0 && (
              <fieldset>
                <legend>Bài giảng</legend>
                <div className="context-picks">
                  {lessons.slice(0, 20).map((lesson) => (
                    <label key={lesson.id} style={{ fontWeight: 400 }}>
                      <input type="checkbox" checked={lessonIds.includes(lesson.id)} onChange={() => toggle(lessonIds, lesson.id, setLessonIds)} />
                      {lesson.title}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {resources.length > 0 && (
              <p className="muted-copy">Tài nguyên READY: {resources.slice(0, 6).map((item) => item.title || item.originalName).join(', ')}</p>
            )}
            </details>
          </section>
        )}
      />
      </div>
    </div>
  );
}
