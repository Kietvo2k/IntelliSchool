import { ArrowRight, BookOpenCheck, BriefcaseBusiness, Building2, CheckCircle2, ChevronRight, ClipboardCheck, GraduationCap, LockKeyhole, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { RoleWorkspace, type SessionUser } from './components/RoleWorkspace.js';
import './styles.css';

type SubmissionState = 'idle' | 'sending' | 'success' | 'error';

const platformPaths = [
  {
    icon: BookOpenCheck,
    title: 'Lớp học',
    text: 'Bài giảng, bài tập và phản hồi rõ ràng cho từng lớp.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Định hướng',
    text: 'Khám phá sở thích, năng lực và những hướng đi phù hợp.',
  },
  {
    icon: ShieldCheck,
    title: 'Quản trị',
    text: 'Mỗi trường một không gian riêng, có kiểm soát và nhật ký truy cập.',
  },
];

function LoginDialog({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: (user: SessionUser) => void }) {
  const [state, setState] = useState<SubmissionState>('idle');
  const [message, setMessage] = useState('');

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState('sending');
    setMessage('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3002'}/api/v1/auth/login`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      const payload = await response.json().catch(() => null) as { data?: { user?: SessionUser }; error?: { message?: string } } | null;
      if (!response.ok || !payload?.data?.user) throw new Error(payload?.error?.message ?? 'Chưa thể đăng nhập. Vui lòng thử lại.');
      onAuthenticated(payload.data.user);
      onClose();
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Có lỗi kết nối. Vui lòng thử lại.');
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="dialog-close" type="button" aria-label="Đóng đăng nhập" onClick={onClose}>×</button>
        <p className="eyebrow">Không gian riêng của trường</p>
        <h2 id="login-title">Đăng nhập Smart Path</h2>
        <p>Đăng nhập bằng email và mật khẩu do trường hoặc nền tảng cấp.</p>
        <form className="login-form" onSubmit={submitLogin}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <label htmlFor="login-password">Mật khẩu</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128} />
          <button className="button button-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
          {message && <p className="form-message is-error" role="alert">{message}</p>}
        </form>
        <a className="text-link login-request" href="#request" onClick={onClose}>Tôi cần mở hệ thống cho trường</a>
      </section>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<SubmissionState>('idle');
  const [message, setMessage] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3002'}/api/v1/auth/session`, { credentials: 'include' })
      .then(async (response) => response.ok ? response.json() as Promise<{ data?: { user?: SessionUser } }> : null)
      .then((payload) => { if (payload?.data?.user) setSessionUser(payload.data.user); })
      .catch(() => undefined);
  }, []);

  async function logout() {
    await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3002'}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setSessionUser(null);
  }

  async function submitSchoolRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState('sending');
    setMessage('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3002'}/api/v1/public/school-requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.get('schoolName'),
          principalName: form.get('principalName'),
          principalEmail: form.get('principalEmail'),
          province: form.get('province'),
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Chưa thể gửi yêu cầu. Vui lòng thử lại.');

      event.currentTarget.reset();
      setState('success');
      setMessage('Đã gửi yêu cầu. Admin nền tảng sẽ xem xét và liên hệ qua email riêng.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Có lỗi kết nối. Vui lòng thử lại.');
    }
  }

  if (sessionUser) return <RoleWorkspace user={sessionUser} onLogout={() => void logout()} />;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Đi tới nội dung chính</a>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Smart Path Platform trang chủ">
          <span className="brand-mark"><GraduationCap aria-hidden="true" size={24} /></span>
          <span>Smart Path Platform</span>
        </a>
        <nav aria-label="Điều hướng chính">
          <a href="#platform">Nền tảng</a>
          <a href="#security">An toàn</a>
          <a href="#request">Mở trường</a>
        </nav>
        <div className="topbar-actions">
          <button className="button button-login" type="button" aria-haspopup="dialog" aria-expanded={loginOpen} onClick={() => setLoginOpen(true)}>Đăng nhập</button>
          <a className="button button-quiet" href="#request">Đăng ký trường <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy reveal">
            <p className="eyebrow"><Sparkles size={16} aria-hidden="true" /> Smart Path Platform · Nền tảng trường số</p>
            <h1 id="hero-title">Mở không gian số cho <em>trường của bạn.</em></h1>
            <p className="hero-lede">Từ lớp học mỗi ngày đến định hướng dài hạn, Smart Path Platform giúp nhà trường kết nối việc dạy, học và lựa chọn tương lai trong một nơi riêng tư.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#request">Gửi yêu cầu mở trường <ArrowRight size={18} aria-hidden="true" /></a>
              <a className="text-link" href="#platform">Khám phá nền tảng <ChevronRight size={18} aria-hidden="true" /></a>
            </div>
            <ul className="trust-list" aria-label="Lợi ích chính">
              <li><CheckCircle2 size={17} aria-hidden="true" /> Mỗi trường là một khu vực tách biệt</li>
              <li><CheckCircle2 size={17} aria-hidden="true" /> Hiệu trưởng chủ động quản trị</li>
            </ul>
          </div>
          <div className="hero-panel reveal" aria-label="Minh họa không gian Smart Path Platform">
            <div className="panel-topline"><span>THPT Nguyễn Du</span><span className="live-dot">Đang hoạt động</span></div>
            <div className="progress-card">
              <span className="panel-kicker">Lớp 12A1 · Toán</span>
              <strong>Ôn tập hàm số</strong>
              <div className="progress-track"><span /></div>
              <small>28/34 học sinh đã hoàn thành</small>
            </div>
            <div className="panel-grid">
              <div><UsersRound size={21} aria-hidden="true" /><b>12</b><span>Lớp học</span></div>
              <div><ClipboardCheck size={21} aria-hidden="true" /><b>86%</b><span>Bài nộp đúng hạn</span></div>
              <div><BriefcaseBusiness size={21} aria-hidden="true" /><b>04</b><span>Hồ sơ hướng nghiệp</span></div>
            </div>
            <p className="panel-note"><LockKeyhole size={15} aria-hidden="true" /> Dữ liệu chỉ thuộc về trường của bạn.</p>
          </div>
        </section>

        <section className="platform-section" id="platform" aria-labelledby="platform-title">
          <div className="section-heading">
            <p className="eyebrow">Một nền tảng, ba nhịp vận hành</p>
            <h2 id="platform-title">Đủ gần với lớp học. Đủ rộng cho tương lai.</h2>
          </div>
          <div className="path-grid">
            {platformPaths.map(({ icon: Icon, title, text }, index) => (
              <article className="path-card" key={title}>
                <span className="path-index">0{index + 1}</span>
                <Icon size={27} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
                <a href="#request">Tìm hiểu thêm <ArrowRight size={16} aria-hidden="true" /></a>
              </article>
            ))}
          </div>
        </section>

        <section className="security-section" id="security" aria-labelledby="security-title">
          <div>
            <p className="eyebrow">Thiết kế school-first</p>
            <h2 id="security-title">Quyền quản trị bắt đầu từ hiệu trưởng, không phải từ một màn hình dùng chung.</h2>
          </div>
          <div className="security-points">
            <p><Building2 aria-hidden="true" size={22} /><span><b>Một trường, một không gian</b>Tenant riêng để dữ liệu học tập không lẫn giữa các trường.</span></p>
            <p><ShieldCheck aria-hidden="true" size={22} /><span><b>Kiểm soát có dấu vết</b>Những thao tác quản trị quan trọng được thiết kế để có audit trail.</span></p>
            <p><LockKeyhole aria-hidden="true" size={22} /><span><b>Bảo mật theo vai trò</b>Học sinh, giáo viên, hiệu trưởng và admin có phạm vi làm việc khác nhau.</span></p>
          </div>
        </section>

        <section className="request-section" id="request" aria-labelledby="request-title">
          <div className="request-intro">
            <p className="eyebrow">Bắt đầu pilot</p>
            <h2 id="request-title">Mở hệ thống Smart Path Platform cho trường bạn.</h2>
            <p>Hiệu trưởng gửi yêu cầu. Admin nền tảng duyệt trên web, sau đó gửi lời mời kích hoạt qua email riêng.</p>
          </div>
          <form className="request-form" onSubmit={submitSchoolRequest}>
            <label htmlFor="schoolName">Tên trường <span aria-hidden="true">*</span></label>
            <input id="schoolName" name="schoolName" required minLength={3} maxLength={160} autoComplete="organization" placeholder="Ví dụ: THPT Nguyễn Du" />
            <label htmlFor="principalName">Họ tên hiệu trưởng <span aria-hidden="true">*</span></label>
            <input id="principalName" name="principalName" required minLength={3} maxLength={120} autoComplete="name" placeholder="Nguyễn Thị Lan" />
            <label htmlFor="principalEmail">Email công việc <span aria-hidden="true">*</span></label>
            <input id="principalEmail" name="principalEmail" required type="email" maxLength={254} autoComplete="email" placeholder="hieutruong@truong.edu.vn" />
            <label htmlFor="province">Tỉnh / thành phố <span aria-hidden="true">*</span></label>
            <input id="province" name="province" required minLength={2} maxLength={100} autoComplete="address-level1" placeholder="Đà Nẵng" />
            <button className="button button-primary" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu mở trường'} <ArrowRight size={18} aria-hidden="true" />
            </button>
            {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</p>}
          </form>
        </section>
      </main>

      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} onAuthenticated={setSessionUser} />}
      <footer>Smart Path Platform · Nền tảng trường số cho hai trường pilot đầu tiên.</footer>
    </div>
  );
}



