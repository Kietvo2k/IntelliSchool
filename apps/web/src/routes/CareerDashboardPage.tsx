import { FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { createIdempotentAction } from '../lib/idempotent-action.js';

const SUBJECTS = ['TOAN', 'VAN', 'ANH', 'LY', 'HOA', 'SINH', 'SU', 'DIA', 'GDKTPL', 'TIN'];

interface Goal { id: string; title: string; status: string; targetAt: string | null }
interface RecordRow { id: string; subjectCode: string; score: number; year: number; source: string }
interface Aspiration { id: string; majorName?: string; institutionName?: string; priority: number }
interface Match { title: string; score: number }

export function CareerDashboardPage() {
  const [tab, setTab] = useState('goals');
  const reduceMotion = useReducedMotion();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [sending, setSending] = useState(false);
  const goalAction = useRef(createIdempotentAction('goal', newIdempotencyKey)).current;

  async function reload() {
    const [goalData, recordData, aspirationData, recs] = await Promise.all([
      apiRequest<Goal[]>('/api/v1/goals'),
      apiRequest<RecordRow[]>('/api/v1/career/exam-records'),
      apiRequest<Aspiration[]>('/api/v1/aspirations'),
      apiRequest<{ matches: Match[] }>('/api/v1/career/recommendations').catch(() => ({ matches: [] })),
    ]);
    setGoals(goalData ?? []);
    setRecords(recordData ?? []);
    setAspirations(aspirationData ?? []);
    setMatches(recs.matches ?? []);
  }

  useEffect(() => {
    void reload().catch((error) => {
      setStatusType('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa tải được bảng hướng nghiệp.');
    });
  }, []);

  async function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = { title: String(form.get('title') ?? '').trim() };
    const ticket = goalAction.begin(input);
    if (!ticket) return;
    setMessage('');
    try {
      const created = await apiRequest<Goal>('/api/v1/goals', { method: 'POST', idempotencyKey: ticket.key, body: input });
      setGoals((current) => [...current, created]);
      formElement.reset();
      goalAction.end(input, true);
      setStatusType('success');
      setMessage('Đã thêm mục tiêu.');
      void reload().catch(() => {
        setStatusType('error');
        setMessage('Đã thêm mục tiêu nhưng chưa làm mới được dữ liệu.');
      });
    } catch (error) {
      goalAction.end(input, false);
      setStatusType('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể thêm mục tiêu.');
    }
  }

  async function saveScores(event: FormEvent<HTMLFormElement>, source: 'CLASSROOM' | 'GRADUATION') {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const recordsToSave = SUBJECTS.map((subject) => ({ subjectCode: subject, score: Number(form.get(`${source}-${subject}`)), year: 2026, source })).filter((row) => Number.isFinite(row.score) && row.score > 0);
    if (recordsToSave.length === 0) {
      setStatusType('error');
      setMessage('Nhập ít nhất một điểm.');
      return;
    }
    setSending(true);
    setMessage('');
    try {
      await apiRequest('/api/v1/career/exam-records', { method: 'PUT', idempotencyKey: newIdempotencyKey('exam-records'), body: { records: recordsToSave } });
      if (source === 'GRADUATION') {
        const subjectScores = Object.fromEntries(recordsToSave.map((row) => [row.subjectCode, row.score]));
        await apiRequest('/api/v1/career/profile', { method: 'PATCH', idempotencyKey: newIdempotencyKey('grad-profile'), body: { subjectScores } });
      }
      setStatusType('success');
      setMessage(source === 'CLASSROOM' ? 'Đã lưu điểm học kỳ.' : 'Đã lưu điểm thi tốt nghiệp (đúng các môn em chọn).');
      void reload().catch(() => {
        setStatusType('error');
        setMessage('Đã lưu điểm nhưng chưa làm mới được dữ liệu.');
      });
    } catch (error) {
      setStatusType('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu điểm.');
    } finally {
      setSending(false);
    }
  }

  const tabs = [
    { id: 'goals', label: 'Mục tiêu' },
    { id: 'scores', label: 'Điểm thi' },
    { id: 'aspirations', label: 'Nguyện vọng' },
    { id: 'progress', label: 'Tiến độ' },
    { id: 'path', label: 'Lộ trình' },
    { id: 'quiz', label: 'Trắc nghiệm' },
  ];

  return (
    <>
      <PageHeader eyebrow="Hướng nghiệp" title="Bảng hướng nghiệp" lede="Tách điểm học kỳ, điểm thi tốt nghiệp và tổ hợp xét tuyển đại học." />
      {message && (
        <p className={`form-message ${statusType === 'error' ? 'is-error' : 'is-success'}`} role={statusType === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      <div className="tab-row" role="tablist">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
      {tab === 'goals' && (
        <section className="workspace-feature">
          <h2>Mục tiêu</h2>
          <form className="login-form" onSubmit={(event) => void addGoal(event)}>
            <label htmlFor="goalTitle">Mục tiêu mới</label>
            <input id="goalTitle" name="title" required minLength={3} />
            <button className="button button-primary" type="submit">Thêm</button>
          </form>
          <ul>{goals.map((goal) => <li key={goal.id}>{goal.title} · {goal.status}</li>)}</ul>
        </section>
      )}
      {tab === 'scores' && (
        <section className="workspace-feature-grid">
          <article className="workspace-feature">
            <h2>Điểm học kỳ</h2>
            <form className="login-form" onSubmit={(event) => void saveScores(event, 'CLASSROOM')}>
              {SUBJECTS.map((subject) => (
                <div key={subject}><label htmlFor={`CLASSROOM-${subject}`}>{subject}</label><input id={`CLASSROOM-${subject}`} name={`CLASSROOM-${subject}`} type="number" min={0} max={10} step={0.1} /></div>
              ))}
              <button className="button button-primary" type="submit" disabled={sending}>{sending ? 'Đang lưu…' : 'Lưu điểm học'}</button>
            </form>
          </article>
          <article className="workspace-feature">
            <h2>Điểm thi tốt nghiệp</h2>
            <p>Đúng các môn em thi (Toán + Văn bắt buộc và 2 môn tự chọn), không phải 8 ô tổ hợp ĐH.</p>
            <form className="login-form" onSubmit={(event) => void saveScores(event, 'GRADUATION')}>
              {SUBJECTS.map((subject) => (
                <div key={subject}><label htmlFor={`GRADUATION-${subject}`}>{subject}</label><input id={`GRADUATION-${subject}`} name={`GRADUATION-${subject}`} type="number" min={0} max={10} step={0.1} /></div>
              ))}
              <button className="button button-primary" type="submit" disabled={sending}>{sending ? 'Đang lưu…' : 'Lưu điểm TN'}</button>
            </form>
          </article>
          <ul>{records.map((row) => <li key={row.id}>{row.source} · {row.subjectCode}: {row.score}</li>)}</ul>
        </section>
      )}
      {tab === 'aspirations' && (
        <section className="workspace-feature">
          <h2>Nguyện vọng</h2>
          {aspirations.length === 0 ? <p>Chưa có nguyện vọng. Thêm tại mục Nguyện vọng.</p> : aspirations.map((item) => <p key={item.id}>{item.priority}. {item.institutionName} · {item.majorName}</p>)}
        </section>
      )}
      {tab === 'progress' && <section className="workspace-feature"><h2>Tiến độ</h2><p>{goals.filter((goal) => goal.status === 'COMPLETED').length}/{goals.length} mục tiêu hoàn thành.</p></section>}
      {tab === 'path' && <section className="workspace-feature"><h2>Lộ trình</h2><p>Lộ trình môn học LMS nằm ở “Lộ trình của em”. Đây là gợi ý nghề theo SIMGR.</p><ol>{matches.slice(0, 5).map((match) => <li key={match.title}>{match.title}</li>)}</ol></section>}
      {tab === 'quiz' && <section className="workspace-feature"><h2>Lịch sử trắc nghiệm</h2><p>Mở Khám phá để làm lại 5 bước. Kết quả mới nhất dùng cho radar.</p></section>}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
