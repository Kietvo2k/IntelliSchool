import { FormEvent, useEffect, useRef, useState } from 'react';
import { Pagination } from '../components/Pagination.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { createIdempotentAction } from '../lib/idempotent-action.js';

type UserRole = 'PLATFORM_ADMIN' | 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT';

interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  role: UserRole | null;
  schoolName: string | null;
  isActive: boolean;
}

interface UserPage { items: AdminUserView[]; totalItems: number; totalPages: number; }
interface SchoolOption { id: string; name: string; code: string; }
interface SchoolPage { items: SchoolOption[]; }

export function AdminUsersPage() {
  const inviteAction = useRef(createIdempotentAction('platform-admin-invite', newIdempotencyKey)).current;
  const [schoolId, setSchoolId] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load(requestedPage = page) {
    setState('loading'); setMessage('');
    try {
      const result = await apiRequest<UserPage>('/api/v1/admin/users', { query: { page: String(requestedPage), pageSize: '50', schoolId: schoolId || undefined, role: role || undefined, status: status || undefined } });
      setUsers(result.items); setTotal(result.totalItems); setPage(requestedPage); setTotalPages(result.totalPages); setState('idle');
    } catch (error) {
      setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải danh sách người dùng.');
    }
  }

  useEffect(() => {
    void apiRequest<SchoolPage>('/api/v1/admin/schools', { query: { page: '1', pageSize: '100' } })
      .then((page) => setSchools(page.items))
      .catch(() => undefined);
  }, []);

  async function updateUserStatus(user: AdminUserView, isActive: boolean) {
    setState('sending'); setMessage('');
    try {
      const updated = await apiRequest<{ id: string; isActive: boolean }>(`/api/v1/admin/users/${user.id}/status`, {
        method: 'POST', idempotencyKey: newIdempotencyKey('admin-user-status'), body: { isActive },
      });
      setUsers((current) => current.map((item) => item.id === updated.id ? { ...item, isActive: updated.isActive } : item));
      setState('idle');
    } catch (error) {
      setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể cập nhật trạng thái tài khoản.');
    }
  }

  async function revokeSessions(user: AdminUserView) {
    setState('sending'); setMessage('');
    try {
      await apiRequest(`/api/v1/admin/users/${user.id}/revoke-sessions`, { method: 'POST', idempotencyKey: newIdempotencyKey('admin-user-revoke') });
      setState('idle'); setMessage(`Đã thu hồi toàn bộ phiên của ${user.displayName}.`);
    } catch (error) {
      setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể thu hồi phiên.');
    }
  }

  async function invitePlatformAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = { email: String(form.get('email') ?? ''), displayName: String(form.get('displayName') ?? '') };
    const ticket = inviteAction.begin(input);
    if (!ticket) return;
    setState('sending'); setMessage('');
    try {
      const invited = await apiRequest<{ email: string; displayName: string; activationEmailQueued: boolean }>('/api/v1/admin/platform-admins/invitations', {
        method: 'POST', idempotencyKey: ticket.key,
        body: input,
      });
      setState('idle');
      setMessage(invited.activationEmailQueued ? `Đã gửi liên kết kích hoạt cho ${invited.displayName}.` : `Đã tạo lời mời cho ${invited.displayName}; cần cấu hình SMTP để gửi liên kết kích hoạt.`);
      formElement.reset();
      inviteAction.end(input, true);
    } catch (error) {
      inviteAction.end(input, false);
      setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể mời admin nền tảng.');
    }
  }

  return (
    <>
      <p className="eyebrow">Điều hành nền tảng</p>
      <h1>Quản lý người dùng</h1>
      <p className="page-lede">Lọc tài khoản theo vai trò, khóa/mở tài khoản và thu hồi các phiên đăng nhập đang hoạt động.</p>
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role={state === 'error' ? 'alert' : 'status'}>{message}</p>}
      <article className="workspace-feature">
        <h2>Mời admin nền tảng</h2>
        <p>Người được mời tự đặt mật khẩu từ liên kết kích hoạt chỉ dùng một lần, hiệu lực 30 phút.</p>
        <form className="login-form" onSubmit={(event) => void invitePlatformAdmin(event)}>
          <label htmlFor="platform-admin-display-name">Họ tên admin mới</label>
          <input id="platform-admin-display-name" name="displayName" required minLength={1} maxLength={120} autoComplete="name" />
          <label htmlFor="platform-admin-email">Email admin mới</label>
          <input id="platform-admin-email" name="email" type="email" required maxLength={254} autoComplete="email" />
          <button className="button button-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Đang gửi…' : 'Gửi lời mời'}</button>
        </form>
      </article>
      <form className="admin-filter" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
        <label htmlFor="admin-user-school">Lọc theo trường</label>
        <select id="admin-user-school" value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
          <option value="">Nền tảng và mọi trường</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.code}</option>)}
        </select>
        <label htmlFor="admin-user-role">Lọc theo vai trò</label>
        <select id="admin-user-role" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">Tất cả vai trò</option><option value="PLATFORM_ADMIN">Admin nền tảng</option><option value="SCHOOL_OWNER">Hiệu trưởng</option><option value="TEACHER">Giáo viên</option><option value="STUDENT">Học sinh</option>
        </select>
        <label htmlFor="admin-user-status">Trạng thái</label>
        <select id="admin-user-status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Đã khóa</option>
        </select>
        <button className="button button-primary" type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'Đang tải…' : 'Tải danh sách'}</button>
      </form>
      {state === 'loading' && <p className="workspace-state" role="status">Đang tải người dùng…</p>}
      {state !== 'loading' && users.length === 0 && !message && <p className="workspace-state" role="status">Chưa tải danh sách. Chọn bộ lọc rồi bấm “Tải danh sách”.</p>}
      {users.length > 0 && <div className="data-table-wrap" aria-label={`Có ${total} người dùng`}>
        <table>
          <thead><tr><th scope="col">Người dùng</th><th scope="col">Vai trò</th><th scope="col">Trường</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td><strong>{user.displayName}</strong><small>{user.email}</small></td><td>{user.role?.replaceAll('_', ' ') ?? 'Chưa gán vai trò'}</td><td>{user.schoolName ?? 'Nền tảng'}</td>
            <td><span className={`status-badge ${user.isActive ? 'approved' : 'rejected'}`}>{user.isActive ? 'Đang hoạt động' : 'Đã khóa'}</span></td>
            <td><div className="table-actions"><button className="button button-quiet" type="button" disabled={state === 'sending'} onClick={() => void updateUserStatus(user, !user.isActive)}>{user.isActive ? 'Khóa' : 'Mở khóa'}</button><button className="button button-primary" type="button" disabled={state === 'sending'} onClick={() => void revokeSessions(user)}>Thu hồi phiên</button></div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {users.length > 0 && <Pagination page={page} totalPages={totalPages} totalItems={total} disabled={state === 'loading' || state === 'sending'} onChange={(nextPage) => void load(nextPage)} />}
    </>
  );
}
