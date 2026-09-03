import { useQuery } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AssistantRichText } from '../components/ui/AssistantRichText.js';
import { ChatThread, type ChatBubble } from '../components/ui/ChatThread.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FormField, SelectInput, TextArea, TextInput } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { parseComposeQuestions } from '../lib/compose-questions.js';
import { presentAssistantText } from '../lib/present-assistant.js';
import { useCatalog, type ClassOption, type SubjectOption } from '../lib/catalog.js';
import { useSession } from '../lib/SessionContext.js';

interface AssignmentItemView {
  id: string;
  questionVersionId: string;
  position: number;
  points: number;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';
  prompt: { text?: string; stem?: string; passage?: string; choices?: string[]; statements?: Array<{ key: string; text: string }>; unit?: string };
}
interface AssignmentDetail {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  instructions: string;
  dueAt: string | null;
  status: string;
  maxAttempts: number;
  gradingPolicy: 'HIGHEST' | 'LATEST' | 'AVERAGE';
  deliveryMode?: 'HOMEWORK' | 'EXAM';
  examPeriod?: 'PRACTICE' | 'MIDTERM_1' | 'FINAL_1' | 'MIDTERM_2' | 'FINAL_2' | 'MOCK_GRADUATION' | 'OTHER';
  durationMinutes?: number | null;
  showScoreOnSubmit?: boolean;
  items: AssignmentItemView[];
}
interface QuestionBankView { id: string; name: string; }
interface QuestionView { versionId: string; type: string; maxScore: number; isApproved: boolean; }
interface DraftAssignmentItem { questionVersionId: string; type: string; points: number; }
interface AttemptView {
  id: string;
  attemptNumber: number;
  status: string;
  submittedAt: string | null;
  gradedAt: string | null;
  isLate: boolean;
  score: number;
  maxScore: number;
  overallFeedback: string | null;
}

function draftKey(assignmentId: string): string {
  return `smartpath-assignment-draft:${assignmentId}`;
}

function choicesFor(item: AssignmentItemView): string[] {
  return Array.isArray(item.prompt.choices) ? item.prompt.choices.filter((choice): choice is string => typeof choice === 'string' && choice.trim().length > 0) : [];
}

function EducatorComposer({
  existing,
  onSaved,
}: {
  existing: AssignmentDetail | null;
  onSaved: (id: string) => void;
}) {
  const { user } = useSession();
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const subjects = useCatalog<SubjectOption>('/api/v1/subjects');
  const [classId, setClassId] = useState(existing?.classId ?? '');
  const [subjectId, setSubjectId] = useState(existing?.subjectId ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [dueAt, setDueAt] = useState(existing?.dueAt ? existing.dueAt.slice(0, 16) : '');
  const [maxAttempts, setMaxAttempts] = useState(existing?.maxAttempts ?? 1);
  const [gradingPolicy, setGradingPolicy] = useState<'HIGHEST' | 'LATEST' | 'AVERAGE'>(existing?.gradingPolicy ?? 'HIGHEST');
  const [deliveryMode, setDeliveryMode] = useState<'HOMEWORK' | 'EXAM'>(existing?.deliveryMode ?? 'HOMEWORK');
  const [examPeriod, setExamPeriod] = useState<NonNullable<AssignmentDetail['examPeriod']>>(existing?.examPeriod ?? 'PRACTICE');
  const [durationMinutes, setDurationMinutes] = useState(existing?.durationMinutes ?? 45);
  const [examPin, setExamPin] = useState('');
  const [showScoreOnSubmit, setShowScoreOnSubmit] = useState(existing?.showScoreOnSubmit ?? true);
  const [banks, setBanks] = useState<QuestionBankView[]>([]);
  const [questions, setQuestions] = useState<QuestionView[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [selectedQuestionPoints, setSelectedQuestionPoints] = useState(1);
  const [draftItems, setDraftItems] = useState<DraftAssignmentItem[]>(existing?.items.map((item) => ({ questionVersionId: item.questionVersionId, type: item.type, points: item.points })) ?? []);
  const [bankId, setBankId] = useState('');
  const [mcqCount, setMcqCount] = useState(2);
  const [tfCount, setTfCount] = useState(1);
  const [shortCount, setShortCount] = useState(1);
  const [essayCount, setEssayCount] = useState(1);
  const [composeMessages, setComposeMessages] = useState<ChatBubble[]>([]);
  const [composeSession, setComposeSession] = useState<string | null>(null);
  const [composeSending, setComposeSending] = useState(false);
  const [composedCards, setComposedCards] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const composeTotal = mcqCount + tfCount + shortCount + essayCount;

  const loadBanks = useCallback(async (nextSubjectId: string, resetItems: boolean) => {
    setBanks([]); setQuestions([]); setSelectedQuestionId('');
    if (resetItems) setDraftItems([]);
    if (!nextSubjectId) return;
    try { setBanks(await apiRequest<QuestionBankView[]>('/api/v1/question-banks', { query: { subjectId: nextSubjectId } })); }
    catch (error) { setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải ngân hàng câu hỏi.'); }
  }, []);

  const loadQuestions = useCallback(async (bankId: string) => {
    setQuestions([]); setSelectedQuestionId('');
    if (!bankId) return;
    try { setQuestions((await apiRequest<QuestionView[]>('/api/v1/questions', { query: { bankId } })).filter((question) => question.isApproved)); }
    catch (error) { setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải câu hỏi.'); }
  }, []);

  const existingSubjectId = existing?.subjectId;
  useEffect(() => {
    if (existingSubjectId) void loadBanks(existingSubjectId, false);
  }, [existingSubjectId, loadBanks]);

  function addDraftItem() {
    const question = questions.find((item) => item.versionId === selectedQuestionId);
    if (!question) { setMessage('Hãy chọn một câu hỏi đã duyệt trước khi thêm.'); return; }
    if (draftItems.some((item) => item.questionVersionId === question.versionId)) { setMessage('Câu hỏi này đã có trong bài tập.'); return; }
    setDraftItems((items) => [...items, { questionVersionId: question.versionId, type: question.type, points: selectedQuestionPoints }]);
    setSelectedQuestionId('');
    setSelectedQuestionPoints(1);
    setMessage('Đã thêm câu hỏi vào bài tập.');
  }

  async function importComposed(questionsToImport: Array<Record<string, unknown>>) {
    if (!bankId) { setMessage('Chọn ngân hàng trước khi AI điền khung.'); return; }
    let imported = 0;
    for (const question of questionsToImport) {
      const type = String(question.type ?? '');
      if (!['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY'].includes(type)) continue;
      const created = await apiRequest<{ versionId: string; type: string; maxScore: number }>('/api/v1/questions', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('compose-q'),
        body: { bankId, type, maxScore: Number(question.maxScore ?? 1), prompt: question.prompt ?? { text: 'Câu hỏi' }, answerKey: question.answerKey ?? {}, rubric: question.rubric ?? (type === 'ESSAY' ? { criteria: [{ label: 'Nội dung', maxScore: 1 }] } : {}) },
      });
      imported += 1;
      if (user.role === 'SCHOOL_OWNER') {
        await apiRequest(`/api/v1/question-versions/${created.versionId}/approve`, { method: 'POST', idempotencyKey: newIdempotencyKey('compose-approve') });
        setDraftItems((items) => items.some((item) => item.questionVersionId === created.versionId) ? items : [...items, { questionVersionId: created.versionId, type: created.type, points: created.maxScore }]);
      }
    }
    await loadQuestions(bankId);
    setMessage(user.role === 'SCHOOL_OWNER' ? `Đã điền ${imported} câu vào khung đề.` : `Đã thêm ${imported} câu vào ngân hàng. Cần duyệt rồi mới thêm vào đề.`);
  }

  async function sendCompose(text: string) {
    setComposeSending(true);
    setComposeMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'USER', content: text }]);
    try {
      const reply = await apiRequest<{ sessionId: string; message: { id: string; content: string; raw?: string } }>('/api/v1/ai/chat', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('compose-chat'),
        body: {
          message: text,
          sessionId: composeSession,
          purpose: 'TEACHER_COMPOSE',
          classId: classId || null,
          subjectId: subjectId || null,
          reasoningMode: 'STANDARD',
          agentic: true,
          runCode: true,
          sourceMode: 'AUTO',
        },
      });
      setComposeSession(reply.sessionId);
      setComposeMessages((current) => [...current, { id: reply.message.id, role: 'ASSISTANT', content: presentAssistantText('TEACHER_COMPOSE', reply.message.content) }]);
      const parsed = parseComposeQuestions(reply.message.raw ?? reply.message.content);
      if (parsed.length > 0) setComposedCards(parsed);
      if (parsed.length >= 5) await importComposed(parsed);
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa chat được soạn đề AI.');
    } finally {
      setComposeSending(false);
    }
  }

  function updateDraftPoints(questionVersionId: string, value: number) {
    if (!Number.isFinite(value) || value <= 0 || value > 1000) return;
    setDraftItems((items) => items.map((item) => item.questionVersionId === questionVersionId ? { ...item, points: value } : item));
  }

  function moveDraftItem(questionVersionId: string, direction: -1 | 1) {
    setDraftItems((items) => {
      const from = items.findIndex((item) => item.questionVersionId === questionVersionId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= items.length) return items;
      const next = [...items];
      [next[from], next[to]] = [next[to]!, next[from]!];
      return next;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftItems.length === 0) { setMessage('Hãy thêm ít nhất một câu hỏi đã duyệt vào bài tập.'); return; }
    if (deliveryMode === 'EXAM' && !existing && examPin.trim().length < 6) { setMessage('PIN đợt thi cần tối thiểu 6 ký tự.'); return; }
    setSending(true); setMessage('');
    const body = {
      classId, subjectId, title, instructions,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      maxAttempts, gradingPolicy, deliveryMode, durationMinutes: deliveryMode === 'EXAM' ? durationMinutes : null,
       examPin: deliveryMode === 'EXAM' && examPin ? examPin : null, showScoreOnSubmit,
       examPeriod: deliveryMode === 'EXAM' ? examPeriod : 'PRACTICE',
      items: draftItems.map((item, index) => ({ questionVersionId: item.questionVersionId, position: index + 1, points: item.points })),
    };
    try {
      if (existing) {
        await apiRequest(`/api/v1/assignments/${existing.id}`, { method: 'PUT', idempotencyKey: newIdempotencyKey('assignment-update'), body });
        onSaved(existing.id);
      } else {
        const created = await apiRequest<{ id: string }>('/api/v1/assignments', { method: 'POST', idempotencyKey: newIdempotencyKey('assignment-create'), body });
        onSaved(created.id);
      }
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu bài tập.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
    {message && <p className={`form-message ${message.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{message}</p>}
    <form className="login-form max-w-3xl" onSubmit={(event) => void save(event)}>
      {!existing && (
        <>
          <FormField id="assignmentClassId" label="Lớp học">
            <SelectInput id="assignmentClassId" value={classId} required onChange={(event) => setClassId(event.target.value)}>
              <option value="">Chọn lớp</option>
              {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
            </SelectInput>
          </FormField>
          <FormField id="assignmentSubjectId" label="Môn học">
            <SelectInput id="assignmentSubjectId" value={subjectId} required onChange={(event) => { setSubjectId(event.target.value); void loadBanks(event.target.value, true); }}>
              <option value="">Chọn môn học</option>
              {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
            </SelectInput>
          </FormField>
        </>
      )}
      <FormField id="title" label="Tên bài tập">
        <TextInput id="title" value={title} required minLength={3} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
      </FormField>
      <FormField id="instructions" label="Hướng dẫn">
        <TextArea id="instructions" value={instructions} maxLength={10000} rows={3} onChange={(event) => setInstructions(event.target.value)} />
      </FormField>
      <FormField id="dueAt" label="Hạn nộp">
        <TextInput id="dueAt" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </FormField>
      <FormField id="assignmentBankId" label="Ngân hàng câu hỏi">
        <SelectInput id="assignmentBankId" value={bankId} onChange={(event) => { setBankId(event.target.value); void loadQuestions(event.target.value); }}>
          <option value="">Chọn ngân hàng</option>
          {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
        </SelectInput>
      </FormField>
      <FormField id="questionVersionId" label="Câu hỏi đã duyệt">
        <SelectInput id="questionVersionId" value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}>
          <option value="">Chọn câu hỏi</option>
          {questions.map((question) => <option key={question.versionId} value={question.versionId}>{question.type} · tối đa {question.maxScore} điểm</option>)}
        </SelectInput>
      </FormField>
      <FormField id="points" label="Điểm câu hỏi">
        <TextInput id="points" type="number" min={0.1} max={1000} step={0.1} value={selectedQuestionPoints} onChange={(event) => setSelectedQuestionPoints(Number(event.target.value))} required />
      </FormField>
      <button className="ws-btn ws-btn-quiet justify-self-start" type="button" onClick={addDraftItem} disabled={!selectedQuestionId || sending}>Thêm vào bài tập</button>
      <section aria-labelledby="assignment-items-heading">
        <h2 id="assignment-items-heading" className="text-base">Danh sách câu hỏi</h2>
        <p className="muted-copy">Bản nháp có thể ngắn hơn 5 câu. Xuất bản cần tối thiểu 5 câu (mọi loại).</p>
        {draftItems.length === 0 ? <p className="muted-copy">Chưa có câu hỏi nào. Hãy chọn câu hỏi đã duyệt rồi thêm vào bài tập.</p> : (
          <ol className="grid gap-3 pl-5">
            {draftItems.map((item, index) => (
              <li key={item.questionVersionId} className="metric-card grid gap-2">
                <span>{item.type} · Câu {index + 1}</span>
                <label>
                  Điểm
                  <input className="ws-input" aria-label={`Điểm câu ${index + 1}`} type="number" min={0.1} max={1000} step={0.1} value={item.points} onChange={(event) => updateDraftPoints(item.questionVersionId, Number(event.target.value))} />
                </label>
                <span className="table-actions">
                  <button className="ws-btn ws-btn-quiet" type="button" onClick={() => moveDraftItem(item.questionVersionId, -1)} disabled={index === 0}>Lên</button>
                  <button className="ws-btn ws-btn-quiet" type="button" onClick={() => moveDraftItem(item.questionVersionId, 1)} disabled={index === draftItems.length - 1}>Xuống</button>
                  <button className="ws-btn ws-btn-quiet" type="button" onClick={() => setDraftItems((items) => items.filter((draft) => draft.questionVersionId !== item.questionVersionId))}>Xóa</button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <FormField id="maxAttempts" label="Số lượt làm tối đa">
        <TextInput id="maxAttempts" type="number" min={1} max={10} step={1} value={maxAttempts} required onChange={(event) => setMaxAttempts(Number(event.target.value))} />
      </FormField>
      <FormField id="gradingPolicy" label="Cách lấy điểm chính thức">
        <SelectInput id="gradingPolicy" value={gradingPolicy} onChange={(event) => setGradingPolicy(event.target.value as 'HIGHEST' | 'LATEST' | 'AVERAGE')}>
          <option value="HIGHEST">Điểm cao nhất</option>
          <option value="LATEST">Lượt đã chấm gần nhất</option>
          <option value="AVERAGE">Trung bình các lượt đã chấm</option>
        </SelectInput>
      </FormField>
      <FormField id="deliveryMode" label="Hình thức">
        <SelectInput id="deliveryMode" value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as 'HOMEWORK' | 'EXAM')}>
          <option value="HOMEWORK">Bài tập luyện tập</option>
          <option value="EXAM">Thi thử trên máy (phòng thi)</option>
        </SelectInput>
      </FormField>
      {deliveryMode === 'EXAM' && (
        <>
          <FormField id="durationMinutes" label="Thời gian làm bài (phút)">
            <TextInput id="durationMinutes" type="number" min={1} max={300} value={durationMinutes ?? 45} onChange={(event) => setDurationMinutes(Number(event.target.value))} />
          </FormField>
          <FormField id="examPin" label="PIN đợt thi">
            <TextInput id="examPin" type="password" minLength={6} maxLength={64} value={examPin} onChange={(event) => setExamPin(event.target.value)} />
          </FormField>
          <FormField id="examPeriod" label="Kỳ thi">
            <SelectInput id="examPeriod" value={examPeriod} onChange={(event) => setExamPeriod(event.target.value as NonNullable<AssignmentDetail['examPeriod']>)}>
              <option value="PRACTICE">Luyện tập</option>
              <option value="MIDTERM_1">Giữa kỳ I</option>
              <option value="FINAL_1">Cuối kỳ I</option>
              <option value="MIDTERM_2">Giữa kỳ II</option>
              <option value="FINAL_2">Cuối kỳ II</option>
              <option value="MOCK_GRADUATION">Thi thử tốt nghiệp</option>
              <option value="OTHER">Kỳ khác</option>
            </SelectInput>
          </FormField>
          <label htmlFor="showScoreOnSubmit"><input id="showScoreOnSubmit" type="checkbox" checked={showScoreOnSubmit} onChange={(event) => setShowScoreOnSubmit(event.target.checked)} /> Hiện điểm ngay khi nộp</label>
        </>
      )}
      <button className="ws-btn ws-btn-primary justify-self-start" type="submit" disabled={sending}>{sending ? 'Đang lưu…' : existing ? 'Lưu bản nháp' : 'Tạo bài tập'}</button>
    </form>
    <section className="workspace-feature" aria-labelledby="compose-ai-title">
      <h2 id="compose-ai-title">Chat soạn đề</h2>
      <p className="muted-copy">AI hỏi ý kiến trước khi sinh. Chọn số câu từng loại, xác nhận, rồi AI điền khung — không tự xuất bản.</p>
      <div className="filter-row">
        <FormField id="mcqCount" label="Trắc nghiệm">
          <TextInput id="mcqCount" type="number" min={0} max={20} value={mcqCount} onChange={(event) => setMcqCount(Number(event.target.value))} />
        </FormField>
        <FormField id="tfCount" label="Đúng/sai">
          <TextInput id="tfCount" type="number" min={0} max={20} value={tfCount} onChange={(event) => setTfCount(Number(event.target.value))} />
        </FormField>
        <FormField id="shortCount" label="Điền số">
          <TextInput id="shortCount" type="number" min={0} max={20} value={shortCount} onChange={(event) => setShortCount(Number(event.target.value))} />
        </FormField>
        <FormField id="essayCount" label="Tự luận">
          <TextInput id="essayCount" type="number" min={0} max={20} value={essayCount} onChange={(event) => setEssayCount(Number(event.target.value))} />
        </FormField>
      </div>
      <p className="muted-copy">Tổng {composeTotal} câu{composeTotal < 5 ? ' — cần ≥ 5 khi xuất bản' : ''}.</p>
      <button className="ws-btn ws-btn-quiet justify-self-start" type="button" disabled={composeSending || composeTotal < 5} onClick={() => void sendCompose(`Xác nhận sinh đề: ${mcqCount} trắc nghiệm, ${tfCount} đúng/sai, ${shortCount} ngắn, ${essayCount} tự luận.`)}>Nhờ AI điền đúng số đã chọn</button>
      <ChatThread messages={composeMessages} sending={composeSending} onSend={sendCompose} placeholder="Môn, chương, số câu từng loại, độ khó…" submitLabel="Gửi" />
      {composedCards.length > 0 && (
        <div className="compose-cards">
          {composedCards.map((question, index) => {
            const prompt = (question.prompt && typeof question.prompt === 'object' ? question.prompt : {}) as { text?: string; choices?: string[] };
            return (
              <article key={index} className="compose-card">
                <p className="eyebrow">{String(question.type ?? 'Câu hỏi')} · {index + 1}</p>
                <AssistantRichText content={prompt.text || 'Câu hỏi đã điền khung'} />
                {Array.isArray(prompt.choices) && (
                  <ol>{prompt.choices.map((choice) => <li key={choice}><AssistantRichText content={choice} /></li>)}</ol>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
    </>
  );
}

function StudentAttempt({ assignment }: { assignment: AssignmentDetail }) {
  const attemptsQuery = useQuery({
    queryKey: ['assignment-attempts', assignment.id],
    queryFn: () => apiRequest<AttemptView[]>(`/api/v1/assignments/${assignment.id}/attempts`),
  });
  const storageId = draftKey(assignment.id);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      if (typeof sessionStorage === 'undefined') return {};
      return JSON.parse(sessionStorage.getItem(storageId) ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(storageId, JSON.stringify(answers));
  }, [answers, storageId]);

  const attempts = attemptsQuery.data ?? [];
  const remaining = Math.max(0, assignment.maxAttempts - attempts.length);
  const canSubmit = remaining > 0 && assignment.status === 'PUBLISHED';

  if (attemptsQuery.isPending) return <EmptyState>Đang tải lượt làm…</EmptyState>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true); setMessage('');
    const payload = assignment.items.map((item) => {
      const value = answers[item.id] ?? '';
      if (item.type === 'MULTIPLE_CHOICE') return { assignmentItemId: item.id, answer: { choice: value } };
      if (item.type === 'TRUE_FALSE') {
        const parsed = (() => { try { return JSON.parse(value) as Record<string, boolean>; } catch { return {}; } })();
        return { assignmentItemId: item.id, answer: { values: parsed } };
      }
      if (item.type === 'SHORT_ANSWER') return { assignmentItemId: item.id, answer: { numeric: value } };
      return { assignmentItemId: item.id, answer: { text: value } };
    });
    try {
      const result = await apiRequest<{ status: string; requiresTeacherMark: boolean }>(`/api/v1/assignments/${assignment.id}/submissions`, { method: 'POST', idempotencyKey: newIdempotencyKey('assignment-submit'), body: { answers: payload } });
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(storageId);
      setAnswers({});
      setMessage(result.requiresTeacherMark ? 'Đã nộp bài. Câu tự luận đang chờ giáo viên chấm.' : 'Đã nộp và chấm bài tự động.');
      await attemptsQuery.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể nộp bài. Hãy trả lời đủ mọi câu trước khi nộp.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {message && <p className={`form-message ${message.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{message}</p>}
      {attempts.length > 0 && (
        <section aria-label="Lịch sử lượt làm" className="workspace-feature mb-6">
          <h2>Lịch sử lượt làm</h2>
          {attempts.map((attempt) => (
            <p key={attempt.id}>Lượt {attempt.attemptNumber}: {attempt.score}/{attempt.maxScore} · {attempt.status}{attempt.isLate ? ' · Nộp trễ' : ''}{attempt.overallFeedback ? ` · ${attempt.overallFeedback}` : ''}</p>
          ))}
        </section>
      )}
      {!canSubmit && <EmptyState>Em đã hết lượt làm hoặc bài tập không còn mở.</EmptyState>}
      {canSubmit && (
        <form className="grid max-w-3xl gap-6" onSubmit={(event) => void submit(event)}>
          <p className="muted-copy" role="note">Bài làm chỉ được nhớ tạm trên trình duyệt này. Đổi máy, đóng tab ẩn danh hoặc xóa dữ liệu sẽ mất bài chưa nộp. Nộp một lần cho cả đề — hệ thống không nhận bài thiếu câu.</p>
          {assignment.items.map((item) => {
            const statements = Array.isArray(item.prompt.statements) ? item.prompt.statements : [];
            const tfValues = (() => { try { return JSON.parse(answers[item.id] ?? '{}') as Record<string, boolean>; } catch { return {}; } })();
            return (
            <fieldset key={item.id} className="workspace-feature">
              <legend>{item.position}. {item.prompt.stem ?? item.prompt.text ?? 'Câu hỏi'} · {item.points} điểm</legend>
              {item.prompt.passage && <p className="muted-copy">{item.prompt.passage}</p>}
              {item.type === 'TRUE_FALSE' ? (
                <div className="grid gap-3">
                  {statements.map((statement) => (
                    <fieldset key={statement.key} className="grid gap-1">
                      <legend>{statement.key}. {statement.text}</legend>
                      <label><input type="radio" name={`${item.id}-${statement.key}`} checked={tfValues[statement.key] === true} onChange={() => setAnswers((current) => ({ ...current, [item.id]: JSON.stringify({ ...tfValues, [statement.key]: true }) }))} /> Đúng</label>
                      <label><input type="radio" name={`${item.id}-${statement.key}`} checked={tfValues[statement.key] === false} onChange={() => setAnswers((current) => ({ ...current, [item.id]: JSON.stringify({ ...tfValues, [statement.key]: false }) }))} /> Sai</label>
                    </fieldset>
                  ))}
                </div>
              ) : item.type === 'MULTIPLE_CHOICE' ? (
                <SelectInput name={`answer-${item.id}`} required value={answers[item.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))}>
                  <option value="">Chọn một đáp án</option>
                  {choicesFor(item).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                </SelectInput>
              ) : item.type === 'SHORT_ANSWER' ? (
                <TextInput name={`answer-${item.id}`} required inputMode="decimal" maxLength={80} value={answers[item.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} />
              ) : (
                <TextArea name={`answer-${item.id}`} required maxLength={10000} rows={8} value={answers[item.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} />
              )}
            </fieldset>
            );
          })}
          <button className="ws-btn ws-btn-primary justify-self-start" type="submit" disabled={sending}>{sending ? 'Đang nộp…' : `Nộp bài (còn ${remaining} lượt)`}</button>
        </form>
      )}
    </>
  );
}

function ExamIntegrityLog({ assignmentId }: { assignmentId: string }) {
  const query = useQuery({
    queryKey: ['exam-integrity', assignmentId],
    queryFn: () => apiRequest<Array<{ id: string; kind: string; occurredAt: string; studentName: string; studentCode: string | null }>>(`/api/v1/exams/${assignmentId}/integrity`),
  });
  const events = query.data ?? [];
  return (
    <section className="workspace-feature mb-6" aria-labelledby="integrity-title">
      <h2 id="integrity-title">Nhật ký phòng thi</h2>
      {query.isPending ? <p>Đang tải nhật ký…</p> : events.length === 0 ? <p>Chưa có sự kiện rời tab / mất tiêu điểm.</p> : (
        <ul>
          {events.map((event) => (
            <li key={event.id}>{new Date(event.occurredAt).toLocaleString('vi-VN')} · {event.studentName} ({event.studentCode ?? '—'}) · {event.kind}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AssignmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const learner = user.role === 'STUDENT';
  const isNew = !id;
  const query = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => apiRequest<AssignmentDetail>(`/api/v1/assignments/${id}`),
    enabled: Boolean(id),
  });

  const assignment = query.data;
  const title = useMemo(() => {
    if (isNew) return 'Tạo bài tập mới';
    return assignment?.title ?? 'Bài tập';
  }, [assignment?.title, isNew]);

  if (isNew && learner) return <ErrorState>Học sinh không tạo bài tập.</ErrorState>;
  if (id && query.isPending) return <EmptyState>Đang tải bài tập…</EmptyState>;
  if (id && (query.isError || !assignment)) return <ErrorState onRetry={() => void query.refetch()}>Chưa thể tải bài tập.</ErrorState>;

  return (
    <>
      <PageHeader
        eyebrow={learner ? 'Làm bài' : isNew ? 'Tạo đề' : assignment?.status === 'DRAFT' ? 'Sửa bản nháp' : 'Xem đề'}
        title={title}
        lede={assignment?.instructions}
        actions={<Link className="ws-btn ws-btn-quiet" to="/app/assignments">Danh sách</Link>}
      />
      {learner && assignment && assignment.deliveryMode === 'EXAM' && (
        <section className="workspace-feature">
          <p>Đây là ca thi thử trên máy. Em làm bài trong phòng thi, không nộp như bài tập luyện tập.</p>
          <Link className="ws-btn ws-btn-primary" to="/app/exam">Mở phòng thi</Link>
        </section>
      )}
      {learner && assignment && assignment.deliveryMode !== 'EXAM' && <StudentAttempt assignment={assignment} />}
      {!learner && (isNew || assignment?.status === 'DRAFT') && (
        <EducatorComposer existing={assignment ?? null} onSaved={(savedId) => navigate(`/app/assignments/${savedId}`)} />
      )}
      {!learner && assignment && assignment.status !== 'DRAFT' && (
        <>
          {assignment.deliveryMode === 'EXAM' && <ExamIntegrityLog assignmentId={assignment.id} />}
          <ol className="grid max-w-3xl gap-3 pl-5">
            {assignment.items.map((item) => (
              <li key={item.id} className="workspace-feature">
                <p>{item.position}. {item.prompt.text ?? 'Câu hỏi'} · {item.points} điểm · {item.type}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
