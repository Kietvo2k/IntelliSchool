import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError } from '../lib/api.js';

interface BillingEvent { id: string; kind: string; amountVnd: number; note: string; createdAt: string; }
interface BillingOverview {
  status: string;
  classCount: number;
  includedClassQuota: number;
  basePriceVnd: number;
  extraClassPriceVnd: number;
  extraClassCount: number;
  monthlyChargeVnd: number;
  isChargeable: boolean;
  trialEndsAt: string | null;
  manualOverrideReason: string | null;
  events: BillingEvent[];
}

const STATUS_LABEL: Record<string, string> = { TRIAL: 'Dùng thử', ACTIVE: 'Đang hoạt động', SUSPENDED: 'Tạm ngưng', FREE: 'Miễn phí' };

function vnd(value: number): string { return `${value.toLocaleString('vi-VN')}đ`; }

export function BillingPage() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void apiRequest<BillingOverview>('/api/v1/billing/overview')
      .then(setOverview)
      .catch((error) => setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải thông tin gói dịch vụ.'));
  }, []);

  return (
    <>
      <PageHeader eyebrow="Gói dịch vụ" title="Gói dịch vụ & chi phí" lede="Chi phí hằng tháng dựa trên số lớp học đang dùng. Admin nền tảng quản lý trạng thái và ghi nhận thanh toán." />
      {message && <p className="form-message is-error" role="status">{message}</p>}

      {overview && (
        <>
          <section className="workspace-feature" aria-labelledby="plan-title">
            <h2 id="plan-title">Tổng quan</h2>
            <p><strong>Trạng thái:</strong> {STATUS_LABEL[overview.status] ?? overview.status}{overview.trialEndsAt ? ` · Hết hạn dùng thử: ${new Date(overview.trialEndsAt).toLocaleDateString('vi-VN')}` : ''}</p>
            <p><strong>Số lớp:</strong> {overview.classCount} (bao gồm {overview.includedClassQuota} lớp trong gói, phụ trội {overview.extraClassCount} lớp)</p>
            <p><strong>Đơn giá:</strong> gói {vnd(overview.basePriceVnd)}/tháng · lớp phụ trội {vnd(overview.extraClassPriceVnd)}/lớp</p>
            <p><strong>Chi phí tháng này:</strong> {overview.isChargeable ? vnd(overview.monthlyChargeVnd) : `${vnd(0)} (chưa tính phí)`}</p>
            {overview.manualOverrideReason && <p><small>Ghi chú điều chỉnh: {overview.manualOverrideReason}</small></p>}
          </section>

          <section aria-labelledby="events-title" style={{ marginTop: '1.25rem' }}>
            <h2 id="events-title">Lịch sử thanh toán</h2>
            {overview.events.length === 0 ? <p className="workspace-state">Chưa có sự kiện thanh toán nào.</p> : (
              <ul className="workspace-list">
                {overview.events.map((event) => (
                  <li key={event.id} className="workspace-list-item"><div><strong>{event.kind}</strong> · {vnd(event.amountVnd)}<br /><small>{new Date(event.createdAt).toLocaleString('vi-VN')}{event.note ? ` · ${event.note}` : ''}</small></div></li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
