import { FormEvent, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { FormField, SelectInput } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type ClassOption, type PersonOption, type SubjectOption } from '../lib/catalog.js';
import { useSession } from '../lib/SessionContext.js';
import { createIdempotentAction } from '../lib/idempotent-action.js';

export function ClassesPage() {
  const { user } = useSession();
  const owner = user.role === 'SCHOOL_OWNER';
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const teachers = useCatalog<PersonOption>(owner ? '/api/v1/teachers' : null);
  const subjects = useCatalog<SubjectOption>(owner ? '/api/v1/subjects' : null);
  const students = useCatalog<PersonOption>('/api/v1/students');
  const [classMessage, setClassMessage] = useState('');
  const [assignMessage, setAssignMessage] = useState('');
  const [enrollMessage, setEnrollMessage] = useState('');
  const [sending, setSending] = useState<'class' | 'assign' | 'enroll' | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const classAction = useRef(createIdempotentAction('class-create', newIdempotencyKey)).current;
  const assignAction = useRef(createIdempotentAction('class-teacher-assign', newIdempotencyKey)).current;
  const enrollAction = useRef(createIdempotentAction('class-enroll', newIdempotencyKey)).current;

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = { code: String(form.get('code') ?? ''), name: String(form.get('name') ?? ''), gradeLevel: Number(form.get('gradeLevel') ?? 12), schoolYear: String(form.get('schoolYear') ?? '') };
    const ticket = classAction.begin(input);
    if (!ticket) return;
    setSending('class'); setClassMessage('');
    try {
      const created = await apiRequest<{ code: string }>('/api/v1/classes', {
        method: 'POST',
        idempotencyKey: ticket.key,
        body: input,
      });
      setClassMessage(`Đã tạo lớp ${created.code}.`);
      formElement.reset();
      classAction.end(input, true);
      void classes.reload().catch(() => setClassMessage('Đã tạo lớp nhưng chưa làm mới được danh sách.'));
    } catch (error) {
      classAction.end(input, false);
      setClassMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tạo lớp. Vui lòng thử lại.');
    } finally {
      setSending(null);
    }
  }

  async function assignTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const classId = String(form.get('classId') ?? '');
    const role = String(form.get('role') ?? 'HOMEROOM_TEACHER');
    const subjectId = String(form.get('subjectId') ?? '').trim();
    const input = { teacherId: String(form.get('teacherId') ?? ''), subjectId: role === 'SUBJECT_TEACHER' ? subjectId : null, role };
    const ticket = assignAction.begin({ classId, ...input });
    if (!ticket) return;
    setSending('assign'); setAssignMessage('');
    try {
      await apiRequest(`/api/v1/classes/${classId}/teachers`, {
        method: 'POST',
        idempotencyKey: ticket.key,
        body: { classId, ...input },
      });
      setAssignMessage('Đã phân công giáo viên.');
      formElement.reset();
      assignAction.end({ classId, ...input }, true);
      void Promise.all([teachers.reload(), subjects.reload()]).catch(() => setAssignMessage('Đã phân công giáo viên nhưng chưa làm mới được danh sách.'));
    } catch (error) {
      assignAction.end({ classId, ...input }, false);
      setAssignMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể phân công giáo viên. Vui lòng thử lại.');
    } finally {
      setSending(null);
    }
  }

  async function enrollStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const classId = String(form.get('enrollClassId') ?? '');
    const input = { classId, studentId: String(form.get('studentId') ?? '') };
    const ticket = enrollAction.begin(input);
    if (!ticket) return;
    setSending('enroll'); setEnrollMessage('');
    try {
      await apiRequest(`/api/v1/classes/${classId}/students`, {
        method: 'POST',
        idempotencyKey: ticket.key,
        body: { studentId: input.studentId },
      });
      setEnrollMessage('Đã ghi danh học sinh vào lớp.');
      formElement.reset();
      enrollAction.end(input, true);
      void students.reload().catch(() => setEnrollMessage('Đã ghi danh học sinh nhưng chưa làm mới được danh sách.'));
    } catch (error) {
      enrollAction.end(input, false);
      setEnrollMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể ghi danh học sinh.');
    } finally {
      setSending(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={owner ? 'Giáo viên & lớp' : 'Lớp phụ trách'}
        title={owner ? 'Quản lý lớp học' : 'Ghi danh lớp'}
        lede={owner ? 'Tạo lớp, phân công giáo viên và ghi danh học sinh.' : 'Ghi danh học sinh vào lớp bạn được phân công.'}
      />

      {classes.items.length === 0 ? <EmptyState>Chưa có lớp nào.</EmptyState> : (
        <div className="mb-6">
          <DataTable headers={['Mã', 'Tên lớp', 'Khối', 'Năm học']}>
            {classes.items.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td><b>{item.name}</b></td>
                <td>{item.gradeLevel ?? '—'}</td>
                <td>{item.schoolYear}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {owner ? (
        <div className="wizard-container">
          <nav className="wizard-steps" aria-label="Các bước quản lý lớp học">
            <button
              type="button"
              className={`wizard-step-btn ${step === 1 ? 'is-active' : step > 1 ? 'is-completed' : ''}`}
              onClick={() => setStep(1)}
              aria-current={step === 1 ? 'step' : undefined}
            >
              <span className="wizard-step-badge">{step > 1 ? <Check size={14} aria-hidden="true" /> : '1'}</span>
              <span>1. Tạo lớp mới</span>
            </button>
            <div className="wizard-step-connector" aria-hidden="true" />
            <button
              type="button"
              className={`wizard-step-btn ${step === 2 ? 'is-active' : step > 2 ? 'is-completed' : ''}`}
              onClick={() => setStep(2)}
              aria-current={step === 2 ? 'step' : undefined}
            >
              <span className="wizard-step-badge">{step > 2 ? <Check size={14} aria-hidden="true" /> : '2'}</span>
              <span>2. Phân công giáo viên</span>
            </button>
            <div className="wizard-step-connector" aria-hidden="true" />
            <button
              type="button"
              className={`wizard-step-btn ${step === 3 ? 'is-active' : ''}`}
              onClick={() => setStep(3)}
              aria-current={step === 3 ? 'step' : undefined}
            >
              <span className="wizard-step-badge">3</span>
              <span>3. Ghi danh học sinh</span>
            </button>
          </nav>

          {step === 1 && (
            <article className="wizard-panel">
              <h2>Bước 1: Tạo lớp mới</h2>
              <form className="login-form" onSubmit={(event) => void createClass(event)}>
                <label htmlFor="code">Mã lớp</label>
                <input id="code" name="code" required minLength={2} maxLength={64} placeholder="12A2" />
                <label htmlFor="name">Tên lớp</label>
                <input id="name" name="name" required minLength={2} maxLength={120} placeholder="Lớp 12A2" />
                <label htmlFor="gradeLevel">Khối</label>
                <input id="gradeLevel" name="gradeLevel" type="number" min={10} max={12} defaultValue={12} required />
                <label htmlFor="schoolYear">Năm học</label>
                <input id="schoolYear" name="schoolYear" required minLength={4} maxLength={24} placeholder="2026-2027" />
                <div className="wizard-footer">
                  <button className="button button-primary" type="submit" disabled={sending === 'class'}>
                    {sending === 'class' ? 'Đang tạo…' : 'Tạo lớp'}
                  </button>
                  <button type="button" className="button button-quiet" onClick={() => setStep(2)}>
                    Sang bước 2: Phân công GV <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
                {classMessage && <p className={`form-message ${classMessage.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{classMessage}</p>}
              </form>
            </article>
          )}

          {step === 2 && (
            <article className="wizard-panel">
              <h2>Bước 2: Phân công giáo viên</h2>
              <form className="login-form" onSubmit={(event) => void assignTeacher(event)}>
                <label htmlFor="classId">Lớp học</label>
                <select id="classId" name="classId" required>
                  <option value="">Chọn lớp</option>
                  {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
                </select>
                <label htmlFor="teacherId">Giáo viên</label>
                <select id="teacherId" name="teacherId" required>
                  <option value="">Chọn giáo viên</option>
                  {teachers.items.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.email}</option>)}
                </select>
                <label htmlFor="role">Vai trò</label>
                <select id="role" name="role" defaultValue="HOMEROOM_TEACHER">
                  <option value="HOMEROOM_TEACHER">Giáo viên chủ nhiệm</option>
                  <option value="SUBJECT_TEACHER">Giáo viên bộ môn</option>
                </select>
                <label htmlFor="subjectId">Môn học (chỉ chọn cho giáo viên bộ môn)</label>
                <select id="subjectId" name="subjectId">
                  <option value="">Không chọn môn</option>
                  {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
                </select>
                <div className="wizard-footer">
                  <button type="button" className="button button-quiet" onClick={() => setStep(1)}>
                    <ArrowLeft size={16} aria-hidden="true" /> Quay lại bước 1
                  </button>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="button button-primary" type="submit" disabled={sending === 'assign'}>
                      {sending === 'assign' ? 'Đang phân công…' : 'Phân công'}
                    </button>
                    <button type="button" className="button button-quiet" onClick={() => setStep(3)}>
                      Sang bước 3: Ghi danh <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {assignMessage && <p className={`form-message ${assignMessage.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{assignMessage}</p>}
              </form>
            </article>
          )}

          {step === 3 && (
            <article className="wizard-panel">
              <h2>Bước 3: Ghi danh học sinh</h2>
              <form className="login-form" onSubmit={(event) => void enrollStudent(event)}>
                <FormField id="enrollClassId" label="Lớp học">
                  <SelectInput id="enrollClassId" name="enrollClassId" required>
                    <option value="">Chọn lớp</option>
                    {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
                  </SelectInput>
                </FormField>
                <FormField id="studentId" label="Học sinh">
                  <SelectInput id="studentId" name="studentId" required>
                    <option value="">Chọn học sinh</option>
                    {students.items.map((item) => <option key={item.id} value={item.id}>{item.displayName}{item.studentCode ? ` · ${item.studentCode}` : ''} · {item.email}</option>)}
                  </SelectInput>
                </FormField>
                <div className="wizard-footer">
                  <button type="button" className="button button-quiet" onClick={() => setStep(2)}>
                    <ArrowLeft size={16} aria-hidden="true" /> Quay lại bước 2
                  </button>
                  <button className="button button-primary" type="submit" disabled={sending === 'enroll'}>
                    {sending === 'enroll' ? 'Đang ghi danh…' : 'Ghi danh'}
                  </button>
                </div>
                {enrollMessage && <p className={`form-message ${enrollMessage.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{enrollMessage}</p>}
              </form>
            </article>
          )}
        </div>
      ) : (
        <article className="wizard-panel mt-6">
          <h2>Ghi danh học sinh vào lớp</h2>
          <form className="login-form" onSubmit={(event) => void enrollStudent(event)}>
            <FormField id="enrollClassId" label="Lớp học">
              <SelectInput id="enrollClassId" name="enrollClassId" required>
                <option value="">Chọn lớp</option>
                {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}
              </SelectInput>
            </FormField>
            <FormField id="studentId" label="Học sinh">
              <SelectInput id="studentId" name="studentId" required>
                <option value="">Chọn học sinh</option>
                {students.items.map((item) => <option key={item.id} value={item.id}>{item.displayName}{item.studentCode ? ` · ${item.studentCode}` : ''} · {item.email}</option>)}
              </SelectInput>
            </FormField>
            <button className="button button-primary" type="submit" disabled={sending === 'enroll'}>{sending === 'enroll' ? 'Đang ghi danh…' : 'Ghi danh'}</button>
            {enrollMessage && <p className={`form-message ${enrollMessage.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{enrollMessage}</p>}
          </form>
        </article>
      )}
    </>
  );
}
