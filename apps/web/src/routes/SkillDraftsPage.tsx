import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useSession } from '../lib/SessionContext.js';

interface Person { id: string; displayName: string }
interface ClassRow { id: string; name?: string }
interface Suggestion { id: string; studentId: string; studentName?: string; skillCode: string; skillName: string; evidence: string; status: string }

export function SkillDraftsPage() {
  const { user } = useSession();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [studentId, setStudentId] = useState(user.role === 'STUDENT' ? user.userId : '');
  const [message, setMessage] = useState('');
  const classId = user.homeroomClassIds?.[0];

  const reload = useCallback(async () => {
    const data = await apiRequest<Suggestion[]>('/api/v1/skill-suggestions', studentId && user.role !== 'STUDENT' ? { query: { studentId } } : undefined);
    setItems(data ?? []);
  }, [studentId, user.role]);

  useEffect(() => {
    void reload().catch((error) => setMessage(error instanceof ApiRequestError ? error.message : 'Chưa tải được skill nháp.'));
    void (async () => {
      try {
        let rosterClassId = classId;
        if (!rosterClassId && user.role === 'SCHOOL_OWNER') {
          const classes = await apiRequest<ClassRow[]>('/api/v1/classes');
          rosterClassId = classes?.[0]?.id;
        }
        if (rosterClassId) setStudents(await apiRequest<Person[]>('/api/v1/students', { query: { classId: rosterClassId } }) ?? []);
      } catch {
        /* danh sách trống thì người dùng chọn không được — API vẫn chặn */
      }
    })();
  }, [classId, reload, user.role]);

  async function createDraft() {
    setMessage('');
    try {
      await apiRequest('/api/v1/skill-suggestions', { method: 'POST', idempotencyKey: newIdempotencyKey('skill-draft'), body: user.role === 'STUDENT' ? {} : { studentId } });
      setMessage('Đã tạo nháp từ hồ sơ/điểm. Cần giáo viên khác duyệt bốn mắt.');
      await reload();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa tạo được nháp.');
    }
  }

  async function review(id: string, decision: 'APPROVED' | 'REJECTED', reason: string) {
    try {
      await apiRequest(`/api/v1/skill-suggestions/${id}/review`, { method: 'POST', idempotencyKey: newIdempotencyKey('skill-review'), body: { decision, reason } });
      await reload();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa duyệt được.');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Học tập thích ứng" title="Skill nháp" lede="Đề xuất từ knowledge base học sinh và điểm trên lớp. Giáo viên khác duyệt bốn mắt trước khi vào đồ thị." />
      {message && <p className="form-message" role="status">{message}</p>}
      {user.role !== 'STUDENT' && (
        <label htmlFor="skill-student">Học sinh
          <select id="skill-student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            <option value="">Chọn học sinh</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
          </select>
        </label>
      )}
      <button className="button button-primary" type="button" onClick={() => void createDraft()}>Tạo nháp từ hồ sơ</button>
      <ul>
        {items.map((item) => (
          <li key={item.id} className="workspace-feature">
            <p><b>{item.skillName}</b> · {item.status}{item.studentName ? ` · ${item.studentName}` : ''}</p>
            <p>{item.evidence}</p>
            {user.role !== 'STUDENT' && item.status === 'DRAFT' && (
              <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                void review(item.id, 'APPROVED', String(new FormData(event.currentTarget).get('reason') ?? ''));
              }}>
                <label htmlFor={`reason-${item.id}`}>Lý do duyệt</label>
                <input id={`reason-${item.id}`} name="reason" />
                <button className="button button-primary" type="submit">Duyệt</button>
                <button className="button button-quiet" type="button" onClick={(event) => {
                  const form = event.currentTarget.form;
                  const reason = form ? String(new FormData(form).get('reason') ?? '') : '';
                  void review(item.id, 'REJECTED', reason);
                }}>Từ chối</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
