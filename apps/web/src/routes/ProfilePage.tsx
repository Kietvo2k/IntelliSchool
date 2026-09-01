import { FormEvent, useEffect, useRef, useState } from 'react';
import { KnowledgeCardView, type KnowledgeCanonical } from '../components/ui/KnowledgeCardView.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useSession } from '../lib/SessionContext.js';
import { subjectLabel } from '../lib/subject-labels.js';
import { createIdempotentAction } from '../lib/idempotent-action.js';

export function ProfilePage() {
  const { user, updateUser } = useSession();
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; current: boolean; createdAt: string; lastSeenAt: string; expiresAt: string }>>([]);
  const [securityState, setSecurityState] = useState<'loading' | 'idle' | 'sending' | 'error'>('loading');
  const profileAction = useRef(createIdempotentAction('profile-update', newIdempotencyKey)).current;

  async function loadSessions() {
    setSecurityState('loading');
    try { setSessions(await apiRequest<Array<{ id: string; current: boolean; createdAt: string; lastSeenAt: string; expiresAt: string }>>('/api/v1/me/sessions')); setSecurityState('idle'); }
    catch { setSecurityState('error'); }
  }

  const [careerProvince, setCareerProvince] = useState('');
  const [studyGoal, setStudyGoal] = useState('');
  const [transcripts, setTranscripts] = useState<Array<{ id: string; term: string; subjectCode: string; score: number; source: string }>>([]);
  const [freeText, setFreeText] = useState('');
  const [canonical, setCanonical] = useState<KnowledgeCanonical>({});

  useEffect(() => { void loadSessions(); }, []);
  useEffect(() => {
    if (state === 'error') errorSummaryRef.current?.focus();
  }, [state]);
  useEffect(() => {
    if (user.role !== 'STUDENT' && user.role !== 'TEACHER' && user.role !== 'SCHOOL_OWNER') return;
    void apiRequest<Array<{ id: string; term: string; subjectCode: string; score: number; source: string }>>('/api/v1/transcripts').then(setTranscripts).catch(() => undefined);
    void apiRequest<{ canonical?: KnowledgeCanonical; freeText?: string }>('/api/v1/knowledge-card').then((card) => {
      setCanonical(card.canonical ?? {});
      setFreeText(card.freeText ?? '');
    }).catch(() => undefined);
  }, [user.role]);
  useEffect(() => {
    if (user.role !== 'STUDENT') return;
    void apiRequest<{ province?: string; studyGoal?: string }>('/api/v1/career/profile').then((data) => {
      setCareerProvince(data.province ?? '');
      setStudyGoal(data.studyGoal ?? '');
    }).catch(() => undefined);
  }, [user.role]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get('displayName') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const input = { displayName: displayName || undefined, email: email || undefined };
    const ticket = profileAction.begin(input);
    if (!ticket) return;
    setState('sending');
    setMessage('');
    try {
      const updated = await apiRequest<{ displayName: string; email: string }>('/api/v1/me/profile', {
        method: 'PATCH',
        idempotencyKey: ticket.key,
        body: input,
      });
      updateUser?.({ displayName: updated.displayName, email: updated.email });
      profileAction.end(input, true);
      setState('success');
      setMessage('Đã lưu thông tin hồ sơ.');
    } catch (error) {
      profileAction.end(input, false);
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Có lỗi kết nối. Vui lòng thử lại.');
    }
  }

  async function revokeSession(id: string) {
    setSecurityState('sending');
    try {
      await apiRequest(`/api/v1/me/sessions/${id}/revoke`, { method: 'POST', idempotencyKey: newIdempotencyKey('session-revoke') });
      await loadSessions();
    } catch { setSecurityState('error'); }
  }

  async function revokeOtherSessions() {
    setSecurityState('sending');
    try {
      await apiRequest('/api/v1/me/sessions/revoke-others', { method: 'POST', idempotencyKey: newIdempotencyKey('sessions-revoke-others') });
      await loadSessions();
    } catch { setSecurityState('error'); }
  }

  return (
    <>
      <p className="eyebrow">Hồ sơ cá nhân</p>
      <h1>Thông tin của bạn</h1>
      <form className="login-form" onSubmit={submit} style={{ maxWidth: '28rem' }}>
        <label htmlFor="displayName">Họ tên hiển thị</label>
        <input id="displayName" name="displayName" defaultValue={user.displayName} minLength={1} maxLength={120} />
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={user.email} maxLength={254} />
        <button className="button button-primary" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
        {message && <p ref={state === 'error' ? errorSummaryRef : undefined} tabIndex={state === 'error' ? -1 : undefined} className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role={state === 'error' ? 'alert' : 'status'}>{message}</p>}
      </form>
      {user.role === 'STUDENT' && (
        <form className="login-form" style={{ maxWidth: '28rem', marginTop: '1rem' }} onSubmit={(event) => {
          event.preventDefault();
          setState('sending');
          void apiRequest('/api/v1/career/profile', { method: 'PATCH', idempotencyKey: newIdempotencyKey('career-profile'), body: { province: careerProvince, studyGoal } })
            .then(() => { setState('success'); setMessage('Đã lưu hồ sơ hướng nghiệp.'); })
            .catch((error) => { setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa lưu được hồ sơ hướng nghiệp.'); });
        }}>
          <h2>Hướng nghiệp</h2>
          <label htmlFor="careerProvince">Tỉnh/thành</label>
          <input id="careerProvince" value={careerProvince} onChange={(event) => setCareerProvince(event.target.value)} maxLength={100} />
          <label htmlFor="studyGoal">Mục tiêu</label>
          <input id="studyGoal" value={studyGoal} onChange={(event) => setStudyGoal(event.target.value)} maxLength={240} />
          <button className="button button-primary" type="submit" disabled={state === 'sending'}>Lưu hồ sơ hướng nghiệp</button>
        </form>
      )}
      {(user.role === 'STUDENT' || user.role === 'TEACHER' || user.role === 'SCHOOL_OWNER') && (
        <section className="workspace-feature" style={{ marginTop: '1.5rem' }} aria-labelledby="transcript-title">
          <h2 id="transcript-title">Học bạ số</h2>
          <p>Học sinh ghi nguồn của mình; nhà trường ghi nguồn trường. Cổng TTĐT chưa kết nối — không nhập giả nguồn PORTAL.</p>
          {transcripts.length === 0 ? <p className="muted-copy">Chưa có dòng học bạ.</p> : (
            <ul>
              {transcripts.map((row) => (
                <li key={row.id}>{row.term} · {subjectLabel(row.subjectCode)}: {row.score} ({row.source === 'STUDENT' ? 'học sinh ghi' : row.source === 'SCHOOL' ? 'nhà trường' : 'cổng TTĐT'})</li>
              ))}
            </ul>
          )}
          <form className="login-form" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setState('sending');
            void apiRequest('/api/v1/transcripts', {
              method: 'POST',
              idempotencyKey: newIdempotencyKey('transcript'),
              body: {
                term: String(form.get('term') ?? ''),
                subjectCode: String(form.get('subjectCode') ?? ''),
                score: Number(form.get('score')),
                source: user.role === 'STUDENT' ? 'STUDENT' : 'SCHOOL',
              },
            }).then(async () => {
              setState('success');
              setMessage('Đã lưu học bạ.');
              setTranscripts(await apiRequest('/api/v1/transcripts'));
            }).catch((error) => { setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa lưu được học bạ.'); });
          }}>
            <label htmlFor="term">Học kỳ</label>
            <input id="term" name="term" required minLength={2} maxLength={32} placeholder="HK2-2025" />
            <label htmlFor="subjectCode">Mã môn</label>
            <input id="subjectCode" name="subjectCode" required minLength={2} maxLength={16} placeholder="TOAN" />
            <label htmlFor="score">Điểm</label>
            <input id="score" name="score" type="number" min={0} max={10} step={0.1} required />
            <button className="button button-primary" type="submit" disabled={state === 'sending'}>Thêm dòng học bạ</button>
          </form>
          <KnowledgeCardView canonical={canonical} />
          <form className="login-form" onSubmit={(event) => {
            event.preventDefault();
            setState('sending');
            void apiRequest('/api/v1/knowledge-card', { method: 'PUT', idempotencyKey: newIdempotencyKey('knowledge'), body: { freeText } })
              .then((card) => { setState('success'); setMessage('Đã lưu ghi chú thẻ kiến thức.'); setFreeText((card as { freeText?: string }).freeText ?? freeText); })
              .catch((error) => { setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa lưu được thẻ kiến thức.'); });
          }}>
            <label htmlFor="freeText">Ghi chú của em</label>
            <textarea id="freeText" value={freeText} maxLength={800} rows={4} onChange={(event) => setFreeText(event.target.value)} />
            <button className="button button-primary" type="submit" disabled={state === 'sending'}>Lưu ghi chú</button>
          </form>
        </section>
      )}
      <section className="workspace-feature" style={{ marginTop: '1.5rem' }} aria-labelledby="session-security-title">
        <h2 id="session-security-title">Bảo mật phiên đăng nhập</h2>
        <p>Thu hồi những phiên không còn sử dụng để giữ an toàn cho tài khoản quản trị.</p>
        <button className="button button-quiet" type="button" disabled={securityState === 'sending'} onClick={() => void revokeOtherSessions()}>Thu hồi các phiên khác</button>
        {securityState === 'loading' && <p className="workspace-state" aria-busy="true">Đang tải các phiên đăng nhập…</p>}
        {securityState === 'error' && <p className="form-message is-error" role="alert">Chưa thể tải hoặc thu hồi phiên. <button type="button" onClick={() => void loadSessions()}>Thử lại</button></p>}
        {securityState === 'idle' && sessions.length === 0 && <p className="workspace-state">Không có phiên đăng nhập đang hoạt động khác.</p>}
        {sessions.length > 0 && <ul className="session-list" aria-label="Các phiên đăng nhập">
          {sessions.map((session) => <li key={session.id}><span><strong>{session.current ? 'Thiết bị hiện tại' : 'Phiên đang hoạt động'}</strong><small>Hoạt động gần nhất: {new Date(session.lastSeenAt).toLocaleString('vi-VN')}</small></span>{session.current ? <span className="status-badge approved">Hiện tại</span> : <button className="button button-quiet" type="button" disabled={securityState === 'sending'} onClick={() => void revokeSession(session.id)}>Thu hồi</button>}</li>)}
        </ul>}
      </section>
    </>
  );
}
