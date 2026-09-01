import { useCallback, useEffect, useState } from 'react';
import { Pagination } from '../components/Pagination.js';
import { apiRequest, ApiRequestError, downloadFile, triggerDownload } from '../lib/api.js';

interface SchoolSummary {
  id: string;
  code: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  activeUserCount: number;
  createdAt: string;
}

interface SchoolDetail extends SchoolSummary {
  classCount: number;
}

interface SchoolPage {
  items: SchoolSummary[];
  totalItems: number;
  totalPages: number;
}

export function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<SchoolDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const load = useCallback(async (requestedPage: number) => {
    setState('loading');
    setMessage('');
    try {
      const data = await apiRequest<SchoolPage>('/api/v1/admin/schools', { query: { page: String(requestedPage), pageSize: '50' } });
      setSchools(data.items);
      setTotal(data.totalItems);
      setPage(requestedPage);
      setTotalPages(data.totalPages);
      setState('ready');
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải danh sách trường.');
    }
  }, []);

  async function viewSchool(school: SchoolSummary) {
    setDetailState('loading');
    setSelected(null);
    try {
      const detail = await apiRequest<SchoolDetail>(`/api/v1/admin/schools/${school.id}`);
      setSelected(detail);
      setDetailState('idle');
    } catch (error) {
      setDetailState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải chi tiết trường.');
    }
  }

  async function downloadSchools() {
    setMessage('');
    try { triggerDownload(await downloadFile('/api/v1/admin/schools/export.csv')); }
    catch (error) { setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải danh sách trường.'); }
  }

  useEffect(() => { void load(1); }, [load]);

  return <>
    <p className="eyebrow">Điều hành nền tảng</p>
    <h1>Danh sách trường</h1>
    <p className="page-lede">Theo dõi thông tin vận hành cơ bản của từng trường pilot mà không truy cập dữ liệu học tập riêng tư.</p>
    {state === 'loading' && <p className="workspace-state" role="status">Đang tải danh sách trường…</p>}
    {state === 'error' && <p className="workspace-state is-error" role="alert">{message} <button type="button" onClick={() => void load(page)}>Thử lại</button></p>}
    {state === 'ready' && schools.length === 0 && <p className="workspace-state">Chưa có trường nào được duyệt.</p>}
    {state === 'ready' && schools.length > 0 && <div className="data-table-wrap" aria-label={`Có ${total} trường`}>
      <table>
        <thead><tr><th scope="col">Trường</th><th scope="col">Hiệu trưởng</th><th scope="col">Người dùng hoạt động</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{schools.map((school) => <tr key={school.id}>
          <td><strong>{school.name}</strong><small>Mã trường: {school.code}</small></td>
          <td>{school.ownerName ?? 'Chưa có'}{school.ownerEmail && <small>{school.ownerEmail}</small>}</td>
          <td>{school.activeUserCount}</td>
          <td><button className="button button-quiet" type="button" onClick={() => void viewSchool(school)} disabled={detailState === 'loading'}>Xem chi tiết</button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {state === 'ready' && <Pagination page={page} totalPages={totalPages} totalItems={total} onChange={(nextPage) => void load(nextPage)} />}
    {detailState === 'loading' && <p className="workspace-state" role="status">Đang tải chi tiết trường…</p>}
    {detailState === 'error' && <p className="workspace-state is-error" role="alert">{message}</p>}
    {selected && <article className="workspace-feature" aria-labelledby="school-detail-title">
      <p className="eyebrow">Thông tin trường</p>
      <h2 id="school-detail-title">{selected.name}</h2>
      <dl className="detail-list">
        <div><dt>Mã trường</dt><dd>{selected.code}</dd></div>
        <div><dt>Hiệu trưởng</dt><dd>{selected.ownerName ?? 'Chưa có'}</dd></div>
        <div><dt>Email liên hệ</dt><dd>{selected.ownerEmail ?? 'Chưa có'}</dd></div>
        <div><dt>Người dùng hoạt động</dt><dd>{selected.activeUserCount}</dd></div>
        <div><dt>Lớp học</dt><dd>{selected.classCount}</dd></div>
      </dl>
    </article>}
    <p className="workspace-state">Danh sách này không hiển thị bài làm, đáp án hoặc nội dung học tập của trường.</p>
    <button className="button button-primary" type="button" onClick={() => void downloadSchools()} disabled={state === 'loading'}>Tải danh sách trường</button>
  </>;
}
