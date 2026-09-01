import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';

interface SchoolRequestView {
  id: string;
  schoolName: string;
  principalName: string;
  principalEmail: string;
  province: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export function SchoolRequestsPage() {
  const [requests, setRequests] = useState<SchoolRequestView[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [resendRequestId, setResendRequestId] = useState<string | null>(null);

  async function load() {
    setState('loading');
    try {
      const data = await apiRequest<SchoolRequestView[]>('/api/v1/admin/school-requests');
      setRequests(data ?? []);
      setState('ready');
    } catch {
      setState('error');
    }
  }

  useEffect(() => { void load(); }, []);

  async function approve(id: string) {
    setMessage('');
    try {
      const approved = await apiRequest<{ activationEmailQueued: boolean }>(`/api/v1/admin/school-requests/${id}/approve`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('school-approve'),
        body: { reason: 'Duyệt qua workspace quản trị.' },
      });
      if (!approved.activationEmailQueued) {
        setResendRequestId(id);
        setMessage('Đã duyệt trường nhưng chưa gửi được email kích hoạt. Hãy gửi lại khi SMTP sẵn sàng.');
      }
      await load();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể duyệt trường. Vui lòng thử lại.');
    }
  }

  async function resendActivation(id: string) {
    setMessage('');
    try {
      const result = await apiRequest<{ activationEmailQueued: boolean }>(`/api/v1/admin/school-requests/${id}/resend-activation`, { method: 'POST', idempotencyKey: newIdempotencyKey('school-resend-activation') });
      if (result.activationEmailQueued) { setResendRequestId(null); setMessage('Đã gửi lại email kích hoạt cho hiệu trưởng.'); }
      else { setResendRequestId(id); setMessage('SMTP chưa sẵn sàng, email kích hoạt chưa được gửi.'); }
    } catch (error) { setResendRequestId(id); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể gửi lại email kích hoạt.'); }
  }

  async function reject(id: string) {
    const reason = (rejectReasons[id] ?? '').trim();
    if (reason.length < 3) { setMessage('Cần nhập lý do từ chối tối thiểu 3 ký tự.'); return; }
    setMessage('');
    try {
      await apiRequest(`/api/v1/admin/school-requests/${id}/reject`, {
        method: 'POST', idempotencyKey: newIdempotencyKey('school-reject'), body: { reason },
      });
      await load();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể từ chối yêu cầu mở trường. Vui lòng thử lại.');
    }
  }

  return (
    <>
      <p className="eyebrow">Điều hành</p>
      <h1>Yêu cầu mở trường</h1>
      {state === 'loading' && <div className="workspace-state" aria-busy="true">Đang tải danh sách…</div>}
      {state === 'error' && <div className="workspace-state is-error" role="alert">Chưa thể tải danh sách. <button type="button" onClick={() => void load()}>Thử lại</button></div>}
      {message && <p className="form-message is-error" role="alert">{message}</p>}
      {state === 'ready' && (
        requests.length === 0 ? (
          <div className="workspace-state">Chưa có yêu cầu mở trường nào.</div>
        ) : (
          <div className="metric-grid" style={{ gridTemplateColumns: '1fr' }}>
            {requests.map((request) => (
              <article className="metric-card" key={request.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <strong style={{ display: 'block' }}>{request.schoolName}</strong>
                  <small>{request.principalName} · {request.principalEmail} · {request.province}</small>
                </span>
                {request.status === 'PENDING' ? (
                  <div className="table-actions">
                    <label className="sr-only" htmlFor={`reject-reason-${request.id}`}>Lý do từ chối {request.schoolName}</label>
                    <input id={`reject-reason-${request.id}`} value={rejectReasons[request.id] ?? ''} onChange={(event) => setRejectReasons((current) => ({ ...current, [request.id]: event.target.value }))} minLength={3} maxLength={500} placeholder="Lý do nếu từ chối" />
                    <button className="button button-quiet" type="button" onClick={() => void reject(request.id)}>Từ chối</button>
                    <button className="button button-primary" type="button" onClick={() => void approve(request.id)}>Duyệt trường</button>
                  </div>
                ) : (
                  <span>{request.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}{request.status === 'APPROVED' && resendRequestId === request.id && <button className="button button-quiet" type="button" onClick={() => void resendActivation(request.id)}>Gửi lại email kích hoạt</button>}</span>
                )}
              </article>
            ))}
          </div>
        )
      )}
    </>
  );
}
