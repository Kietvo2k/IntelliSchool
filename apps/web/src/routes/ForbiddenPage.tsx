import { ArrowRight, Home, ShieldAlert, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.js';

export function ForbiddenPage() {
  const { user } = useSession();
  const roleLabel =
    user.role === 'STUDENT'
      ? 'Học sinh'
      : user.role === 'TEACHER'
      ? 'Giáo viên'
      : user.role === 'SCHOOL_OWNER'
      ? 'Ban giám hiệu'
      : 'Quản trị viên nền tảng';

  return (
    <div className="forbidden-panel">
      <div className="forbidden-badge" aria-hidden="true">
        <ShieldAlert size={32} />
        <span>403</span>
      </div>
      <p className="eyebrow">Phân quyền trường học</p>
      <h1>Không có quyền truy cập</h1>
      <p className="forbidden-lede">
        Tài khoản hiện tại của bạn có vai trò <strong>{roleLabel}</strong>, không thuộc nhóm tài khoản được cấp quyền quản trị hoặc truy cập vào phân hệ này.
      </p>
      <div className="forbidden-actions">
        <Link className="button button-primary" to="/app">
          <Home size={18} aria-hidden="true" /> Về tổng quan
        </Link>
        <Link className="button button-login" to="/app/profile">
          <User size={18} aria-hidden="true" /> Xem hồ sơ <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
