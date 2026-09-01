import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError, downloadFile, newIdempotencyKey, triggerDownload } from '../lib/api.js';

interface ReportExportView { id: string; kind: 'GRADEBOOK' | 'PROGRESS'; format: 'CSV' | 'XLSX'; status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED'; expiresAt: string; }

export function ReportExportsPanel({ classId }: { classId: string }) {
  const [format, setFormat] = useState<'CSV' | 'XLSX'>('XLSX');
  const [exports, setExports] = useState<ReportExportView[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  async function load() {
    try { setExports(await apiRequest<ReportExportView[]>('/api/v1/report-exports')); }
    catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể làm mới trạng thái export.');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!exports.some((item) => item.status === 'QUEUED' || item.status === 'PROCESSING')) return;
    const timer = window.setInterval(() => void load(), 2_000);
    return () => window.clearInterval(timer);
  }, [exports]);
  async function requestExport(kind: 'GRADEBOOK' | 'PROGRESS') {
    if (!classId) return;
    setState('sending'); setMessage('');
    try {
      await apiRequest('/api/v1/report-exports', { method: 'POST', idempotencyKey: newIdempotencyKey('report-export'), body: { kind, format, classId } });
      setState('idle'); setMessage('Đã tạo yêu cầu export. File sẽ xuất hiện khi xử lý xong.'); await load();
    } catch (error) { setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tạo export.'); }
  }
  async function download(item: ReportExportView) {
    try { triggerDownload(await downloadFile(`/api/v1/report-exports/${item.id}/download`)); }
    catch (error) { setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải file export.'); }
  }
  async function retry(item: ReportExportView) {
    setState('sending'); setMessage('');
    try {
      await apiRequest(`/api/v1/report-exports/${item.id}/retry`, { method: 'POST', idempotencyKey: newIdempotencyKey('report-export-retry') });
      setState('idle'); setMessage('Đã xếp lại export.'); await load();
    } catch (error) { setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể thử lại export.'); }
  }
  return <section className="workspace-feature" style={{ marginTop: '1.5rem' }} aria-label="Xuất báo cáo">
    <p>Xuất dữ liệu</p><h2>Xuất báo cáo</h2>
    <label htmlFor="report-export-format">Định dạng</label>
    <select id="report-export-format" value={format} onChange={(event) => setFormat(event.target.value as 'CSV' | 'XLSX')} disabled={state === 'sending'}><option value="XLSX">Excel (.xlsx)</option><option value="CSV">CSV</option></select>
    <div className="table-actions"><button className="button button-primary" type="button" disabled={!classId || state === 'sending'} onClick={() => void requestExport('GRADEBOOK')}>Xuất sổ điểm</button><button className="button button-quiet" type="button" disabled={!classId || state === 'sending'} onClick={() => void requestExport('PROGRESS')}>Xuất tiến độ</button></div>
    {!classId && <p className="muted-copy">Chọn lớp trước khi tạo export.</p>}
    {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role={state === 'error' ? 'alert' : 'status'}>{message}</p>}
    {exports.length > 0 && <ul>{exports.slice(0, 5).map((item) => <li key={item.id}>{item.kind === 'GRADEBOOK' ? 'Sổ điểm' : 'Tiến độ'} · {item.format} · {item.status === 'PROCESSING' ? 'RUNNING' : item.status}{item.status === 'READY' && <button className="button button-quiet" type="button" onClick={() => void download(item)}>Tải file</button>}{item.status === 'FAILED' && <button className="button button-quiet" type="button" onClick={() => void retry(item)} disabled={state === 'sending'}>Thử lại</button>}</li>)}</ul>}
  </section>;
}
