import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { DataTable } from '../components/ui/DataTable.js';
import { Dialog } from '../components/ui/Dialog.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FilterBar } from '../components/ui/FilterBar.js';
import { FormField, SelectInput, TextArea, TextInput } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type ClassOption, type PersonOption, type SubjectOption } from '../lib/catalog.js';

interface GradebookEntry {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  subjectId: string;
  subjectName?: string;
  assignmentId: string | null;
  assignmentTitle: string | null;
  score: number;
  maxScore: number;
  source: string;
  recordedAt: string;
  attemptCount: number;
  hasLateAttempt: boolean;
}

function sourceLabel(source: string): string {
  return source === 'OVERRIDE' ? 'Điểm đã điều chỉnh' : source === 'AUTO' ? 'Tự chấm' : 'Đã chấm';
}

export function GradebookPage() {
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const subjects = useCatalog<SubjectOption>('/api/v1/subjects');
  const students = useCatalog<PersonOption>('/api/v1/students');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [active, setActive] = useState<GradebookEntry | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId && classes.items[0]) setClassId(classes.items[0].id);
  }, [classId, classes.items]);

  const query = useQuery({
    queryKey: ['gradebook', classId, subjectId, studentId],
    queryFn: () => apiRequest<GradebookEntry[]>('/api/v1/gradebook', { query: { classId, subjectId: subjectId || undefined, studentId: studentId || undefined } }),
    enabled: Boolean(classId),
  });

  const getSubjectName = (sId: string, directName?: string) =>
    subjects.items.find((s) => s.id === sId)?.name ?? directName ?? sId;

  async function overrideEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setMessage('');
    try {
      await apiRequest(`/api/v1/gradebook/${active.id}/override`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('gradebook-override'),
        body: { score: Number(form.get('score')), reason: String(form.get('reason') ?? '') },
      });
      setMessage(`Đã điều chỉnh điểm của ${active.studentName}; lý do được lưu trong lịch sử sổ điểm.`);
      setActive(null);
      await query.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể điều chỉnh điểm.');
    } finally {
      setSaving(false);
    }
  }

  const entries = query.data ?? [];

  return (
    <>
      <PageHeader eyebrow="Sổ điểm" title="Tra cứu điểm theo lớp" lede="Danh sách dòng điểm (tối đa 500). Điều chỉnh điểm trong hộp thoại, kèm lý do." />
      {message && <p className={`form-message ${message.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{message}</p>}
      <FilterBar>
        <FormField id="gClassId" label="Lớp học">
          <SelectInput id="gClassId" value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Chọn lớp</option>
            {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
          </SelectInput>
        </FormField>
        <FormField id="gSubjectId" label="Môn học">
          <SelectInput id="gSubjectId" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">Tất cả môn học</option>
            {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField id="gStudentId" label="Học sinh">
          <SelectInput id="gStudentId" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            <option value="">Tất cả học sinh</option>
            {students.items.map((item) => <option key={item.id} value={item.id}>{item.displayName}{item.studentCode ? ` · ${item.studentCode}` : ''}</option>)}
          </SelectInput>
        </FormField>
      </FilterBar>
      {query.isPending && classId && <EmptyState>Đang tải sổ điểm…</EmptyState>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>Chưa thể tải sổ điểm.</ErrorState>}
      {classId && query.isSuccess && entries.length === 0 && <EmptyState>Chưa có dòng điểm cho phạm vi đã chọn.</EmptyState>}

      {entries.length > 0 && (
        <>
          <section className="grade-chart-panel" aria-label="Biểu đồ phân bố điểm theo môn">
            <h2>Tổng quan điểm số theo môn</h2>
            <div className="grade-chart-bars">
              {Array.from(new Set(entries.map((e) => e.subjectId))).map((sId) => {
                const sEntries = entries.filter((e) => e.subjectId === sId);
                const avgPct = sEntries.reduce((acc, curr) => acc + (curr.score / curr.maxScore), 0) / sEntries.length;
                const avg10 = (avgPct * 10).toFixed(1);
                const sName = getSubjectName(sId, sEntries[0]?.subjectName);
                return (
                  <div key={sId} className="grade-chart-item">
                    <span className="grade-chart-label" title={sName}>{sName}</span>
                    <div className="grade-chart-track" role="progressbar" aria-valuenow={Math.round(avgPct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Điểm trung bình môn ${sName}`}>
                      <div className="grade-chart-fill" style={{ width: `${Math.round(avgPct * 100)}%` }} />
                    </div>
                    <span className="grade-chart-val">{avg10}/10</span>
                  </div>
                );
              })}
            </div>
          </section>

          <DataTable headers={['Học sinh', 'Môn', 'Bài tập', 'Điểm', 'Nguồn', '']}>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td><b>{entry.studentName}</b><small>{entry.studentCode}</small></td>
                <td>{getSubjectName(entry.subjectId, entry.subjectName)}</td>
                <td>{entry.assignmentTitle ?? 'Điểm tổng hợp'}{entry.hasLateAttempt ? ' · Có nộp trễ' : ''}</td>
                <td>{entry.score}/{entry.maxScore}</td>
                <td><StatusBadge tone={entry.source === 'OVERRIDE' ? 'pending' : 'approved'}>{sourceLabel(entry.source)}</StatusBadge></td>
                <td><button className="ws-btn ws-btn-quiet" type="button" onClick={() => setActive(entry)}>Điều chỉnh</button></td>
              </tr>
            ))}
          </DataTable>
        </>
      )}

      {active && (
        <Dialog titleId="override-title" title={`Điều chỉnh điểm · ${active.studentName}`} onClose={() => setActive(null)}>
          <form className="login-form" onSubmit={(event) => void overrideEntry(event)}>
            <FormField id="override-score" label={`Điểm mới (tối đa ${active.maxScore})`}>
              <TextInput id="override-score" name="score" type="number" min={0} max={active.maxScore} step={0.1} defaultValue={active.score} required />
            </FormField>
            <FormField id="override-reason" label="Lý do điều chỉnh">
              <TextArea id="override-reason" name="reason" minLength={8} maxLength={2000} rows={3} required />
            </FormField>
            <button className="ws-btn ws-btn-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu điều chỉnh'}</button>
          </form>
        </Dialog>
      )}
    </>
  );
}
