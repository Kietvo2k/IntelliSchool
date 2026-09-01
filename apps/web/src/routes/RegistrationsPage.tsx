import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FormField, SelectInput, TextArea } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';

interface Registration {
  id: string;
  displayName: string;
  email: string;
  requestedRole: 'TEACHER' | 'STUDENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewReason?: string;
  createdAt: string;
}
interface Page { items: Registration[]; page: number; pageSize: number; totalItems: number; totalPages: number; }

export function RegistrationsPage() {
  const [active, setActive] = useState<Registration | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['registrations'],
    queryFn: () => apiRequest<Page>('/api/v1/registrations', { query: { page: '1', pageSize: '20' } }),
  });

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const form = new FormData(event.currentTarget);
    setMessage('');
    try {
      await apiRequest(`/api/v1/registrations/${active.id}/review`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('registration-review'),
        body: { decision, reason: form.get('reason') || undefined },
      });
      setActive(null);
      await query.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Không thể xử lý yêu cầu.');
    }
  }

  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Quản trị trường"
        title="Yêu cầu đăng ký"
        lede="Duyệt tài khoản giáo viên và học sinh theo mã trường. Người được duyệt sẽ nhận liên kết kích hoạt qua email."
      />
      <p className="muted-copy mb-4">Môi trường local: xem thư kích hoạt tại <a className="text-link" href="http://127.0.0.1:8025" target="_blank" rel="noreferrer">Mailpit (127.0.0.1:8025)</a>.</p>

      <div className="wizard-container">
        <nav className="wizard-steps" aria-label="Các bước xử lý đăng ký">
          <button
            type="button"
            className={`wizard-step-btn ${!active ? 'is-active' : 'is-completed'}`}
            onClick={() => setActive(null)}
            aria-current={!active ? 'step' : undefined}
          >
            <span className="wizard-step-badge">{active ? <Check size={14} aria-hidden="true" /> : '1'}</span>
            <span>1. Danh sách yêu cầu</span>
          </button>
          <div className="wizard-step-connector" aria-hidden="true" />
          <button
            type="button"
            className={`wizard-step-btn ${active ? 'is-active' : ''}`}
            disabled={!active}
            aria-current={active ? 'step' : undefined}
          >
            <span className="wizard-step-badge">2</span>
            <span>2. Xử lý yêu cầu</span>
          </button>
        </nav>

        {!active ? (
          <div>
            {query.isPending && <EmptyState>Đang tải yêu cầu…</EmptyState>}
            {query.isError && <ErrorState onRetry={() => void query.refetch()}>Không thể tải yêu cầu.</ErrorState>}
            {query.isSuccess && items.length === 0 && <EmptyState>Chưa có yêu cầu đăng ký nào.</EmptyState>}
            {items.length > 0 && (
              <DataTable headers={['Người đăng ký', 'Vai trò', 'Trạng thái', '']}>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.displayName}</b><small>{item.email}</small></td>
                    <td>{item.requestedRole === 'TEACHER' ? 'Giáo viên' : 'Học sinh'}</td>
                    <td><StatusBadge tone={item.status.toLowerCase()}>{item.status === 'PENDING' ? 'Chờ duyệt' : item.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}</StatusBadge></td>
                    <td>
                      {item.status === 'PENDING' && (
                        <button
                          className="button button-primary"
                          type="button"
                          onClick={() => { setActive(item); setDecision('APPROVED'); setMessage(''); }}
                        >
                          Xử lý
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        ) : (
          <article className="wizard-panel">
            <h2>Xử lý yêu cầu đăng ký</h2>
            <div className="mb-4 p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              <p className="font-bold text-lg">{active.displayName}</p>
              <p className="text-muted text-sm">{active.email} · Vai trò đăng ký: <strong>{active.requestedRole === 'TEACHER' ? 'Giáo viên' : 'Học sinh'}</strong></p>
            </div>
            <form className="login-form" onSubmit={(event) => void review(event)}>
              <FormField id="decision" label="Quyết định">
                <SelectInput id="decision" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>
                  <option value="APPROVED">Duyệt và gửi email kích hoạt</option>
                  <option value="REJECTED">Từ chối</option>
                </SelectInput>
              </FormField>
              <FormField id="reason" label={`Lý do ${decision === 'REJECTED' ? '(bắt buộc)' : '(không bắt buộc)'}`}>
                <TextArea id="reason" name="reason" required={decision === 'REJECTED'} minLength={decision === 'REJECTED' ? 3 : undefined} maxLength={2000} />
              </FormField>
              <div className="wizard-footer">
                <button type="button" className="button button-quiet" onClick={() => setActive(null)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Quay lại danh sách
                </button>
                <button className="button button-primary" type="submit">Xác nhận</button>
              </div>
              {message && <p className="form-message is-error" role="alert">{message}</p>}
            </form>
          </article>
        )}
      </div>
    </>
  );
}
