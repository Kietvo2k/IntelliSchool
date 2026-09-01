import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FilterBar } from '../components/ui/FilterBar.js';
import { FormField, SelectInput } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { apiRequest, apiUrl, ApiRequestError, downloadFile, ensureApiBase, newIdempotencyKey, triggerDownload } from '../lib/api.js';
import { useCatalog, type ClassOption, type SubjectOption } from '../lib/catalog.js';
import { useSession } from '../lib/SessionContext.js';
import type { ResourceOption, ResourceStatus } from '../lib/lms.js';

interface PaginatedResources { items: ResourceOption[]; page: number; pageSize: number; totalItems: number; totalPages: number; }

function statusLabel(status: ResourceStatus): string {
  if (status === 'READY') return 'Sẵn sàng';
  if (status === 'REJECTED') return 'Bị từ chối';
  if (status === 'PROCESSING') return 'Đang quét';
  return 'Đang chờ quét';
}

function formatBytes(bytes: number): string {
  return bytes < 1_024 ? `${bytes} B` : `${(bytes / 1_024 / 1_024).toFixed(1)} MB`;
}

export function ResourcesPage() {
  const { user } = useSession();
  const canUpload = user.role === 'SCHOOL_OWNER' || user.role === 'TEACHER';
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const subjects = useCatalog<SubjectOption>(canUpload ? '/api/v1/subjects' : null);
  const [classId, setClassId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!classId && classes.items[0]) setClassId(classes.items[0].id);
  }, [classId, classes.items]);

  const query = useQuery({
    queryKey: ['resources', classId],
    queryFn: () => apiRequest<PaginatedResources>('/api/v1/resources', { query: { page: '1', pageSize: '20', classId: classId || undefined } }),
    refetchInterval: (current) => current.state.data?.items.some((item) => item.status === 'QUARANTINED' || item.status === 'PROCESSING') ? 5_000 : false,
  });

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) { setMessage('Hãy chọn một tệp trước khi tải lên.'); return; }
    setSending(true); setMessage('');
    try {
      await ensureApiBase();
      const xhr = new XMLHttpRequest();
      setProgress(0);
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (uploadEvent) => { if (uploadEvent.lengthComputable) setProgress(Math.round(uploadEvent.loaded / uploadEvent.total * 100)); };
        xhr.onload = () => {
          const payload = (() => { try { return JSON.parse(xhr.responseText) as { error?: { message?: string } }; } catch { return null; } })();
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(payload?.error?.message ?? 'Chưa thể tải tài nguyên lên.'));
        };
        xhr.onerror = () => reject(new Error('Chưa thể tải tài nguyên lên.'));
        xhr.open('POST', apiUrl('/api/v1/resources'));
        xhr.withCredentials = true;
        xhr.setRequestHeader('x-idempotency-key', newIdempotencyKey('resource-upload'));
        xhr.send(form);
      });
      formElement.reset();
      setMessage('Đã tải tệp lên khu vực cách ly. Tệp sẽ chỉ tải được sau khi quét sạch. Trạng thái READY nghĩa là ClamAV đã duyệt.');
      await query.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chưa thể tải tài nguyên lên.');
    } finally {
      setSending(false);
      setProgress(null);
    }
  }

  async function download(resource: ResourceOption) {
    try {
      triggerDownload(await downloadFile(`/api/v1/resources/${resource.id}/download`));
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tạo liên kết tải xuống.');
    }
  }

  async function requestContribution(resource: ResourceOption) {
    try {
      await apiRequest(`/api/v1/resources/${resource.id}/contribution`, { method: 'POST', idempotencyKey: newIdempotencyKey('library-contribution') });
      setMessage('Đã gửi tài liệu cho nhà trường duyệt đóng góp.');
      await query.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa gửi được yêu cầu đóng góp.');
    }
  }

  async function reviewContribution(resource: ResourceOption, decision: 'APPROVED' | 'REJECTED') {
    try {
      await apiRequest(`/api/v1/resources/${resource.id}/contribution/review`, { method: 'POST', idempotencyKey: newIdempotencyKey('library-review'), body: { decision, scope: 'SCHOOL' } });
      setMessage(decision === 'APPROVED' ? 'Đã đưa tài liệu vào Thư viện số của trường.' : 'Đã từ chối tài liệu đóng góp.');
      await query.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa cập nhật được trạng thái duyệt.');
    }
  }

  const items = query.data?.items ?? [];
  return (
    <>
      <PageHeader eyebrow="Thư viện số" title="Thư viện số" lede="Tài liệu đã duyệt của trường và tài liệu riêng của em. Tệp mới được cách ly và quét trước khi kiểm duyệt, rồi mới chia sẻ." />
      {message && <p className={`form-message ${message.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{message}</p>}
      <FilterBar>
        <FormField id="resourceClassFilter" label="Lọc theo lớp">
          <SelectInput id="resourceClassFilter" value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Tất cả lớp có quyền truy cập</option>
            {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
          </SelectInput>
        </FormField>
      </FilterBar>
      {canUpload && (
        <section className="workspace-feature mb-6">
          <p>Tải tệp an toàn</p>
          <h2>Tải tài liệu lên</h2>
          <form className="login-form" onSubmit={(event) => void upload(event)}>
            <label htmlFor="resourceClassId">Lớp học</label>
            <select id="resourceClassId" name="classId" required><option value="">Chọn lớp</option>{classes.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <label htmlFor="resourceSubjectId">Môn học</label>
            <select id="resourceSubjectId" name="subjectId" required><option value="">Chọn môn học</option>{subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <label htmlFor="resourceFile">Tệp (tối đa 200 MB, Word/PDF/video)</label>
            <div
              className={`dropzone ${dragging ? 'is-dragging' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const input = document.getElementById('resourceFile') as HTMLInputElement | null;
                if (input && event.dataTransfer.files[0]) {
                  const transfer = new DataTransfer();
                  transfer.items.add(event.dataTransfer.files[0]);
                  input.files = transfer.files;
                }
              }}
            >
              <input id="resourceFile" name="file" type="file" required accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.mp4" />
              <p>Kéo thả tệp vào đây hoặc chọn từ máy.</p>
            </div>
            {progress !== null && <p role="status">Tiến trình tải: {progress}%</p>}
            <p className="muted-copy">Chấp nhận PDF, DOCX, PPTX, XLSX, TXT, PNG, JPEG và MP4. Badge READY = ClamAV đã duyệt.</p>
            <button className="button button-primary" type="submit" disabled={sending}>{sending ? 'Đang tải lên…' : 'Tải tệp lên để quét'}</button>
          </form>
        </section>
      )}
      {query.isPending && <EmptyState>Đang tải tài nguyên…</EmptyState>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>Chưa thể tải danh sách tài nguyên.</ErrorState>}
      {query.isSuccess && items.length === 0 && <EmptyState>Chưa có tài nguyên phù hợp.</EmptyState>}
      {items.length > 0 && (
        <DataTable headers={['Tên tệp', 'Loại', 'Kích thước', 'Trạng thái', '']}>
          {items.map((resource) => (
            <tr key={resource.id}>
              <td><b>{resource.originalName}</b></td>
              <td>{resource.mimeType}</td>
              <td>{formatBytes(resource.byteSize)}</td>
              <td><StatusBadge tone={resource.status.toLowerCase()}>{statusLabel(resource.status)}</StatusBadge></td>
              <td>
                {resource.status === 'READY'
                  ? <button className="ws-btn ws-btn-quiet" type="button" onClick={() => void download(resource)}>Tải xuống</button>
                  : <small>{resource.status === 'REJECTED' ? 'Tệp đã bị chặn và không thể tải xuống.' : 'Tệp chưa thể tải xuống cho đến khi quét hoàn tất.'}</small>}
                {user.role === 'STUDENT' && resource.visibility === 'PRIVATE' && resource.contributionStatus === 'NONE' && <button className="ws-btn ws-btn-quiet" type="button" onClick={() => void requestContribution(resource)}>Gửi đóng góp</button>}
                {user.role === 'STUDENT' && resource.contributionStatus === 'PENDING' && <small>Đang chờ nhà trường duyệt đóng góp.</small>}
                {(user.role === 'TEACHER' || user.role === 'SCHOOL_OWNER') && resource.contributionStatus === 'PENDING' && <><button className="ws-btn ws-btn-primary" type="button" onClick={() => void reviewContribution(resource, 'APPROVED')}>Duyệt vào thư viện</button><button className="ws-btn ws-btn-quiet" type="button" onClick={() => void reviewContribution(resource, 'REJECTED')}>Từ chối</button></>}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
