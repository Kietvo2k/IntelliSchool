import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';

interface Ranked { institutionMajorId: string; institutionId: string; institutionName: string; province: string | null; majorName: string; allowedBlocks: string[]; matchedBlock: string | null; matchedBlockLabel?: string | null; applicantScore: number | null; cutoff: number | null; sourceUrl: string | null; gap: number | null; missingSubjects?: string[]; matchReasons?: string[]; dataQuality?: 'SOURCED' | 'NO_SOURCE' }
interface Detail { id: string; name: string; description: string | null; website: string | null; programs: Array<{ institutionMajorId: string; majorName: string; admissionScores: Array<{ year: number; examBlock: string | null; score: number; sourceUrl: string | null }> }> }
interface ExamBlockOption { code: string; label: string }

export function CareerSchoolsPage() {
  const [query, setQuery] = useState('');
  const [examBlock, setExamBlock] = useState('');
  const [items, setItems] = useState<Ranked[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [compare, setCompare] = useState<Ranked[]>([]);
  const [message, setMessage] = useState('');
  const [blocks, setBlocks] = useState<ExamBlockOption[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const detailCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!detail) return;
    detailCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetail(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detail]);

  async function search() {
    setLoadState('loading');
    try {
      const data = await apiRequest<{ disclaimer: string; items: Ranked[] }>('/api/v1/career/schools/rank', { query: { query: query || undefined, examBlock: examBlock || undefined } });
      setDisclaimer(data.disclaimer);
      setItems(data.items ?? []);
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể xếp hạng trường.');
    }
  }

  useEffect(() => {
    void apiRequest<{ disclaimer: string; items: Ranked[] }>('/api/v1/career/schools/rank')
      .then((data) => {
        setDisclaimer(data.disclaimer);
        setItems(data.items ?? []);
        setLoadState('ready');
      })
      .catch((error) => {
        setLoadState('error');
        setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể xếp hạng trường.');
      });
    void apiRequest<{ blocks: ExamBlockOption[] }>('/api/v1/career/exam-blocks').then((data) => setBlocks(data.blocks ?? [])).catch(() => setBlocks([]));
  }, []);

  async function bookmark(item: Ranked) {
    try {
      await apiRequest('/api/v1/saved-items', { method: 'POST', idempotencyKey: newIdempotencyKey('save-school'), body: { itemType: 'INSTITUTION', itemId: item.institutionId } });
      setMessage('Đã lưu trường vào danh sách của em.');
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu.');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Hướng nghiệp" title="Trường gợi ý" lede="Lọc theo tổ hợp ngành–trường cho phép. Điểm chuẩn chỉ hiện khi có nguồn." />
      {message && <p className="form-message" role="status">{message}</p>}
      <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <label htmlFor="schoolQuery">Tìm trường / ngành</label>
        <input id="schoolQuery" value={query} onChange={(event) => setQuery(event.target.value)} />
        <label htmlFor="blockFilter">Tổ hợp</label>
        <input id="blockFilter" list="exam-block-options" value={examBlock} onChange={(event) => setExamBlock(event.target.value.toUpperCase())} placeholder="A00" maxLength={3} />
        <datalist id="exam-block-options">{blocks.map((block) => <option key={block.code} value={block.code}>{block.label}</option>)}</datalist>
        <button className="button button-primary" type="submit">Lọc</button>
      </form>
      <p className="form-message" role="note">{disclaimer}</p>
      {loadState === 'loading' && <p className="workspace-state" role="status" aria-busy="true">Đang tìm trường theo ngành, tổ hợp và dữ liệu đã có nguồn…</p>}
      {loadState === 'error' && <p className="form-message is-error" role="alert">Chưa tải được danh sách trường. <button className="text-link" type="button" onClick={() => void search()}>Thử lại</button></p>}
      <ul className="workspace-list" aria-busy={loadState === 'loading'}>
        {items.map((item) => (
          <li className="workspace-list-item" key={item.institutionMajorId}>
            <div>
              <strong>{item.institutionName}</strong>
              <small>{item.majorName} · {item.province} · tổ hợp {item.allowedBlocks.join(', ') || 'chưa gắn'}</small>
              <small>{item.cutoff === null ? 'Chưa có điểm chuẩn kèm nguồn' : `Điểm chuẩn ${item.cutoff} (${item.matchedBlock ?? ''})`}{item.gap !== null ? ` · lệch ${item.gap}` : ''}</small>
              {item.matchReasons?.map((reason) => <small key={reason}>{reason}</small>)}
              {item.missingSubjects && item.missingSubjects.length > 0 && <small>Còn thiếu điểm: {item.missingSubjects.join(', ')}</small>}
            </div>
            <button className="ws-btn ws-btn-quiet" type="button" onClick={() => void apiRequest<Detail>(`/api/v1/institutions/${item.institutionId}`).then(setDetail)}>Chi tiết</button>
            <button className="ws-btn ws-btn-quiet" type="button" onClick={() => setCompare((current) => current.find((row) => row.institutionMajorId === item.institutionMajorId) ? current : [...current, item].slice(0, 3))}>So sánh</button>
            <button className="ws-btn ws-btn-primary" type="button" onClick={() => void bookmark(item)}>Lưu</button>
          </li>
        ))}
      </ul>
      {detail && (
        <div className="detail-sheet-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
          <section className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="school-detail-title">
            <div className="detail-sheet-head">
              <div><p className="eyebrow">Chi tiết trường</p><h2 id="school-detail-title">{detail.name}</h2></div>
              <button ref={detailCloseRef} className="ws-btn ws-btn-quiet" type="button" aria-label="Đóng chi tiết trường" onClick={() => setDetail(null)}>Đóng</button>
            </div>
            <p>{detail.description || 'Chưa có mô tả chính thức.'}</p>
            {detail.website && <p><a href={detail.website} rel="noreferrer">Mở website chính thức</a></p>}
            {detail.programs.map((program) => (
              <article className="detail-program" key={program.institutionMajorId}><h3>{program.majorName}</h3><p>{program.admissionScores.map((score) => `${score.year} ${score.examBlock ?? ''} ${score.score}`).join('; ') || 'Chưa có điểm chuẩn có nguồn.'}</p></article>
            ))}
          </section>
        </div>
      )}
      {compare.length > 1 && (
        <section className="workspace-feature">
          <h2>So sánh nhanh</h2>
          {compare.map((item) => <p key={item.institutionMajorId}>{item.institutionName} · {item.majorName} · {item.cutoff ?? '—'}</p>)}
        </section>
      )}
    </>
  );
}
