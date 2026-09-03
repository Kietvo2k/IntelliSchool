import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BrandLogo } from '../components/BrandLogo.js';
import { CbtBackdrop } from '../components/ui/CbtBackdrop.js';
import { LetterChoice } from '../components/ui/LetterChoice.js';
import { RichTextEditor } from '../components/ui/RichTextEditor.js';
import { apiRequest, apiUrl, ApiRequestError, ensureApiBase, newIdempotencyKey } from '../lib/api.js';
import { DURATION, EASE_OUT } from '../lib/motion.js';

interface OpenExam { id: string; title: string; subjectName: string; subjectCode?: string; examPeriod?: string; examPeriodLabel?: string; durationMinutes: number | null; sessionId: string | null; submitted: boolean; cameraRequired?: boolean; integrityMode?: 'PRACTICE' | 'STRICT_WEB' }
interface Lobby {
  studentCode: string;
  displayName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  room?: string | null;
  councilName: string;
  brand: string;
  exams: OpenExam[];
}
interface PaperItem {
  id: string;
  number: number;
  type: string;
  points: number;
  prompt: {
    text?: string;
    stem?: string;
    passage?: string;
    choices?: string[];
    statements?: Array<{ key: string; text: string }>;
    unit?: string;
    imageUrl?: string;
    imageSvg?: string;
    imageResourceId?: string;
  };
  answer: Record<string, unknown>;
}
interface SessionPaper {
  sessionId: string;
  title: string;
  subjectName: string;
  endsAt: string;
  serverNow: string;
  submittedAt: string | null;
  lockedAt?: string | null;
  cameraRequired?: boolean;
  integrityMode?: 'PRACTICE' | 'STRICT_WEB';
  integrity?: { state: 'ACTIVE' | 'GRACE' | 'WARNING' | 'LOCKED'; incidentId: string | null; graceEndsAt: string | null; lockAt: string | null; remainingMs: number; lockedAt: string | null; serverNow: string };
  integrityPolicy?: { graceMs: number; lockMs: number; attachmentExemptionSeconds: number; fullscreenRequired: boolean };
  showScoreOnSubmit: boolean;
  items: PaperItem[];
}

function isAnswered(type: string, answer: Record<string, unknown> | undefined): boolean {
  if (!answer) return false;
  if (type === 'MULTIPLE_CHOICE') return typeof answer.choice === 'string' && answer.choice.length > 0;
  if (type === 'TRUE_FALSE') {
    const values = answer.values && typeof answer.values === 'object' ? answer.values as Record<string, unknown> : {};
    return ['a', 'b', 'c', 'd'].every((key) => typeof values[key] === 'boolean');
  }
  if (type === 'SHORT_ANSWER') return typeof answer.numeric === 'string' ? answer.numeric.trim().length > 0 : typeof answer.text === 'string' && answer.text.trim().length > 0;
  return typeof answer.text === 'string' ? answer.text.trim().length > 0 : Boolean(answer.resourceId);
}

function passageImageSrc(prompt: PaperItem['prompt']): string | null {
  if (prompt.imageUrl) return prompt.imageUrl;
  if (prompt.imageSvg) return `data:image/svg+xml;utf8,${encodeURIComponent(prompt.imageSvg)}`;
  return null;
}

function CbtHeader({ school }: { school: string }) {
  return (
    <header className="cbt-top">
      <div className="cbt-header-left">
        <a href="/app" className="cbt-home-link" title="Về trang chủ">
          <Home size={18} aria-hidden="true" />
          <span>Về trang chủ</span>
        </a>
        <p className="cbt-top-title">GIAO DIỆN THI TRÊN MÁY TÍNH</p>
      </div>
      <div className="cbt-header-brand">
        <BrandLogo size="sm" subtitle={school} />
      </div>
    </header>
  );
}

export function ExamRoomPage() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<'gate' | 'lobby' | 'taking' | 'result'>('gate');
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [paper, setPaper] = useState<SessionPaper | null>(null);
  const [openExams, setOpenExams] = useState<OpenExam[]>([]);
  const [pickedExamId, setPickedExamId] = useState('');
  const [pickedPeriod, setPickedPeriod] = useState('');
  const [current, setCurrent] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ questionCount?: number; autoScore?: number | null; maxScore?: number | null; provisionalMaxScore?: number | null; pendingCount?: number; gradingStatus?: string } | null>(null);
  const [message, setMessage] = useState('');
  const [zoom, setZoom] = useState(100);
  const [showPin, setShowPin] = useState(false);
  const [connected, setConnected] = useState(true);
  const [integrityState, setIntegrityState] = useState<'ACTIVE' | 'GRACE' | 'WARNING' | 'LOCKED'>('ACTIVE');
  const pinRef = useRef('');
  const codeRef = useRef('');
  const answers = useRef<Record<string, Record<string, unknown>>>({});
  const lastIntegrityAt = useRef(0);
  const attachmentPickerActive = useRef(false);
  const attachmentExemptionToken = useRef<string | null>(null);
  const integrityIncidentId = useRef<string | null>(null);
const fullscreenExitTimer = useRef<number | null>(null);
const submitInFlight = useRef(false);

const submit = useCallback(async (): Promise<boolean> => {
  if (!paper || submitInFlight.current) return false;
  submitInFlight.current = true;
  try {
    const payload = await apiRequest<{ questionCount: number; autoScore: number | null; maxScore: number | null; provisionalMaxScore?: number | null; pendingCount?: number; gradingStatus?: string }>(`/api/v1/exams/sessions/${paper.sessionId}/submit`, { method: 'POST', idempotencyKey: newIdempotencyKey('exam-submit') });
    setResult(payload);
    setStage('result');
    try { sessionStorage.removeItem(`smartpath-exam-answers-${paper.sessionId}`); } catch { /* private mode */ }
    return true;
  } catch (error) {
    setMessage(error instanceof ApiRequestError ? error.message : 'Chưa nộp được bài.');
    return false;
  } finally {
    submitInFlight.current = false;
  }
}, [paper]);

  useEffect(() => {
    void apiRequest<Lobby>('/api/v1/exams/open').then((data) => {
      setLobby(data);
      setOpenExams(data.exams);
      const firstOpen = data.exams.find((exam) => !exam.submitted) ?? data.exams[0];
      setPickedPeriod((current) => current || firstOpen?.examPeriod || 'PRACTICE');
      setPickedExamId((currentId) => currentId || firstOpen?.id || '');
    }).catch((error) => setMessage(error instanceof ApiRequestError ? error.message : 'Chưa tải được danh sách ca thi.'));
  }, []);

  const periodOptions = useMemo(() => {
    const seen = new Set<string>();
    return openExams.flatMap((exam) => {
      const code = exam.examPeriod || 'PRACTICE';
      if (seen.has(code)) return [];
      seen.add(code);
      return [{ code, label: exam.examPeriodLabel || code }];
    });
  }, [openExams]);
  const periodExams = useMemo(() => openExams.filter((exam) => (exam.examPeriod || 'PRACTICE') === (pickedPeriod || periodOptions[0]?.code)), [openExams, pickedPeriod, periodOptions]);
  const selectedExam = periodExams.find((exam) => exam.id === pickedExamId) ?? periodExams.find((exam) => !exam.submitted) ?? periodExams[0] ?? null;

  useEffect(() => {
    if (selectedExam && selectedExam.id !== pickedExamId) setPickedExamId(selectedExam.id);
  }, [selectedExam, pickedExamId]);

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage('');
    try {
      const data = lobby ?? await apiRequest<Lobby>('/api/v1/exams/open');
      setLobby(data);
       setOpenExams(data.exams);
      const studentCode = String(form.get('studentCode'));
      const pin = String(form.get('pin'));
      if (studentCode.trim().toUpperCase() !== data.studentCode.trim().toUpperCase()) {
        setMessage('Mã thí sinh không khớp tài khoản đang đăng nhập.');
        return;
      }
      pinRef.current = pin;
      codeRef.current = studentCode;
      setStage('lobby');
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa vào được phòng thi.');
    }
  }

  async function startTaking(assignmentId: string) {
    setMessage('');
    try {
      const selected = openExams.find((exam) => exam.id === assignmentId);
      if (selected?.integrityMode === 'STRICT_WEB' && window.innerWidth < 1024) {
        setMessage('Ca thi nghiêm ngặt chỉ hỗ trợ màn hình từ 1024px. Hãy dùng máy tính hoặc mở rộng cửa sổ.');
        return;
      }
      if (selected?.integrityMode === 'STRICT_WEB' && !document.fullscreenElement) {
        try { await document.documentElement.requestFullscreen?.(); } catch { /* browser denied; message below is actionable */ }
        if (!document.fullscreenElement) {
          setMessage('Ca thi nghiêm ngặt yêu cầu toàn màn hình. Hãy bấm “Vào thi” lại và cho phép trình duyệt.');
          return;
        }
      }
      const started = await apiRequest<{ sessionId: string }>('/api/v1/exams/sessions', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('exam-start'),
        body: { assignmentId, studentCode: codeRef.current || lobby?.studentCode, pin: pinRef.current },
      });
      const session = await apiRequest<SessionPaper>(`/api/v1/exams/sessions/${started.sessionId}`);
      if (session.lockedAt || session.integrity?.state === 'LOCKED') { setIntegrityState('LOCKED'); setMessage('Ca thi đã khóa do incident integrity; cần giám thị mở khóa.'); return; }
      setPaper(session);
      const serverAnswers = Object.fromEntries(session.items.map((item) => [item.id, item.answer ?? {}]));
      let localAnswers: Record<string, Record<string, unknown>> = {};
      try {
        const raw = sessionStorage.getItem(`smartpath-exam-answers-${session.sessionId}`);
        if (raw) localAnswers = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      } catch { /* malformed or unavailable storage */ }
      answers.current = { ...serverAnswers, ...localAnswers };
      setAnswered(Object.fromEntries(session.items.map((item) => [item.id, isAnswered(item.type, item.answer)])));
      setCurrent(0);
      setRemainingMs(Math.max(0, new Date(session.endsAt).getTime() - Date.now()));
      setStage('taking');
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa vào được môn thi.');
    }
  }

  useEffect(() => {
    if (stage !== 'taking' || !paper) return;
    const sessionId = paper.sessionId;
    const endsAt = paper.endsAt;
    const timer = window.setInterval(() => {
      const left = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemainingMs(left);
      if (left === 0) void submit();
    }, 1000);
    const beat = window.setInterval(() => {
      void apiRequest(`/api/v1/exams/sessions/${sessionId}/heartbeat`, { method: 'POST', idempotencyKey: newIdempotencyKey('exam-heartbeat') })
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    }, 20000);
    const refreshAttachmentExemption = () => {
      void apiRequest<{ token: string; expiresAt: string }>(`/api/v1/exams/sessions/${sessionId}/attachment-exemption`, { method: 'POST', idempotencyKey: newIdempotencyKey('exam-attachment-exemption') })
        .then((grant) => { attachmentExemptionToken.current = grant.token; })
        .catch(() => { attachmentExemptionToken.current = null; });
    };
    refreshAttachmentExemption();
    const exemptionRefresh = window.setInterval(refreshAttachmentExemption, 45_000);
    function log(kind: string, payload?: Record<string, unknown>) {
      const now = Date.now();
      if (['visibilitychange', 'blur', 'fullscreen_exit'].includes(kind) && now - lastIntegrityAt.current < 1000) return;
      if (['visibilitychange', 'blur', 'fullscreen_exit'].includes(kind)) lastIntegrityAt.current = now;
      void apiRequest<{ state: 'ACTIVE' | 'GRACE' | 'WARNING' | 'LOCKED'; incidentId: string | null; remainingMs: number }>('/api/v1/exams/integrity', { method: 'POST', idempotencyKey: newIdempotencyKey('exam-integrity'), body: { sessionId, kind, payload, exemptionToken: attachmentExemptionToken.current ?? undefined } }).then(async (data) => {
        setIntegrityState(data.state);
        integrityIncidentId.current = data.incidentId;
        setConnected(true);
      if (data.state === 'LOCKED') {
          setPaper((currentPaper) => currentPaper ? { ...currentPaper, lockedAt: new Date().toISOString() } : currentPaper);
          setMessage('Ca thi đã khóa do incident integrity. Bài làm được giữ nguyên; cần giám thị mở khóa.');
        } else if (data.state === 'GRACE' || data.state === 'WARNING') {
          setMessage(data.state === 'GRACE' ? 'Tín hiệu ngắn đang trong thời gian phục hồi.' : 'Cảnh báo integrity đang tiếp diễn; hãy quay lại phòng thi.');
        }
      }).catch(() => {
        setConnected(false);
        setMessage('Mất kết nối máy chủ. Sự cố mạng không bị tính là rời phòng; bài làm vẫn được giữ trên máy, em hãy thử lại.');
      });
    }
    function onVis() { if (document.visibilityState === 'hidden') log('visibilitychange', { state: document.visibilityState }); }
    function onBlur() { log('blur'); setMessage('Cửa sổ vừa mất focus. Nếu em vẫn đang làm bài, hãy quay lại cửa sổ thi; sự kiện này không tự nộp bài.'); }
    function onFull() {
      if (document.fullscreenElement) {
        if (fullscreenExitTimer.current !== null) window.clearTimeout(fullscreenExitTimer.current);
        fullscreenExitTimer.current = null;
        if (integrityIncidentId.current) {
          void apiRequest(`/api/v1/exams/sessions/${sessionId}/integrity/restore`, { method: 'POST', idempotencyKey: newIdempotencyKey('exam-integrity-restore'), body: { incidentId: integrityIncidentId.current } }).then(() => { integrityIncidentId.current = null; setIntegrityState('ACTIVE'); }).catch(() => undefined);
        }
        return;
      }
      if (attachmentPickerActive.current) return;
      fullscreenExitTimer.current = window.setTimeout(() => {
        if (!document.fullscreenElement && !attachmentPickerActive.current) { log('fullscreen_exit'); setMessage('Toàn màn hình đã tắt. Hãy bấm “Toàn màn hình” để khôi phục; việc này không tự nộp bài.'); }
        fullscreenExitTimer.current = null;
      }, 2_000);
    }
    function clearAttachmentPicker() {
      attachmentPickerActive.current = false;
      if (integrityIncidentId.current) {
        void apiRequest(`/api/v1/exams/sessions/${sessionId}/integrity/restore`, { method: 'POST', idempotencyKey: newIdempotencyKey('exam-integrity-restore'), body: { incidentId: integrityIncidentId.current } }).then(() => { integrityIncidentId.current = null; setIntegrityState('ACTIVE'); }).catch(() => undefined);
      }
    }
    function block(event: Event) { event.preventDefault(); log('clipboard'); }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFull);
    window.addEventListener('focus', clearAttachmentPicker);
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('contextmenu', block);
    return () => {
      window.clearInterval(timer); window.clearInterval(beat); window.clearInterval(exemptionRefresh);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFull);
      window.removeEventListener('focus', clearAttachmentPicker);
      if (fullscreenExitTimer.current !== null) window.clearTimeout(fullscreenExitTimer.current);
      attachmentExemptionToken.current = null;
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('contextmenu', block);
    };
  }, [stage, paper, submit]);

  async function saveCurrent(item: PaperItem, answer: Record<string, unknown>) {
    if (!paper || paper.lockedAt) return;
    answers.current[item.id] = answer;
    setAnswered((currentMap) => ({ ...currentMap, [item.id]: isAnswered(item.type, answer) }));
    const key = `smartpath-exam-answers-${paper.sessionId}`;
    try { sessionStorage.setItem(key, JSON.stringify(answers.current)); } catch { /* storage quota/private mode */ }
    try {
      await apiRequest('/api/v1/exams/sessions/' + paper.sessionId + '/answers', {
        method: 'PATCH',
        idempotencyKey: newIdempotencyKey('exam-save'),
        body: { sessionId: paper.sessionId, answers: [{ assignmentItemId: item.id, answer }] },
      });
      setConnected(true);
      try { sessionStorage.removeItem(key); } catch { /* private mode */ }
    } catch {
      setConnected(false);
      setMessage('Chưa đồng bộ được đáp án; câu trả lời vẫn được giữ trên thiết bị và sẽ thử lại khi kết nối trở lại.');
    }
  }

  async function uploadEssayFile(item: PaperItem, file: File) {
    if (!paper) return;
    setUploadProgress(0);
    try {
      const form = new FormData();
      form.append('file', file);
      if (attachmentExemptionToken.current) form.append('exemptionToken', attachmentExemptionToken.current);
      await ensureApiBase();
      const resource = await new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploadProgress(Math.round(event.loaded / event.total * 100)); };
        xhr.onload = () => {
          const payload = (() => { try { return JSON.parse(xhr.responseText) as { data?: { id: string }; error?: { message?: string } }; } catch { return null; } })();
          if (xhr.status >= 200 && xhr.status < 300 && payload?.data?.id) resolve(payload.data);
          else reject(new Error(payload?.error?.message ?? 'Chưa đính kèm được tệp.'));
        };
        xhr.onerror = () => reject(new Error('Chưa đính kèm được tệp.'));
        xhr.open('POST', apiUrl(`/api/v1/exams/sessions/${paper.sessionId}/attachments`));
        xhr.withCredentials = true;
        xhr.setRequestHeader('x-idempotency-key', newIdempotencyKey('exam-file'));
        xhr.send(form);
      });
      await saveCurrent(item, { ...answers.current[item.id], ...item.answer, resourceId: resource.id });
      setMessage('Đã đính kèm tệp. Tệp vào khu cách ly; READY nghĩa là ClamAV đã duyệt.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chưa đính kèm được tệp.');
    } finally {
      setUploadProgress(null);
    }
  }

  const item = paper?.items[current];
  const mm = Math.floor(remainingMs / 60000);
  const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0');
  const school = lobby?.councilName ?? 'Trường thành viên';
  const answeredCount = paper ? paper.items.filter((entry) => answered[entry.id]).length : 0;
  const backdropStage = stage === 'result' ? 'taking' : stage === 'gate' ? 'gate' : stage === 'taking' ? 'taking' : 'lobby';
  const fade = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
      exit: { opacity: 0, transition: { duration: DURATION.exit, ease: EASE_OUT } },
    };

  return (
    <div className={`cbt-app${stage !== 'gate' ? ' cbt-app-paper' : ''}`}>
      <CbtBackdrop stage={backdropStage} />
      <CbtHeader school={school} />
      <AnimatePresence mode="wait" initial={false}>
        {stage === 'gate' && (
          <motion.div key="gate" className="cbt-hero" {...fade}>
            {message && <p className="cbt-alert" role="alert">{message}</p>}
            <form className="cbt-login-card" onSubmit={(event) => void enter(event)}>
              <p className="cbt-kicker">THI THỬ CỦA TRƯỜNG</p>
              <p className="cbt-subkicker">(dành cho thí sinh)</p>
              <h1>ĐĂNG NHẬP LÀM BÀI THI</h1>
              <label htmlFor="studentCode">Mã thí sinh *</label>
              <input id="studentCode" name="studentCode" required autoComplete="username" defaultValue={lobby?.studentCode ?? 'SPHS-2026-000001'} />
              <label htmlFor="examPin">Mật khẩu *</label>
              <div className="cbt-pin-row">
                <input id="examPin" name="pin" type={showPin ? 'text' : 'password'} required minLength={6} autoComplete="current-password" />
                <button type="button" className="cbt-ghost" onClick={() => setShowPin((value) => !value)}>{showPin ? 'Ẩn' : 'Hiện'}</button>
              </div>
               <label htmlFor="examPeriod">Kỳ thi *</label>
               <select id="examPeriod" value={pickedPeriod} onChange={(event) => { setPickedPeriod(event.target.value); setPickedExamId(''); }}>
                 {periodOptions.length === 0 && <option value="">Chưa có kỳ đang mở</option>}
                 {periodOptions.map((period) => <option key={period.code} value={period.code}>{period.label}</option>)}
               </select>
               <label htmlFor="assignmentId">Môn thi *</label>
               <select
                id="assignmentId"
                name="assignmentId"
                value={pickedExamId}
                onChange={(event) => setPickedExamId(event.target.value)}
              >
                 {periodExams.length === 0 && <option value="">Chưa có môn trong kỳ này</option>}
                 {periodExams.map((exam) => (
                  <option key={exam.id} value={exam.id} disabled={exam.submitted}>{exam.title}{exam.submitted ? ' (đã nộp)' : ''}</option>
                ))}
              </select>
              <button className="cbt-primary" type="submit">Đăng nhập</button>
              {selectedExam?.integrityMode === 'STRICT_WEB' && (
                <div className="cbt-policy" role="note">
                  <strong>Ca thi nghiêm ngặt</strong>
                  <span>Yêu cầu máy tính từ 1024px và toàn màn hình. Mất mạng hoặc mở hộp chọn tệp tự luận không bị tính là gian lận.</span>
                </div>
              )}
              <p className="cbt-note">Dùng trình duyệt đầy đủ, không chia sẻ PIN. Đây là thi thử của trường, không phải phần mềm của Bộ.</p>
            </form>
          </motion.div>
        )}

        {stage === 'lobby' && lobby && (
          <motion.div key="lobby" className="cbt-lobby" {...fade}>
            {message && <p className="cbt-alert" role="alert">{message}</p>}
             <h1>{selectedExam?.title ?? 'Ca thi của trường'}</h1>
            <div className="cbt-lobby-grid">
              <section className="cbt-info-card">
                <h2>Thông tin thí sinh</h2>
                <p>Họ tên: <b>{lobby.displayName}</b></p>
                <p>Ngày sinh: {lobby.dateOfBirth ?? '—'}</p>
                <p>SBD / mã: <b>{lobby.studentCode}</b></p>
                <p>Giới tính: {lobby.gender ?? '—'}</p>
              </section>
              <section className="cbt-info-card">
                <h2>Hội đồng thi</h2>
                <p>Trường: <b>{lobby.councilName}</b></p>
                <p>Phòng: {lobby.room ?? 'Lớp học'}</p>
              </section>
            </div>
             <h2>Môn thi đã chọn</h2>
             {selectedExam ? (
               <article className="cbt-subject-card cbt-selected-exam">
                 <div><h3>{selectedExam.subjectName}</h3><p>{selectedExam.title}{selectedExam.durationMinutes ? ` · ${selectedExam.durationMinutes} phút` : ''}</p></div>
                 <button className="cbt-pill" type="button" disabled={selectedExam.submitted} onClick={() => void startTaking(selectedExam.id)}>
                   {selectedExam.submitted ? 'Đã nộp' : 'Vào thi'}
                 </button>
               </article>
             ) : <p className="cbt-muted">Chưa có môn thi trong kỳ này.</p>}
            <button className="cbt-ghost" type="button" onClick={() => setStage('gate')}>Quay lại</button>
          </motion.div>
        )}

        {stage === 'taking' && paper && item && (
          <motion.div key="taking" className="cbt-taking" {...fade}>
            <div className="cbt-infobar">
               <p>{lobby?.displayName} · {lobby?.studentCode} · {paper.subjectName} · Integrity: {integrityState}</p>
              <p className={`cbt-timer${remainingMs <= 5 * 60 * 1000 ? ' is-low' : ''}`} aria-live="polite">{mm}:{ss}</p>
              <p className={connected ? 'cbt-link-ok' : 'cbt-link-bad'}>{connected ? 'Đang kết nối' : 'Mất kết nối'}</p>
              <button className="cbt-primary cbt-compact" type="button" onClick={() => void submit()}>NỘP BÀI</button>
              <button className="cbt-ghost cbt-compact" type="button" onClick={() => void document.documentElement.requestFullscreen?.()}>Toàn màn hình</button>
            </div>
            <div className="cbt-tools">
              <button type="button" className="cbt-ghost" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))}>Câu trước</button>
              <button
                type="button"
                className="cbt-ghost"
                disabled={current >= paper.items.length - 1}
                onClick={() => setCurrent((value) => Math.min(paper.items.length - 1, value + 1))}
              >Tiếp theo</button>
              <p>Đã trả lời {answeredCount}/{paper.items.length}</p>
              <button type="button" className="cbt-ghost" onClick={() => void saveCurrent(item, answers.current[item.id] ?? {})}>Lưu</button>
              <button type="button" className="cbt-ghost" onClick={() => setZoom((value) => Math.min(140, value + 10))}>A+</button>
              <button type="button" className="cbt-ghost" onClick={() => setZoom((value) => Math.max(90, value - 10))}>A−</button>
            </div>
            {message && <p className="cbt-alert" role="alert">{message}</p>}
            <div className="cbt-work-stage">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={item.id} className="cbt-work" layout={false} style={{ fontSize: `${zoom}%` }} {...fade}>
                <aside className={`cbt-passage${item.prompt.passage || item.prompt.stem ? '' : ' is-empty'}`} aria-label="Ngữ liệu">
                  {item.prompt.passage || item.prompt.stem ? <p>{item.prompt.passage || item.prompt.stem}</p> : <p className="cbt-muted">Không có đoạn đọc riêng cho câu này.</p>}
                  {passageImageSrc(item.prompt) && (
                    <img className="cbt-passage-image" src={passageImageSrc(item.prompt)!} alt="Hình ngữ liệu của câu hỏi" width={640} height={400} />
                  )}
                </aside>
                <section className="cbt-question">
                  <div className="cbt-qhead">
                    <h2>Câu {item.number} · {item.points} điểm</h2>
                    <button type="button" className={flagged[item.id] ? 'cbt-flag is-on' : 'cbt-flag'} onClick={() => setFlagged((currentMap) => ({ ...currentMap, [item.id]: !currentMap[item.id] }))}>Cờ</button>
                  </div>
                  <p>{item.prompt.text || item.prompt.stem}</p>
                  {item.type === 'MULTIPLE_CHOICE' && (
                    <LetterChoice
                      variant="cbt"
                      name={`q-${item.id}`}
                      choices={(item.prompt.choices ?? []).slice(0, 4)}
                      value={typeof answers.current[item.id]?.choice === 'string' ? String(answers.current[item.id]?.choice) : null}
                      onChange={(_index, choice) => void saveCurrent(item, { choice })}
                    />
                  )}
                  {item.type === 'TRUE_FALSE' && (item.prompt.statements ?? []).map((statement) => {
                    const tfValues = (answers.current[item.id]?.values as Record<string, boolean> | undefined) ?? {};
                    return (
                      <fieldset key={statement.key} className="cbt-tf-row">
                        <legend>{statement.key}. {statement.text}</legend>
                        <label><input type="radio" name={`tf-${item.id}-${statement.key}`} checked={tfValues[statement.key] === true} onChange={() => void saveCurrent(item, { values: { ...tfValues, [statement.key]: true } })} /> Đúng</label>
                        <label><input type="radio" name={`tf-${item.id}-${statement.key}`} checked={tfValues[statement.key] === false} onChange={() => void saveCurrent(item, { values: { ...tfValues, [statement.key]: false } })} /> Sai</label>
                      </fieldset>
                    );
                  })}
                  {item.type === 'SHORT_ANSWER' && (
                    <label>
                      Kết quả số {item.prompt.unit ? `(${item.prompt.unit})` : ''}
                      <input inputMode="decimal" value={String(answers.current[item.id]?.numeric ?? '')} onChange={(event) => void saveCurrent(item, { numeric: event.target.value })} />
                    </label>
                  )}
                  {item.type === 'ESSAY' && (
                    <>
                      <RichTextEditor
                        label="Bài làm"
                        value={{ html: String(answers.current[item.id]?.editorHtml ?? ''), text: String(answers.current[item.id]?.text ?? '') }}
                        onChange={(next) => void saveCurrent(item, { ...answers.current[item.id], text: next.text, editorHtml: next.html })}
                        maxLength={20_000}
                        placeholder="Trình bày bài làm, lập luận và công thức của em…"
                      />
                      <label>
                        Đính kèm
                        <input type="file" onClick={() => { attachmentPickerActive.current = true; }} onChange={(event) => { const file = event.target.files?.[0]; attachmentPickerActive.current = false; if (file) void uploadEssayFile(item, file); }} />
                      </label>
                      {uploadProgress !== null && <p>Đang tải {uploadProgress}%</p>}
                    </>
                  )}
                </section>
              </motion.div>
            </AnimatePresence>
            </div>
            <nav className="cbt-navigator" aria-label="Danh sách câu">
              {paper.items.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`${answered[entry.id] ? 'is-answered' : ''} ${index === current ? 'is-current' : ''} ${flagged[entry.id] ? 'is-flagged' : ''}`}
                  onClick={() => setCurrent(index)}
                >
                  {entry.number}
                </button>
              ))}
            </nav>
          </motion.div>
        )}

        {stage === 'result' && (
          <motion.div
            key="result"
            className="cbt-modal-scrim"
            role="dialog"
            aria-labelledby="cbt-result-title"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { duration: DURATION.base, ease: EASE_OUT }}
          >
            <div className="cbt-result-modal">
              <h1 id="cbt-result-title">Kết quả thi</h1>
              <p className="cbt-success">Bạn đã nộp bài thi thành công!</p>
              <p>Số câu đã trả lời: {answeredCount}/{paper?.items.length ?? result?.questionCount ?? 0}</p>
              <p>
                Số điểm đạt được:{' '}
                {paper?.showScoreOnSubmit && result?.autoScore != null
                  ? result.gradingStatus === 'PROVISIONAL'
                    ? `${result.autoScore}/${result.provisionalMaxScore ?? result.maxScore} (tạm tính) · còn ${result.pendingCount ?? 0} câu chờ chấm`
                    : `${result.autoScore}/${result.maxScore}`
                  : 'Chờ giáo viên chấm (có câu tự luận hoặc nhà trường ẩn điểm khi nộp).'}
              </p>
              {message && <p className="cbt-alert">{message}</p>}
              <button className="cbt-primary" type="button" onClick={() => { setPaper(null); setStage('lobby'); }}>Hoàn thành</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="cbt-footer">{school} · Thi thử của trường, không phải phần mềm của Bộ.</p>
    </div>
  );
}
