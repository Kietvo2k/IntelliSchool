import { ChangeEvent, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { apiUrl, ensureApiBase, newIdempotencyKey } from '../lib/api.js';

interface ImportPreview {
  canCommit: boolean;
  rows: Array<{ row: number; type: string; prompt: string; maxScore: number }>;
  errors: Array<{ row: number; field: string; message: string }>;
  imported?: { importedCount: number };
}

export function QuestionImportPanel({ bankId, onImported }: { bankId: string; onImported: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [state, setState] = useState<'idle' | 'previewing' | 'committing' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [templateHref, setTemplateHref] = useState('/api/v1/question-imports/template');

  useEffect(() => {
    void ensureApiBase().then(() => setTemplateHref(apiUrl('/api/v1/question-imports/template')));
  }, []);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setMessage('');
  }

  async function submit(commit: boolean) {
    if (!bankId) { setState('error'); setMessage('Chọn ngân hàng câu hỏi trước khi import.'); return; }
    if (!file) { setState('error'); setMessage('Chọn tệp CSV hoặc XLSX trước khi xem trước.'); return; }
    setState(commit ? 'committing' : 'previewing');
    setMessage('');
    const form = new FormData();
    form.set('bankId', bankId);
    form.set('commit', String(commit));
    form.set('file', file);
    try {
      await ensureApiBase();
      const response = await fetch(apiUrl('/api/v1/question-imports'), {
        method: 'POST', credentials: 'include', body: form,
        headers: commit ? { 'x-idempotency-key': newIdempotencyKey('question-import') } : undefined,
      });
      const payload = await response.json().catch(() => null) as { data?: ImportPreview; error?: { message?: string } } | null;
      if (payload?.data) setPreview(payload.data);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Không thể xử lý tệp import.');
      if (commit) {
        setState('idle');
        setMessage(`Đã import ${payload?.data?.imported?.importedCount ?? 0} câu hỏi. Các câu hỏi đang chờ duyệt.`);
        await onImported();
      } else setState('idle');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Không thể xử lý tệp import.');
    }
  }

  const busy = state === 'previewing' || state === 'committing';
  return (
    <article className="workspace-feature question-import-panel">
      <p>Import CSV / XLSX</p>
      <h2>Thêm tối đa 500 câu hỏi</h2>
      <span>Chọn tệp tối đa 5 MB, xem lỗi theo dòng rồi mới xác nhận import.</span>
      <a className="text-link" href={templateHref}>Tải mẫu CSV</a>
      <label className="file-input" htmlFor="question-import-file"><FileSpreadsheet size={18} aria-hidden="true" />{file?.name ?? 'Chọn tệp CSV hoặc XLSX'}</label>
      <input id="question-import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile} />
      <div className="table-actions">
        <button className="button button-quiet" type="button" onClick={() => void submit(false)} disabled={busy || !bankId}>{state === 'previewing' ? 'Đang đọc tệp…' : 'Xem trước'}</button>
        <button className="button button-primary" type="button" onClick={() => void submit(true)} disabled={busy || !preview?.canCommit || !bankId}>{state === 'committing' ? 'Đang import…' : 'Xác nhận import'}</button>
      </div>
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</p>}
      {preview && <div className="import-preview" aria-live="polite">
        <p><CheckCircle2 size={16} aria-hidden="true" /> {preview.rows.length} dòng hợp lệ {preview.canCommit ? 'có thể import.' : '— cần sửa lỗi bên dưới.'}</p>
        {preview.rows.slice(0, 5).map((row) => <span key={row.row}>Dòng {row.row}: {row.type} · {row.prompt} · {row.maxScore} điểm</span>)}
        {preview.errors.map((error) => <p className="import-error" key={`${error.row}-${error.field}`}><AlertCircle size={16} aria-hidden="true" /> Dòng {error.row || 'tệp'} · {error.field}: {error.message}</p>)}
      </div>}
    </article>
  );
}
