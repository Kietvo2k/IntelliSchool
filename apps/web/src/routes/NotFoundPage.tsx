import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Building, Compass, GraduationCap, Home, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MotionReveal } from '../components/MotionReveal.js';
import { useOptionalSession } from '../lib/SessionContext.js';

import { BrandLogo } from '../components/BrandLogo.js';

export function NotFoundPage() {
  const session = useOptionalSession();
  const navigate = useNavigate();

  function handleGoBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(session ? '/app' : '/');
    }
  }

  return (
    <main className="auth-page not-found-page">
      <div className="not-found-card">
        <Link className="brand auth-link" to={session ? '/app' : '/'} aria-label="Smart Path Platform">
          <BrandLogo size="md" subtitle={session ? 'Không gian làm việc' : 'Nền tảng trường số'} />
        </Link>

        <MotionReveal tone="landing" index={0} variant="scale-in">
          <div className="not-found-badge" aria-hidden="true">
            <Compass size={36} />
            <span>404</span>
          </div>
        </MotionReveal>

        <MotionReveal tone="landing" index={1} variant="clip-up">
          <h1>Không tìm thấy trang</h1>
        </MotionReveal>

        <MotionReveal tone="landing" index={2}>
          <p className="not-found-lede">
            Địa chỉ bạn vừa truy cập không tồn tại hoặc đã được chuyển sang khu vực khác trong hệ thống trường học.
          </p>
        </MotionReveal>

        <MotionReveal tone="landing" index={3}>
          <div className="not-found-actions">
            <button type="button" className="button button-quiet" onClick={handleGoBack}>
              <ArrowLeft size={18} aria-hidden="true" /> Quay lại
            </button>
            {session ? (
              <Link className="button button-primary" to="/app">
                <LayoutDashboard size={18} aria-hidden="true" /> Vào không gian làm việc
              </Link>
            ) : (
              <Link className="button button-primary" to="/">
                <Home size={18} aria-hidden="true" /> Về trang chủ
              </Link>
            )}
            {!session && (
              <Link className="button button-login" to="/auth/login">
                Đăng nhập <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>

          <div className="not-found-grid" aria-label="Lối tắt phổ biến">
            {session ? (
              <>
                <Link className="not-found-shortcut" to="/app/lessons">
                  <BookOpen size={20} aria-hidden="true" />
                  <span>Bài giảng</span>
                </Link>
                <Link className="not-found-shortcut" to="/app/careers">
                  <Briefcase size={20} aria-hidden="true" />
                  <span>Hướng nghiệp</span>
                </Link>
                <Link className="not-found-shortcut" to="/app/profile">
                  <GraduationCap size={20} aria-hidden="true" />
                  <span>Hồ sơ cá nhân</span>
                </Link>
              </>
            ) : (
              <>
                <Link className="not-found-shortcut" to="/auth/school-request">
                  <Building size={20} aria-hidden="true" />
                  <span>Mở trường mới</span>
                </Link>
                <Link className="not-found-shortcut" to="/auth/login">
                  <GraduationCap size={20} aria-hidden="true" />
                  <span>Đăng nhập</span>
                </Link>
              </>
            )}
          </div>

          <p className="not-found-help">
            Cần mở trường mới cho trường bạn? <Link className="text-link" to="/auth/school-request">Gửi yêu cầu mở trường</Link>
          </p>
        </MotionReveal>
      </div>
    </main>
  );
}
