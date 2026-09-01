import { Link, useLocation } from 'react-router-dom';
import { AuthForm, type AuthMode } from '../components/AuthForm.js';
import { MotionReveal } from '../components/MotionReveal.js';
import type { SessionUser } from '../lib/session.js';
import { BrandLogo } from '../components/BrandLogo.js';

function modeFromPath(path: string): AuthMode {
  if (path.endsWith('/register')) return 'register';
  if (path.endsWith('/activate')) return 'activate';
  if (path.endsWith('/forgot-password')) return 'forgot';
  if (path.endsWith('/reset-password')) return 'reset';
  return 'login';
}

const authLinks = [
  { to: '/auth/login', label: 'Đăng nhập' },
  { to: '/auth/register', label: 'Đăng ký bằng mã trường' },
  { to: '/auth/forgot-password', label: 'Quên mật khẩu' },
  { to: '/auth/school-request', label: 'Mở trường' },
] as const;

const modeStories: Record<AuthMode, { title: string; desc: string }> = {
  login: {
    title: 'Đăng nhập để dạy, học và định hướng trong một nơi riêng.',
    desc: 'Tài khoản do nhà trường cấp. Dữ liệu trường nào nằm riêng trường đó.',
  },
  register: {
    title: 'Đăng ký bằng mã trường. Hiệu trưởng duyệt trước khi vào lớp.',
    desc: 'Tài khoản do nhà trường cấp. Đăng ký mới cần mã trường và chờ hiệu trưởng duyệt.',
  },
  forgot: {
    title: 'Khôi phục quyền truy cập vào trường của bạn.',
    desc: 'Nhập email trường để nhận liên kết đặt lại mật khẩu.',
  },
  activate: {
    title: 'Kích hoạt tài khoản trường học.',
    desc: 'Nhập mã kích hoạt từ thư mời và thiết lập mật khẩu an toàn.',
  },
  reset: {
    title: 'Thiết lập mật khẩu mới.',
    desc: 'Mật khẩu mới an toàn bảo vệ tài khoản và dữ liệu trường học.',
  },
};

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const location = useLocation();
  const mode = modeFromPath(location.pathname);
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const currentStory = modeStories[mode] ?? modeStories.login;

  return (
    <main className="auth-page auth-split">
      <aside className="auth-story">
        <Link className="brand auth-link" to="/" aria-label="Về trang chủ Smart Path Platform">
          <BrandLogo size="md" subtitle="Nền tảng trường số" />
        </Link>
        <MotionReveal tone="landing" index={0}>
          <p className="eyebrow">Không gian của trường</p>
        </MotionReveal>
        <MotionReveal tone="landing" index={1} variant="clip-up">
          <h1>{currentStory.title}</h1>
        </MotionReveal>
        <MotionReveal tone="landing" index={2}>
          <p>{currentStory.desc}</p>
        </MotionReveal>
        <MotionReveal tone="landing" index={3}>
          <div className="auth-credential-badge" aria-hidden="true">
            <div className="credential-top">
              <span className="badge-chip">Bảo mật trường học</span>
              <span className="badge-status-dot">Khu vực riêng</span>
            </div>
            <div className="credential-body">
              <strong>Không gian dữ liệu cách ly</strong>
              <small>Tài khoản do nhà trường cấp & duyệt trước khi vào</small>
            </div>
          </div>
        </MotionReveal>
      </aside>
      <MotionReveal tone="landing" index={1} variant="scale-in">
        <section className="auth-card" aria-labelledby="auth-title">
          <AuthForm mode={mode} token={token} idPrefix="auth" onAuthenticated={onAuthenticated} />
          <h1 id="auth-title" className="sr-only">{mode === 'register' ? 'Đăng ký' : 'Đăng nhập'}</h1>
          <p className="auth-links">
            {authLinks.filter((link) => link.to !== location.pathname).map((link) => (
              <Link key={link.to} className="auth-link" to={link.to}>{link.label}</Link>
            ))}
          </p>
        </section>
      </MotionReveal>
    </main>
  );
}
