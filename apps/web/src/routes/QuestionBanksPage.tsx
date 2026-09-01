import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FilterBar } from '../components/ui/FilterBar.js';
import { FormField, SelectInput, TextArea, TextInput } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type SubjectOption } from '../lib/catalog.js';
import { useSession } from '../lib/SessionContext.js';
import { QuestionImportPanel } from './QuestionImportPanel.js';
import { createIdempotentAction } from '../lib/idempotent-action.js';

interface QuestionBankView { id: string; subjectId: string; name: string; }
interface QuestionView { id: string; versionId: string; type: string; maxScore: number; isApproved: boolean; }
type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';
interface RubricCriterion { label: string; maxScore: number; description: string; }

const EMPTY_BANKS: QuestionBankView[] = [];
const EMPTY_QUESTIONS: QuestionView[] = [];

export function QuestionBanksPage() {
  const { user } = useSession();
  const subjects = useCatalog<SubjectOption>('/api/v1/subjects');
  const [subjectId, setSubjectId] = useState('');
  const [bankId, setBankId] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([{ label: '', maxScore: 1, description: '' }]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bankAction = useRef(createIdempotentAction('bank-create', newIdempotencyKey)).current;
  const questionAction = useRef(createIdempotentAction('question-create', newIdempotencyKey)).current;

  useEffect(() => {
    if (!subjectId && subjects.items[0]) setSubjectId(subjects.items[0].id);
  }, [subjectId, subjects.items]);

  const banksQuery = useQuery({
    queryKey: ['question-banks', subjectId],
    queryFn: () => apiRequest<QuestionBankView[]>('/api/v1/question-banks', { query: { subjectId } }),
    enabled: Boolean(subjectId),
  });
  const banks = banksQuery.data ?? EMPTY_BANKS;

  useEffect(() => {
    if (!bankId && banks[0]) setBankId(banks[0].id);
  }, [bankId, banks]);

  const questionsQuery = useQuery({
    queryKey: ['questions', bankId],
    queryFn: () => apiRequest<QuestionView[]>('/api/v1/questions', { query: { bankId } }),
    enabled: Boolean(bankId),
  });
  const questions = questionsQuery.data ?? EMPTY_QUESTIONS;

  async function createBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = { subjectId: String(form.get('subjectId') ?? ''), name: String(form.get('name') ?? '') };
    const ticket = bankAction.begin(input);
    if (!ticket) return;
    setSending(true); setMessage('');
    try {
      await apiRequest('/api/v1/question-banks', {
        method: 'POST',
        idempotencyKey: ticket.key,
        body: input,
      });
      setMessage('Đã tạo ngân hàng câu hỏi.');
      formElement.reset();
      bankAction.end(input, true);
      void banksQuery.refetch().catch(() => setMessage('Đã tạo ngân hàng nhưng chưa làm mới được danh sách.'));
    } catch (error) {
      bankAction.end(input, false);
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tạo ngân hàng câu hỏi.');
    } finally {
      setSending(false);
    }
  }

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bankId) { setMessage('Chọn một ngân hàng câu hỏi trước khi thêm câu hỏi.'); return; }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const maxScore = Number(form.get('maxScore') ?? 1);
    const promptText = String(form.get('promptText') ?? '').trim();
    const answerChoice = String(form.get('answerChoice') ?? '').trim();
    let questionPayload: Record<string, unknown>;
    if (questionType === 'MULTIPLE_CHOICE') {
      const choices = ['choiceA', 'choiceB', 'choiceC', 'choiceD'].map((name) => String(form.get(name) ?? '').trim()).filter(Boolean);
      if (choices.length < 2 || !choices.includes(answerChoice)) {
        setMessage('Câu trắc nghiệm cần ít nhất hai lựa chọn và đáp án đúng phải trùng một lựa chọn.');
        return;
      }
      questionPayload = { prompt: { text: promptText, choices }, answerKey: { choice: answerChoice }, rubric: {} };
    } else if (questionType === 'TRUE_FALSE') {
      const statements = (['a', 'b', 'c', 'd'] as const).map((key) => ({
        key,
        text: String(form.get(`statement${key.toUpperCase()}`) ?? '').trim(),
      }));
      if (statements.some((item) => !item.text)) {
        setMessage('Đúng/sai cần đủ bốn ý a, b, c, d.');
        return;
      }
      questionPayload = {
        prompt: { stem: promptText || undefined, statements },
        answerKey: { values: { a: String(form.get('valueA')) === 'true', b: String(form.get('valueB')) === 'true', c: String(form.get('valueC')) === 'true', d: String(form.get('valueD')) === 'true' } },
        rubric: {},
      };
    } else if (questionType === 'SHORT_ANSWER') {
      const numeric = String(form.get('numericAnswer') ?? '').trim();
      const acceptable = String(form.get('acceptableAnswers') ?? '').split('\n').map((answer) => answer.trim()).filter(Boolean);
      if (!numeric && acceptable.length === 0) {
        setMessage('Nhập đáp án số hoặc danh sách chấp nhận.');
        return;
      }
      const tolerance = Number(form.get('tolerance') ?? 0);
      questionPayload = { prompt: { text: promptText, unit: String(form.get('unit') ?? '').trim() || undefined }, answerKey: { ...(numeric ? { numeric, tolerance: Number.isFinite(tolerance) ? tolerance : 0 } : {}), ...(acceptable.length ? { acceptable } : {}) }, rubric: {} };
    } else {
      const valid = criteria
        .map((criterion) => ({ label: criterion.label.trim(), maxScore: Number(criterion.maxScore), ...(criterion.description.trim() ? { description: criterion.description.trim() } : {}) }))
        .filter((criterion) => criterion.label && Number.isFinite(criterion.maxScore) && criterion.maxScore > 0);
      if (valid.length === 0) {
        setMessage('Thêm ít nhất một tiêu chí rubric với tên và điểm.');
        return;
      }
      questionPayload = { prompt: { text: promptText }, answerKey: {}, rubric: { criteria: valid } };
    }
    const body = { type: questionType, maxScore, ...questionPayload };
    const actionInput = { editingQuestionId, bankId, body };
    const ticket = questionAction.begin(actionInput);
    if (!ticket) return;
    setSending(true); setMessage('');
    try {
      await apiRequest(editingQuestionId ? `/api/v1/questions/${editingQuestionId}` : '/api/v1/questions', {
        method: editingQuestionId ? 'PATCH' : 'POST',
        idempotencyKey: ticket.key,
        body: editingQuestionId ? body : { bankId, ...body },
      });
      setMessage(editingQuestionId ? 'Đã tạo phiên bản mới. Phiên bản này cần được duyệt trước khi dùng.' : 'Đã tạo câu hỏi. Câu hỏi cần được duyệt trước khi đưa vào bài tập.');
      setEditingQuestionId(null);
      setCriteria([{ label: '', maxScore: 1, description: '' }]);
      formElement.reset();
      questionAction.end(actionInput, true);
      void questionsQuery.refetch().catch(() => setMessage('Đã lưu câu hỏi nhưng chưa làm mới được danh sách.'));
    } catch (error) {
      questionAction.end(actionInput, false);
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tạo câu hỏi.');
    } finally {
      setSending(false);
    }
  }

  async function approveQuestion(questionVersionId: string) {
    setSending(true); setMessage('');
    try {
      await apiRequest(`/api/v1/question-versions/${questionVersionId}/approve`, { method: 'POST', idempotencyKey: newIdempotencyKey('question-approve') });
      setMessage('Đã duyệt câu hỏi. Câu hỏi có thể được đưa vào bài tập.');
      await questionsQuery.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể duyệt câu hỏi.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Ngân hàng câu hỏi" title="Soạn câu hỏi" lede="Bốn dạng QĐ 764: trắc nghiệm A–D, đúng/sai bốn ý, điền số, tự luận. Hiệu trưởng duyệt trước khi đưa vào bài tập." />
      {message && <p className={`form-message ${message.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{message}</p>}
      <div className="workspace-feature-grid">
        <article className="workspace-feature">
          <p>Tạo ngân hàng câu hỏi</p>
          <form className="login-form" onSubmit={(event) => void createBank(event)}>
            <label htmlFor="bankSubjectId">Môn học</label>
            <select id="bankSubjectId" name="subjectId" required disabled={subjects.state === 'loading'}>
              <option value="">Chọn môn học</option>
              {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
            </select>
            <label htmlFor="bankName">Tên ngân hàng</label>
            <input id="bankName" name="name" required minLength={3} maxLength={160} placeholder="Ngân hàng Toán 12" />
            <button className="button button-primary" type="submit" disabled={sending}>Tạo ngân hàng</button>
          </form>
        </article>
        <article className="workspace-feature">
          <p>Chọn ngân hàng theo môn</p>
          <FilterBar>
            <FormField id="filterSubjectId" label="Môn học">
              <SelectInput id="filterSubjectId" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setBankId(''); }}>
                <option value="">Chọn môn học</option>
                {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </SelectInput>
            </FormField>
          </FilterBar>
          {banksQuery.isPending && subjectId && <EmptyState>Đang tải ngân hàng…</EmptyState>}
          {banksQuery.isError && <ErrorState onRetry={() => void banksQuery.refetch()}>Chưa thể tải ngân hàng câu hỏi.</ErrorState>}
          {banks.length > 0 && (
            <ul className="workspace-list">
              {banks.map((bank) => (
                <li className="workspace-list-item" key={bank.id}>
                  <button type="button" className={bankId === bank.id ? 'text-link font-bold' : 'text-link'} onClick={() => setBankId(bank.id)}>{bank.name}</button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
      <div className="workspace-feature-grid mt-6">
        <article className="workspace-feature">
          <p>{editingQuestionId ? 'Tạo phiên bản mới' : 'Thêm câu hỏi vào ngân hàng đã chọn'}</p>
          {!bankId && <p className="workspace-state">Chọn một ngân hàng ở cột bên trên để lưu câu hỏi.</p>}
          {editingQuestionId && <button className="text-link" type="button" onClick={() => setEditingQuestionId(null)}>Hủy tạo phiên bản mới</button>}
          <form className="login-form" onSubmit={(event) => void createQuestion(event)}>
            <label htmlFor="type">Loại câu hỏi</label>
            <select id="type" name="type" value={questionType} onChange={(event) => setQuestionType(event.target.value as QuestionType)}>
              <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
              <option value="TRUE_FALSE">Đúng / sai</option>
              <option value="SHORT_ANSWER">Trả lời ngắn</option>
              <option value="ESSAY">Tự luận</option>
            </select>
            <label htmlFor="promptText">{questionType === 'TRUE_FALSE' ? 'Đoạn dẫn / stem (không bắt buộc)' : 'Nội dung câu hỏi'}</label>
            <input id="promptText" name="promptText" required={questionType !== 'TRUE_FALSE'} maxLength={2000} />
            {questionType === 'MULTIPLE_CHOICE' && (
              <>
                <label htmlFor="choiceA">Lựa chọn A</label>
                <input id="choiceA" name="choiceA" required maxLength={1000} />
                <label htmlFor="choiceB">Lựa chọn B</label>
                <input id="choiceB" name="choiceB" required maxLength={1000} />
                <label htmlFor="choiceC">Lựa chọn C</label>
                <input id="choiceC" name="choiceC" required maxLength={1000} />
                <label htmlFor="choiceD">Lựa chọn D</label>
                <input id="choiceD" name="choiceD" required maxLength={1000} />
                <label htmlFor="answerChoice">Đáp án đúng</label>
                <input id="answerChoice" name="answerChoice" required maxLength={1000} aria-describedby="answerChoiceHelp" />
                <small id="answerChoiceHelp">Nhập chính xác nội dung của một lựa chọn.</small>
              </>
            )}
            {questionType === 'TRUE_FALSE' && (
              <>
                {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                  <fieldset key={letter} className="grid gap-2 rounded-xl border border-line p-3">
                    <legend>Ý {letter.toLowerCase()}</legend>
                    <label htmlFor={`statement${letter}`}>Nội dung ý {letter.toLowerCase()}</label>
                    <input id={`statement${letter}`} name={`statement${letter}`} required maxLength={1000} />
                    <label htmlFor={`value${letter}`}>Đáp án</label>
                    <select id={`value${letter}`} name={`value${letter}`} defaultValue="true">
                      <option value="true">Đúng</option>
                      <option value="false">Sai</option>
                    </select>
                  </fieldset>
                ))}
              </>
            )}
            {questionType === 'SHORT_ANSWER' && (
              <>
                <label htmlFor="numericAnswer">Đáp án số</label>
                <input id="numericAnswer" name="numericAnswer" inputMode="decimal" maxLength={80} aria-describedby="numericAnswerHelp" />
                <small id="numericAnswerHelp">Điền số (chấp nhận dấu phẩy hoặc chấm). Toán thi mặc định 0,5; môn khác 0,25.</small>
                <label htmlFor="unit">Đơn vị (không bắt buộc)</label>
                <input id="unit" name="unit" maxLength={40} />
                <label htmlFor="tolerance">Dung sai</label>
                <input id="tolerance" name="tolerance" type="number" min={0} max={1} step={0.01} defaultValue={0} />
                <label htmlFor="acceptableAnswers">Đáp án chữ bổ sung (không bắt buộc)</label>
                <textarea id="acceptableAnswers" name="acceptableAnswers" rows={3} aria-describedby="acceptableAnswersHelp" />
                <small id="acceptableAnswersHelp">Mỗi đáp án trên một dòng nếu không thuần số.</small>
              </>
            )}
            {questionType === 'ESSAY' && (
              <div className="grid gap-3">
                <p className="ws-label">Rubric chấm điểm</p>
                {criteria.map((criterion, index) => (
                  <fieldset key={index} className="grid gap-2 rounded-xl border border-line p-3">
                    <legend>Tiêu chí {index + 1}</legend>
                    <FormField id={`rubric-label-${index}`} label="Tên tiêu chí">
                      <TextInput id={`rubric-label-${index}`} value={criterion.label} required onChange={(event) => setCriteria((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, label: event.target.value } : item))} />
                    </FormField>
                    <FormField id={`rubric-score-${index}`} label="Điểm">
                      <TextInput id={`rubric-score-${index}`} type="number" min={0.1} step={0.1} value={criterion.maxScore} required onChange={(event) => setCriteria((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, maxScore: Number(event.target.value) } : item))} />
                    </FormField>
                    <FormField id={`rubric-desc-${index}`} label="Mô tả (không bắt buộc)">
                      <TextArea id={`rubric-desc-${index}`} rows={2} value={criterion.description} onChange={(event) => setCriteria((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, description: event.target.value } : item))} />
                    </FormField>
                    {criteria.length > 1 && <button className="text-link" type="button" onClick={() => setCriteria((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Xóa tiêu chí</button>}
                  </fieldset>
                ))}
                <button className="ws-btn ws-btn-quiet justify-self-start" type="button" onClick={() => setCriteria((current) => [...current, { label: '', maxScore: 1, description: '' }])}>Thêm tiêu chí</button>
                <small>Tổng điểm các tiêu chí không vượt quá điểm tối đa của câu.</small>
              </div>
            )}
            <label htmlFor="maxScore">Điểm tối đa</label>
            <input id="maxScore" name="maxScore" type="number" min={0.1} step={0.1} defaultValue={1} required />
            <button className="button button-primary" type="submit" disabled={sending || !bankId}>{sending ? 'Đang lưu…' : 'Thêm câu hỏi'}</button>
          </form>
        </article>
        <article className="workspace-feature">
          <p>Câu hỏi trong ngân hàng</p>
          {questionsQuery.isPending && bankId && <EmptyState>Đang tải câu hỏi…</EmptyState>}
          {questions.length === 0 ? <span>Chưa có câu hỏi.</span> : (
            <ul className="grid gap-2 pl-5">
              {questions.map((question) => (
                <li key={question.id}>
                  {question.type} · {question.maxScore} điểm · {question.isApproved ? <StatusBadge tone="approved">Đã duyệt</StatusBadge> : <StatusBadge tone="pending">Chờ duyệt</StatusBadge>}
                  <button type="button" className="text-link" onClick={() => setEditingQuestionId(question.id)} disabled={sending}>Tạo phiên bản mới</button>
                  {user.role === 'SCHOOL_OWNER' && !question.isApproved && <button type="button" className="text-link" onClick={() => void approveQuestion(question.versionId)} disabled={sending}>Duyệt câu hỏi</button>}
                </li>
              ))}
            </ul>
          )}
        </article>
        <QuestionImportPanel bankId={bankId} onImported={async () => { await questionsQuery.refetch(); }} />
      </div>
    </>
  );
}
