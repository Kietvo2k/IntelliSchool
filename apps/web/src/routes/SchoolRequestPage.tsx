import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { MotionReveal } from '../components/MotionReveal.js';
import { apiUrl, ensureApiBase } from '../lib/api.js';
import { BrandLogo } from '../components/BrandLogo.js';

type SubmissionState = 'idle' | 'sending' | 'success' | 'error';

const openSteps = [
  { n: '01', title: 'Gửi yêu cầu', text: 'Hiệu trưởng điền tên trường, họ tên, email công việc và tỉnh.' },
  { n: '02', title: 'Admin duyệt', text: 'Đội nền tảng xem trên web. Không tự mở tài khoản công khai.' },
  { n: '03', title: 'Nhận thư kích hoạt', text: 'Email riêng gửi hiệu trưởng. Trường cấp tài khoản cho thầy cô và học sinh.' },
];

export function SchoolRequestPage() {
  const [state, setState] = useState<SubmissionState>('idle');
  const [message, setMessage] = useState('');

  async function submitSchoolRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setState('sending');
    setMessage('');
    try {
      await ensureApiBase();
      const response = await fetch(apiUrl('/api/v1/public/school-requests'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.get('schoolName'),
          principalName: form.get('principalName'),
          principalEmail: form.get('principalEmail'),
          province: form.get('province'),
        }),
      });
      const payload = await response.json().catch(() => null) as { data?: { duplicate?: boolean }; error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Chưa thể gửi yêu cầu. Vui lòng thử lại.');
      formElement.reset();
      setState('success');
      setMessage(payload?.data?.duplicate ? 'Yêu cầu cho email này đang chờ admin xử lý; không tạo bản ghi trùng.' : 'Đã gửi yêu cầu. Admin nền tảng sẽ xem và gửi email riêng cho hiệu trưởng.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Có lỗi kết nối. Vui lòng thử lại.');
    }
  }

  return (
    <main className="auth-page school-request-page">
      <div className="school-request-shell">
        <Link className="brand auth-link" to="/" aria-label="Về trang chủ Smart Path Platform">
          <BrandLogo size="md" subtitle="Nền tảng trường số" />
        </Link>
        <div className="school-request-layout">
          <aside className="school-request-story">
            <MotionReveal tone="landing" index={0}>
              <p className="eyebrow">Mở trường trên Smart Path</p>
            </MotionReveal>
            <MotionReveal tone="landing" index={1} variant="clip-up">
              <h1 id="request-title">Ba bước. Form một lần. Email kích hoạt gửi hiệu trưởng.</h1>
            </MotionReveal>
            <MotionReveal tone="landing" index={2}>
              <ol className="open-steps">
                {openSteps.map((step) => (
                  <li key={step.n}>
                    <span>{step.n}</span>
                    <div>
                      <b>{step.title}</b>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </MotionReveal>
            <MotionReveal tone="landing" index={3}>
              <div className="school-request-guarantee" aria-hidden="true">
                <div className="guarantee-icon"><ShieldCheck size={20} /></div>
                <div>
                  <strong>Quy trình xác thực chính thức</strong>
                  <small>Admin nền tảng xác minh và bàn giao quyền quản trị trực tiếp cho hiệu trưởng</small>
                </div>
              </div>
            </MotionReveal>
          </aside>
          <MotionReveal tone="landing" index={1} variant="scale-in">
            <section className="school-request-card" aria-labelledby="request-title">
              <form className="school-request-form" onSubmit={submitSchoolRequest}>
                <div className="form-fields-grid">
                  <div className="form-field">
                    <label htmlFor="schoolName">Tên trường</label>
                    <input id="schoolName" name="schoolName" required minLength={3} maxLength={160} autoComplete="organization" placeholder="THPT Nguyễn Du" spellCheck={false} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="principalName">Họ tên hiệu trưởng</label>
                    <input id="principalName" name="principalName" required minLength={3} maxLength={120} autoComplete="name" placeholder="Nguyễn Thị Lan" spellCheck={false} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="principalEmail">Email công việc</label>
                    <input id="principalEmail" name="principalEmail" required type="email" maxLength={254} autoComplete="email" placeholder="hieutruong@truong.edu.vn" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="province">Tỉnh / thành phố</label>
                    <input id="province" name="province" required minLength={2} maxLength={100} autoComplete="address-level1" placeholder="Đà Nẵng" spellCheck={false} />
                  </div>
                </div>
                <button className="button button-primary" type="submit" disabled={state === 'sending'}>
                  {state === 'sending' && <Loader2 className="btn-spinner" size={18} aria-hidden="true" />}
                  <span>{state === 'sending' ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu mở trường'}</span>
                  {state !== 'sending' && <ArrowRight size={18} aria-hidden="true" />}
                </button>
                {message && (
                  <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role={state === 'error' ? 'alert' : 'status'}>
                    {message}
                  </p>
                )}
                <p className="auth-links">
                  <Link className="auth-link" to="/auth/login">Đã có tài khoản? Đăng nhập</Link>
                  <Link className="auth-link" to="/">Về trang chủ</Link>
                </p>
              </form>
            </section>
          </MotionReveal>
        </div>
      </div>
    </main>
  );
}
