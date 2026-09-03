import { FormEvent, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiRequest, ApiRequestError } from '../lib/api.js';
import type { SessionUser } from '../lib/session.js';

export type AuthMode = 'login' | 'register' | 'forgot' | 'activate' | 'reset';

type State = 'idle' | 'sending' | 'success' | 'error';

function titleFor(mode: AuthMode): string {
  if (mode === 'register') return 'Đăng ký bằng mã trường';
  if (mode === 'activate') return 'Kích hoạt tài khoản';
  if (mode === 'forgot') return 'Quên mật khẩu';
  if (mode === 'reset') return 'Đặt lại mật khẩu';
  return 'Đăng nhập IntelliSchool';
}

export function AuthForm({
  mode, token = '', idPrefix, onAuthenticated, submitLabel,
}: {
  mode: AuthMode;
  token?: string;
  idPrefix?: string;
  onAuthenticated?: (user: SessionUser) => void;
  submitLabel?: string;
}) {
  const reactId = useId();
  const prefix = idPrefix ?? reactId;
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const title = titleFor(mode);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState('sending');
    setMessage('');
    try {
      if (mode === 'register') {
        await apiRequest('/api/v1/public/registration-requests', { method: 'POST', body: { schoolCode: String(form.get('schoolCode')).trim().toUpperCase(), displayName: form.get('displayName'), email: form.get('email'), requestedRole: form.get('requestedRole') } });
        setState('success');
        setMessage('Yêu cầu đã được gửi. Hiệu trưởng sẽ duyệt trước khi bạn nhận email kích hoạt.');
        return;
      }
      if (mode === 'forgot') {
        await apiRequest('/api/v1/auth/forgot-password', { method: 'POST', body: { email: form.get('email') } });
        setState('success');
        setMessage('Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.');
        return;
      }
      if (mode === 'activate' || mode === 'reset') {
        await apiRequest(mode === 'activate' ? '/api/v1/auth/activate' : '/api/v1/auth/reset-password', { method: 'POST', body: { token: form.get('token'), newPassword: form.get('password') } });
        setState('success');
        setMessage('Mật khẩu đã được thiết lập. Bạn có thể đăng nhập ngay bây giờ.');
        return;
      }
      const result = await apiRequest<{ user: SessionUser }>('/api/v1/auth/login', { method: 'POST', body: { email: form.get('email'), password: form.get('password') } });
      onAuthenticated?.(result.user);
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
    }
  }

  const passwordMode = mode === 'activate' || mode === 'reset' || mode === 'login';
  const buttonLabel = submitLabel ?? (state === 'sending' ? 'Đang xử lý…' : mode === 'register' ? 'Gửi yêu cầu đăng ký' : passwordMode && mode !== 'login' ? 'Lưu mật khẩu' : mode === 'forgot' ? 'Gửi hướng dẫn' : 'Đăng nhập');

  return (
    <form className="login-form" onSubmit={(event) => void submit(event)}>
      <p className="eyebrow">Tài khoản an toàn</p>
      <h2 id={`${prefix}-title`} className="auth-form-title">{title}</h2>
      {mode === 'register' && (
        <>
          <label htmlFor={`${prefix}-schoolCode`}>Mã trường</label>
          <input id={`${prefix}-schoolCode`} name="schoolCode" required pattern="SP-[A-Z0-9]{8}" aria-describedby={`${prefix}-school-help`} />
          <small id={`${prefix}-school-help`}>Mã do nhà trường cung cấp.</small>
          <label htmlFor={`${prefix}-displayName`}>Họ và tên</label>
          <input id={`${prefix}-displayName`} name="displayName" required minLength={1} maxLength={120} autoComplete="name" />
          <label htmlFor={`${prefix}-role`}>Vai trò</label>
          <select id={`${prefix}-role`} name="requestedRole" defaultValue="STUDENT">
            <option value="STUDENT">Học sinh</option>
            <option value="TEACHER">Giáo viên</option>
          </select>
        </>
      )}
      {(mode === 'register' || mode === 'forgot' || mode === 'login') && (
        <>
          <label htmlFor={`${prefix}-email`}>Email</label>
          <input id={`${prefix}-email`} name="email" type="email" required maxLength={254} autoComplete="email" />
        </>
      )}
      {(mode === 'activate' || mode === 'reset') && (
        <>
          <label htmlFor={`${prefix}-token`}>Mã kích hoạt</label>
          <input id={`${prefix}-token`} name="token" required defaultValue={token} minLength={32} />
        </>
      )}
      {passwordMode && (
        <>
          <label htmlFor={`${prefix}-password`}>{mode === 'login' ? 'Mật khẩu' : 'Mật khẩu mới'}</label>
          <div className="password-field">
            <input id={`${prefix}-password`} name="password" type={showPassword ? 'text' : 'password'} required minLength={12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            <button className="password-toggle" type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ẩn' : 'Hiện'}</button>
          </div>
          {mode !== 'login' && <small>Tối thiểu 12 ký tự.</small>}
        </>
      )}
      <button className="button button-primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' && <Loader2 className="btn-spinner" size={18} aria-hidden="true" />}
        <span>{state === 'sending' ? 'Đang xử lý…' : buttonLabel}</span>
      </button>
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role={state === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>}
    </form>
  );
}
