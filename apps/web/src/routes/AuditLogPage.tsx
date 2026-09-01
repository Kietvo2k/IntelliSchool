import { useEffect, useState } from 'react';
import { Pagination } from '../components/Pagination.js';
import { apiRequest, ApiRequestError } from '../lib/api.js';

interface AuditEventView {
  id: string;
  action: string;
  targetType: string;
  actorDisplayName: string;
  actorEmail: string;
  schoolName: string | null;
  createdAt: string;
}
interface AuditPage { items: AuditEventView[]; totalItems: number; totalPages: number; }
interface AdminActorView { id: string; displayName: string; email: string; }
interface AdminSchoolView { id: string; name: string; code: string; }
interface PaginatedView<T> { items: T[]; }

function displayAction(action: string): string { return action.replaceAll('_', ' '); }
function asIso(value: string): string | undefined { return value ? new Date(value).toISOString() : undefined; }

export function AuditLogPage() {
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actors, setActors] = useState<AdminActorView[]>([]);
  const [schools, setSchools] = useState<AdminSchoolView[]>([]);
  const [events, setEvents] = useState<AuditEventView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');

  async function load(requestedPage = page) {
    setState('loading'); setMessage('');
    try {
      const data = await apiRequest<AuditPage>('/api/v1/admin/audit-events', { query: { page: String(requestedPage), pageSize: '50', actorId: actorId || undefined, action: action || undefined, schoolId: schoolId || undefined, from: asIso(from), to: asIso(to) } });
      setEvents(data.items); setTotal(data.totalItems); setPage(requestedPage); setTotalPages(data.totalPages); setState('ready');
    } catch (error) {
      setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải nhật ký bảo mật.');
    }
  }

  useEffect(() => {
    void apiRequest<AuditPage>('/api/v1/admin/audit-events', { query: { page: '1', pageSize: '50' } })
      .then((data) => {
        setEvents(data.items);
        setTotal(data.totalItems);
        setPage(1);
        setTotalPages(data.totalPages);
        setState('ready');
      })
      .catch((error) => {
        setState('error');
        setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải nhật ký bảo mật.');
      });
    void Promise.all([
      apiRequest<PaginatedView<AdminActorView>>('/api/v1/admin/users', { query: { page: '1', pageSize: '100' } }),
      apiRequest<PaginatedView<AdminSchoolView>>('/api/v1/admin/schools', { query: { page: '1', pageSize: '100' } }),
    ]).then(([users, schoolPage]) => { setActors(users.items); setSchools(schoolPage.items); }).catch(() => undefined);
  }, []);

  return <>
    <p className="eyebrow">Điều hành nền tảng</p>
    <h1>Nhật ký bảo mật</h1>
    <p className="page-lede">Theo dõi các thao tác quan trọng, người thực hiện và không gian bị tác động.</p>
    <form className="admin-filter" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
      <label htmlFor="audit-action">Lọc theo hành động</label>
      <input id="audit-action" value={action} onChange={(event) => setAction(event.target.value.toUpperCase())} placeholder="Ví dụ: ADMIN_USER_DEACTIVATED" maxLength={120} />
      <label htmlFor="audit-actor">Người thực hiện</label>
      <select id="audit-actor" value={actorId} onChange={(event) => setActorId(event.target.value)}><option value="">Tất cả người dùng</option>{actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.displayName} · {actor.email}</option>)}</select>
      <label htmlFor="audit-school">Trường</label>
      <select id="audit-school" value={schoolId} onChange={(event) => setSchoolId(event.target.value)}><option value="">Nền tảng và mọi trường</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.code}</option>)}</select>
      <label htmlFor="audit-from">Từ thời điểm</label>
      <input id="audit-from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
      <label htmlFor="audit-to">Đến thời điểm</label>
      <input id="audit-to" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
      <button className="button button-primary" type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'Đang tải…' : 'Lọc nhật ký'}</button>
    </form>
    {state === 'loading' && <p className="workspace-state" aria-busy="true">Đang tải nhật ký bảo mật…</p>}
    {state === 'error' && <p className="workspace-state is-error" role="alert">{message} <button type="button" onClick={() => void load()}>Thử lại</button></p>}
    {state === 'ready' && events.length === 0 && <p className="workspace-state">Chưa có sự kiện phù hợp.</p>}
    {state === 'ready' && events.length > 0 && <div className="data-table-wrap" aria-label={`Có ${total} sự kiện audit`}>
      <table><thead><tr><th scope="col">Thời điểm</th><th scope="col">Hành động</th><th scope="col">Người thực hiện</th><th scope="col">Phạm vi</th></tr></thead>
        <tbody>{events.map((event) => <tr key={event.id}>
          <td>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.createdAt))}</td>
          <td><strong>{displayAction(event.action)}</strong><small>{event.targetType}</small></td>
          <td>{event.actorDisplayName}<small>{event.actorEmail}</small></td>
          <td>{event.schoolName ?? 'Nền tảng'}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {state === 'ready' && <Pagination page={page} totalPages={totalPages} totalItems={total} onChange={(nextPage) => void load(nextPage)} />}
  </>;
}
