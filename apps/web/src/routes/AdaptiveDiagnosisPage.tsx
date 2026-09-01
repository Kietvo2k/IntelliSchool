import { FormEvent, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type ClassOption, type SubjectOption } from '../lib/catalog.js';

interface AffectedSkill { skillCode: string; skillName: string; incorrectCount: number; totalCount: number; evidenceEventIds: string[]; }
interface DiagnosisStudent {
  studentId: string;
  displayName: string;
  studentCode: string | null;
  status: 'ACTIONABLE' | 'NEEDS_MORE_EVIDENCE' | 'ON_TRACK';
  rootSkillCode: string | null;
  rootSkillName: string | null;
  evidenceEventIds: string[];
  affectedSkills: AffectedSkill[];
  override: { reason: string; decision: string | null; createdAt: string } | null;
}
interface DiagnosisGroup { skillCode: string; skillName: string; studentCount: number; downstreamBlocked: number; priority: number; }
interface DiagnosisResponse {
  graphApproved: boolean;
  subjectId: string;
  generatedAt: string;
  groups: DiagnosisGroup[];
  students: DiagnosisStudent[];
}

const statusLabel: Record<DiagnosisStudent['status'], string> = {
  ACTIONABLE: 'Cần can thiệp',
  NEEDS_MORE_EVIDENCE: 'Chưa đủ bằng chứng',
  ON_TRACK: 'Đang ổn',
};

export function AdaptiveDiagnosisPage() {
  const classes = useCatalog<ClassOption>('/api/v1/classes');
  const subjects = useCatalog<SubjectOption>('/api/v1/subjects');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [data, setData] = useState<DiagnosisResponse | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'sending'>('idle');
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  async function loadDiagnoses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId || !subjectId) { setMessage('Chọn lớp và môn học.'); return; }
    setState('loading');
    setActiveStep(2);
    setMessage('');
    try {
      const result = await apiRequest<DiagnosisResponse>('/api/v1/adaptive/diagnoses', { query: { classId, subjectId } });
      setData(result);
      setState('idle');
      setActiveStep(3);
      if (result && !result.graphApproved) setMessage('Môn học chưa có đồ thị kỹ năng được duyệt nên chỉ hiển thị ở chế độ báo cáo.');
    } catch (error) {
      setState('error');
      setActiveStep(1);
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải chẩn đoán.');
    }
  }

  async function override(student: DiagnosisStudent, decision: 'CONFIRM' | 'DISMISS') {
    const reason = window.prompt(decision === 'CONFIRM' ? 'Xác nhận chẩn đoán — ghi chú:' : 'Bác bỏ chẩn đoán — nêu lý do:');
    if (!reason || reason.trim().length < 3) { setMessage('Cần nêu lý do (tối thiểu 3 ký tự).'); return; }
    setState('sending');
    setMessage('');
    try {
      await apiRequest('/api/v1/adaptive/overrides', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('adaptive-override'),
        body: { studentId: student.studentId, subjectId, decision, reason },
      });
      setState('idle');
      setMessage(decision === 'CONFIRM' ? 'Đã xác nhận chẩn đoán.' : 'Đã bác bỏ chẩn đoán; lộ trình của học sinh sẽ tôn trọng quyết định này.');
      const refreshed = await apiRequest<DiagnosisResponse>('/api/v1/adaptive/diagnoses', { query: { classId, subjectId } });
      setData(refreshed);
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể ghi đè chẩn đoán.');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Học tập thích ứng" title="Lớp học theo nhu cầu" lede="Nhóm học sinh theo lỗ hổng kiến thức gốc, sắp xếp theo mức ảnh hưởng. Mọi kết luận đều mở được bằng chứng và giáo viên có quyền xác nhận hoặc bác bỏ." />
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</p>}

      <div className="wizard-container">
        <nav className="wizard-steps" aria-label="Các bước chẩn đoán thích ứng">
          <button
            type="button"
            className={`wizard-step-btn ${activeStep === 1 ? 'is-active' : activeStep > 1 ? 'is-completed' : ''}`}
            onClick={() => setActiveStep(1)}
            aria-current={activeStep === 1 ? 'step' : undefined}
          >
            <span className="wizard-step-badge">{activeStep > 1 ? <Check size={14} aria-hidden="true" /> : '1'}</span>
            <span>1. Chọn lớp & môn</span>
          </button>
          <div className="wizard-step-connector" aria-hidden="true" />
          <button
            type="button"
            className={`wizard-step-btn ${activeStep === 2 ? 'is-active' : activeStep > 2 ? 'is-completed' : ''}`}
            onClick={() => { if (classId && subjectId) setActiveStep(2); }}
            aria-current={activeStep === 2 ? 'step' : undefined}
          >
            <span className="wizard-step-badge">{activeStep > 2 ? <Check size={14} aria-hidden="true" /> : '2'}</span>
            <span>2. Xem chẩn đoán</span>
          </button>
          <div className="wizard-step-connector" aria-hidden="true" />
          <button
            type="button"
            className={`wizard-step-btn ${activeStep === 3 ? 'is-active' : ''}`}
            disabled={!data}
            onClick={() => { if (data) setActiveStep(3); }}
            aria-current={activeStep === 3 ? 'step' : undefined}
          >
            <span className="wizard-step-badge">3</span>
            <span>3. Kết quả & can thiệp</span>
          </button>
        </nav>

        {activeStep === 1 && (
          <article className="wizard-panel">
            <h2>Bước 1: Chọn phạm vi chẩn đoán</h2>
            <form className="admin-filter" onSubmit={loadDiagnoses}>
              <label htmlFor="diagClass">Lớp
                <select id="diagClass" value={classId} onChange={(event) => setClassId(event.target.value)} required disabled={classes.state === 'loading'}>
                  <option value="">Chọn lớp</option>
                  {classes.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label htmlFor="diagSubject">Môn học
                <select id="diagSubject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required disabled={subjects.state === 'loading'}>
                  <option value="">Chọn môn học</option>
                  {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <div className="wizard-footer w-full">
                <button className="button button-primary" type="submit" disabled={state === 'loading' || !classId || !subjectId}>
                  {state === 'loading' ? 'Đang tải…' : 'Bắt đầu xem chẩn đoán'}
                </button>
              </div>
            </form>
          </article>
        )}

        {activeStep === 2 && state === 'loading' && (
          <article className="wizard-panel">
            <h2>Bước 2: Đang phân tích dữ liệu chẩn đoán…</h2>
            <p className="text-muted">Hệ thống đang tổng hợp dữ liệu làm bài và truy vết lỗ hổng kiến thức gốc cho lớp học.</p>
          </article>
        )}

        {activeStep === 3 && data && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button type="button" className="button button-quiet" onClick={() => setActiveStep(1)}>
                <ArrowLeft size={16} aria-hidden="true" /> Chọn lớp & môn khác
              </button>
            </div>

            <section aria-labelledby="need-groups-title" className="mb-6">
              <h2 id="need-groups-title">Nhóm ưu tiên can thiệp</h2>
              {data.groups.length === 0 ? <p className="workspace-state">Chưa có nhóm nào cần can thiệp.</p> : (
                <ul className="workspace-list">
                  {data.groups.map((group) => (
                    <li key={group.skillCode} className="workspace-list-item">
                      <div>
                        <strong>{group.skillName}</strong>
                        <br />
                        <small>{group.studentCount} học sinh · {group.downstreamBlocked} kỹ năng hạ nguồn bị chặn · ưu tiên {group.priority}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="students-title" style={{ marginTop: '1.5rem' }}>
              <h2 id="students-title">Học sinh</h2>
              {data.students.length === 0 ? <p className="workspace-state">Lớp chưa có học sinh.</p> : (
                <ul className="workspace-list">
                  {data.students.map((student) => (
                    <li key={student.studentId} className="workspace-list-item">
                      <div>
                        <strong>{student.displayName}</strong>{student.studentCode ? ` · ${student.studentCode}` : ''}
                        <br />
                        <small>{statusLabel[student.status]}{student.rootSkillName ? ` · gốc: ${student.rootSkillName}` : ''}{student.override ? ` · giáo viên đã ${student.override.decision === 'DISMISS' ? 'bác bỏ' : 'xác nhận'}` : ''}</small>
                        {student.affectedSkills.length > 0 && (
                          <>
                            <button type="button" className="text-link" aria-expanded={expanded === student.studentId} onClick={() => setExpanded(expanded === student.studentId ? null : student.studentId)}>
                              {expanded === student.studentId ? 'Ẩn bằng chứng' : 'Xem bằng chứng'}
                            </button>
                            {expanded === student.studentId && (
                              <ul>
                                {student.affectedSkills.map((skill) => (
                                  <li key={skill.skillCode}>{skill.skillName}: sai {skill.incorrectCount}/{skill.totalCount} câu (bằng chứng: {skill.evidenceEventIds.length} sự kiện)</li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                      {student.status === 'ACTIONABLE' && (
                        <div className="workspace-list-actions">
                          <button type="button" className="text-link" disabled={state === 'sending'} onClick={() => void override(student, 'CONFIRM')}>Xác nhận</button>
                          <button type="button" className="text-link" disabled={state === 'sending'} onClick={() => void override(student, 'DISMISS')}>Bác bỏ</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
