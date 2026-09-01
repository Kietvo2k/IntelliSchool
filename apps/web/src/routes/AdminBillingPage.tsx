import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';

interface Subscription {
  schoolId: string;
  schoolName: string;
  status: string;
  classCount: number;
  includedClassQuota: number;
  basePriceVnd: number;
  extraClassPriceVnd: number;
  extraClassCount: number;
  monthlyChargeVnd: number;
  trialEndsAt: string | null;
  manualOverrideReason: string | null;
}
interface BillingEvent { id: string; kind: string; amountVnd: number; note: string; createdAt: string; }

function vnd(value: number): string { return `${value.toLocaleString('vi-VN')}đ`; }

export function AdminBillingPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function reload() {
    setState('loading');
    try {
      setSubscriptions(await apiRequest<Subscription[]>('/api/v1/admin/billing/subscriptions') ?? []);
      setState('idle');
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải gói dịch vụ.');
    }
  }

  useEffect(() => { void reload(); }, []);

  async function select(subscription: Subscription) {
    setSelected(subscription);
    setMessage('');
    try {
      setEvents(await apiRequest<BillingEvent[]>(`/api/v1/admin/schools/${subscription.schoolId}/billing-events`) ?? []);
    } catch {
      setEvents([]);
    }
  }

  async function saveSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setState('sending');
    setMessage('');
    try {
      await apiRequest(`/api/v1/admin/schools/${selected.schoolId}/subscription`, {
        method: 'PUT',
        idempotencyKey: newIdempotencyKey('subscription'),
        body: {
          status: String(form.get('status') ?? 'TRIAL'),
          includedClassQuota: Number(form.get('includedClassQuota') ?? 0),
          basePriceVnd: Number(form.get('basePriceVnd') ?? 0),
          extraClassPriceVnd: Number(form.get('extraClassPriceVnd') ?? 0),
          manualOverrideReason: String(form.get('manualOverrideReason') ?? '') || null,
        },
      });
      setMessage('Đã cập nhật gói dịch vụ.');
      setState('idle');
      await reload();
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể cập nhật gói dịch vụ.');
    }
  }

  async function recordEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setState('sending');
    setMessage('');
    try {
      await apiRequest(`/api/v1/admin/schools/${selected.schoolId}/billing-events`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('billing-event'),
        body: { kind: String(data.get('kind') ?? ''), amountVnd: Number(data.get('amountVnd') ?? 0), note: String(data.get('note') ?? '') },
      });
      setMessage('Đã ghi nhận sự kiện thanh toán.');
      setState('idle');
      form.reset();
      await select(selected);
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể ghi nhận sự kiện.');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Quản trị nền tảng" title="Quản lý gói dịch vụ" lede="Đặt trạng thái, hạn mức lớp, đơn giá và ghi nhận thanh toán thủ công cho từng trường." />
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</p>}

      <section aria-labelledby="subs-title">
        <h2 id="subs-title">Các trường</h2>
        {subscriptions.length === 0 ? <p className="workspace-state">Chưa có trường nào.</p> : (
          <ul className="workspace-list">
            {subscriptions.map((subscription) => (
              <li key={subscription.schoolId} className="workspace-list-item">
                <div><strong>{subscription.schoolName}</strong> · {subscription.status} · {subscription.classCount} lớp<br /><small>Chi phí tháng: {vnd(subscription.monthlyChargeVnd)}</small></div>
                <button type="button" className="button button-quiet" onClick={() => void select(subscription)}>Quản lý</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className="workspace-feature" aria-labelledby="edit-title" style={{ marginTop: '1.25rem' }}>
          <h2 id="edit-title">Gói dịch vụ · {selected.schoolName}</h2>
          <form className="login-form" onSubmit={saveSubscription}>
            <label htmlFor="subStatus">Trạng thái</label>
            <select id="subStatus" name="status" defaultValue={selected.status}>
              <option value="TRIAL">Dùng thử</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="SUSPENDED">Tạm ngưng</option>
            </select>
            <label htmlFor="subQuota">Số lớp trong gói</label>
            <input id="subQuota" name="includedClassQuota" type="number" min={0} defaultValue={selected.includedClassQuota} />
            <label htmlFor="subBase">Giá gói (VND/tháng)</label>
            <input id="subBase" name="basePriceVnd" type="number" min={0} defaultValue={selected.basePriceVnd} />
            <label htmlFor="subExtra">Giá lớp phụ trội (VND/lớp)</label>
            <input id="subExtra" name="extraClassPriceVnd" type="number" min={0} defaultValue={selected.extraClassPriceVnd} />
            <label htmlFor="subReason">Ghi chú điều chỉnh (tùy chọn)</label>
            <input id="subReason" name="manualOverrideReason" defaultValue={selected.manualOverrideReason ?? ''} maxLength={500} />
            <button className="button button-primary" type="submit" disabled={state === 'sending'}>Lưu gói dịch vụ</button>
          </form>

          <h3 style={{ marginTop: '1.25rem' }}>Ghi nhận thanh toán</h3>
          <form className="login-form" onSubmit={recordEvent}>
            <label htmlFor="evtKind">Loại</label>
            <input id="evtKind" name="kind" required minLength={2} maxLength={100} placeholder="INVOICE / PAYMENT / ADJUSTMENT" />
            <label htmlFor="evtAmount">Số tiền (VND)</label>
            <input id="evtAmount" name="amountVnd" type="number" min={0} defaultValue={0} />
            <label htmlFor="evtNote">Ghi chú</label>
            <input id="evtNote" name="note" maxLength={500} />
            <button className="button button-primary" type="submit" disabled={state === 'sending'}>Ghi nhận</button>
          </form>

          <h3 style={{ marginTop: '1.25rem' }}>Lịch sử</h3>
          {events.length === 0 ? <p className="workspace-state">Chưa có sự kiện.</p> : (
            <ul className="workspace-list">
              {events.map((event) => (
                <li key={event.id} className="workspace-list-item"><div><strong>{event.kind}</strong> · {vnd(event.amountVnd)}<br /><small>{new Date(event.createdAt).toLocaleString('vi-VN')}{event.note ? ` · ${event.note}` : ''}</small></div></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
