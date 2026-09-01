import { GraduationCap, LockKeyhole, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MotionReveal } from '../components/MotionReveal.js';

export function UnauthorizedGuardPage({ targetPath }: { targetPath?: string }) {
  const isAdminTarget = targetPath?.includes('admin') || targetPath?.includes('school');

  return (
    <main className="auth-page not-found-page">
      <div className="not-found-card unauthorized-card">
        <Link className="brand auth-link" to="/" aria-label="Về trang chủ Smart Path Platform">
          <span className="brand-mark"><GraduationCap aria-hidden="true" size={24} /></span>
          <span>Smart Path Platform</span>
        </Link>
        <MotionReveal tone="landing" index={0} variant="scale-in">
          <div className="not-found-badge is-unauthorized" aria-hidden="true">
            <ShieldAlert size={36} />
            <span>401</span>
          </div>
        </MotionReveal>
        <MotionReveal tone="landing" index={1} variant="clip-up">
          <h1>Yêu cầu đăng nhập vào trường</h1>
        </MotionReveal>
        <MotionReveal tone="landing" index={2}>
          <p className="not-found-lede">
            {isAdminTarget
              ? 'Khu vực quản trị và dữ liệu trường học được bảo vệ nghiêm ngặt. Bạn không thể truy cập trực tiếp khi chưa đăng nhập bằng tài khoản có thẩm quyền.'
              : 'Không gian làm việc của trường học yêu cầu xác thực danh tính. Vui lòng đăng nhập bằng tài khoản do nhà trường cấp.'}
          </p>
        </MotionReveal>
        <MotionReveal tone="landing" index={3}>
          <div className="not-found-actions">
            <Link className="button button-primary" to="/auth/login">
              <LockKeyhole size={18} aria-hidden="true" /> Đăng nhập vào trường
            </Link>
            <Link className="button button-login" to="/">
              Về trang chủ
            </Link>
          </div>
          <p className="not-found-help">
            Chưa có tài khoản? <Link className="text-link" to="/auth/register">Đăng ký bằng mã trường</Link> hoặc <Link className="text-link" to="/auth/school-request">Yêu cầu mở trường</Link>
          </p>
        </MotionReveal>
      </div>
    </main>
  );
}
