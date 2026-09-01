import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';

interface Aspiration { id: string; institutionMajorId: string | null; priority: number; note: string; institutionName?: string; majorName?: string; }
interface InstitutionOption { id: string; name: string; }
interface ProgramOption { institutionMajorId: string; majorName: string; }
interface ProbabilityResult { category: string; probability: number | null; predictedCutoff: number | null; examBlock: string | null; disclaimer: string; }
interface ScholarshipMatch { id: string; title: string; matchScore: number; reasons: string[]; }

const categoryLabel: Record<string, string> = { SAFE: 'An toàn', CONSIDER: 'Cân nhắc', REACH: 'Thử sức', RISKY: 'Rủi ro cao', INSUFFICIENT_DATA: 'Chưa đủ dữ liệu' };

export function AspirationsPage() {
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [scholarships, setScholarships] = useState<ScholarshipMatch[]>([]);
  const [scholarshipDisclaimer, setScholarshipDisclaimer] = useState('');
  const [probabilities, setProbabilities] = useState<Record<string, ProbabilityResult>>({});
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');

  async function reload() {
    try {
      const [aspirationData, institutionData, scholarshipData] = await Promise.all([
        apiRequest<Aspiration[]>('/api/v1/aspirations'),
        apiRequest<InstitutionOption[]>('/api/v1/institutions'),
        apiRequest<{ disclaimer: string; matches: ScholarshipMatch[] }>('/api/v1/career/scholarship-matches'),
      ]);
      setAspirations(aspirationData ?? []);
      setInstitutions(institutionData ?? []);
      setScholarships(scholarshipData?.matches ?? []);
      setScholarshipDisclaimer(scholarshipData?.disclaimer ?? '');
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải dữ liệu nguyện vọng.');
    }
  }

  useEffect(() => { void reload(); }, []);

  async function loadPrograms(institutionId: string) {
    setSelectedInstitution(institutionId);
    setPrograms([]);
    if (!institutionId) return;
    try {
      const detail = await apiRequest<{ programs: ProgramOption[] }>(`/api/v1/institutions/${institutionId}`);
      setPrograms(detail?.programs ?? []);
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải ngành của trường.');
    }
  }

  async function run(path: string, prefix: string, body: unknown, success: string) {
    setState('sending');
    setMessage('');
    try {
      await apiRequest(path, { method: 'POST', idempotencyKey: newIdempotencyKey(prefix), body });
      setState('idle');
      setMessage(success);
      await reload();
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Thao tác chưa thực hiện được.');
    }
  }

  async function addAspiration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const institutionMajorId = String(form.get('institutionMajorId') ?? '');
    if (!institutionMajorId) { setMessage('Chọn một ngành để thêm nguyện vọng.'); return; }
    await run('/api/v1/aspirations', 'aspiration-add', { institutionMajorId, note: String(form.get('note') ?? '') }, 'Đã thêm nguyện vọng.');
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= aspirations.length) return;
    const reordered = [...aspirations];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    await run('/api/v1/aspirations/reorder', 'aspiration-reorder', { orderedIds: reordered.map((item) => item.id) }, 'Đã cập nhật thứ tự nguyện vọng.');
  }

  async function estimate(aspiration: Aspiration) {
    if (!aspiration.institutionMajorId) return;
    try {
      const result = await apiRequest<ProbabilityResult>('/api/v1/career/admission-probability', { method: 'POST', idempotencyKey: newIdempotencyKey('prob'), body: { institutionMajorId: aspiration.institutionMajorId } });
      setProbabilities((current) => ({ ...current, [aspiration.id]: result }));
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể ước tính xác suất.');
    }
  }

  const allRisky = aspirations.length > 0 && aspirations.every((aspiration) => probabilities[aspiration.id]?.category === 'RISKY');

  return (
    <>
      <PageHeader eyebrow="Hướng nghiệp" title="Nguyện vọng của em" lede="Sắp xếp nguyện vọng theo thứ tự ưu tiên, ước tính khả năng trúng tuyển và tìm học bổng phù hợp. Mọi con số chỉ mang tính tham khảo." />
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</p>}
      {allRisky && <p className="form-message is-error" role="alert">Tất cả nguyện vọng hiện ở mức rủi ro cao. Em nên cân nhắc bổ sung nguyện vọng an toàn hơn.</p>}

      <section aria-labelledby="add-aspiration-title" className="workspace-feature">
        <h2 id="add-aspiration-title">Thêm nguyện vọng</h2>
        <form className="login-form" onSubmit={addAspiration}>
          <label htmlFor="aspInstitution">Trường</label>
          <select id="aspInstitution" value={selectedInstitution} onChange={(event) => void loadPrograms(event.target.value)}>
            <option value="">Chọn trường</option>
            {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
          </select>
          <label htmlFor="aspProgram">Ngành</label>
          <select id="aspProgram" name="institutionMajorId" required disabled={programs.length === 0}>
            <option value="">Chọn ngành</option>
            {programs.map((program) => <option key={program.institutionMajorId} value={program.institutionMajorId}>{program.majorName}</option>)}
          </select>
          <label htmlFor="aspNote">Ghi chú</label>
          <input id="aspNote" name="note" maxLength={500} />
          <button className="button button-primary" type="submit" disabled={state === 'sending'}>Thêm nguyện vọng</button>
        </form>
      </section>

      <section aria-labelledby="aspiration-list-title" style={{ marginTop: '1.25rem' }}>
        <h2 id="aspiration-list-title">Danh sách nguyện vọng</h2>
        {aspirations.length === 0 ? <p className="workspace-state">Chưa có nguyện vọng nào.</p> : (
          <ul className="workspace-list">
            {aspirations.map((aspiration, index) => {
              const probability = probabilities[aspiration.id];
              return (
                <li key={aspiration.id} className="workspace-list-item">
                  <div>
                    <strong>NV{aspiration.priority}: {aspiration.majorName ?? 'Ngành'} — {aspiration.institutionName ?? 'Trường'}</strong>
                    {aspiration.note && <><br /><small>{aspiration.note}</small></>}
                    {probability && (
                      <p><small>{categoryLabel[probability.category] ?? probability.category}{probability.probability !== null ? ` · ${(probability.probability * 100).toFixed(0)}%` : ''}{probability.predictedCutoff !== null ? ` · dự báo điểm chuẩn ${probability.predictedCutoff}${probability.examBlock ? ` (${probability.examBlock})` : ''}` : ''}. {probability.disclaimer}</small></p>
                    )}
                  </div>
                  <div className="workspace-list-actions">
                    <button type="button" className="text-link" onClick={() => void move(index, -1)} disabled={index === 0 || state === 'sending'}>Lên</button>
                    <button type="button" className="text-link" onClick={() => void move(index, 1)} disabled={index === aspirations.length - 1 || state === 'sending'}>Xuống</button>
                    <button type="button" className="text-link" onClick={() => void estimate(aspiration)}>Ước tính đỗ</button>
                    <button type="button" className="text-link" onClick={() => void run(`/api/v1/aspirations/${aspiration.id}/delete`, 'aspiration-delete', undefined, 'Đã xóa nguyện vọng.')} disabled={state === 'sending'}>Xóa</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="scholarship-match-title" style={{ marginTop: '1.25rem' }}>
        <h2 id="scholarship-match-title">Học bổng phù hợp</h2>
        {scholarshipDisclaimer && <p className="form-message" role="note">{scholarshipDisclaimer}</p>}
        {scholarships.length === 0 ? <p className="workspace-state">Chưa tìm thấy học bổng phù hợp với hồ sơ hiện tại.</p> : (
          <ul className="workspace-list">
            {scholarships.map((scholarship) => (
              <li key={scholarship.id} className="workspace-list-item"><div><strong>{scholarship.title}</strong> · phù hợp {(scholarship.matchScore * 100).toFixed(0)}%{scholarship.reasons.length > 0 && <><br /><small>{scholarship.reasons.join(' · ')}</small></>}</div></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
