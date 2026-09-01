import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useSession } from '../lib/SessionContext.js';

interface CareerView { id: string; code: string; name: string; description: string; majorCount: number; }
interface InstitutionView { id: string; code: string; name: string; province: string | null; type: string; programCount: number; tuitionBand?: string | null; coverage?: { years?: number[]; complete?: boolean; disclaimer?: string }; }
interface AdmissionScoreView { year: number; examBlock: string | null; score: number; sourceUrl: string | null; }
interface ProgramView { institutionMajorId: string; majorCode: string; majorName: string; programCode: string | null; admissionScores: AdmissionScoreView[]; }
interface ScholarshipView { id: string; title: string; deadlineAt: string | null; sourceUrl: string | null; institutionName?: string | null; }
interface InstitutionDetail extends InstitutionView {
  description: string | null;
  website: string | null;
  admissionMethod: string | null;
  ranking?: string | null;
  accreditation?: string | null;
  employmentRate?: number | null;
  programs: ProgramView[];
  scholarships: ScholarshipView[];
}

export function CareersPage() {
  const { user } = useSession();
  const isAdmin = user.role === 'PLATFORM_ADMIN';
  const [careers, setCareers] = useState<CareerView[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionView[]>([]);
  const [scholarships, setScholarships] = useState<ScholarshipView[]>([]);
  const [detail, setDetail] = useState<InstitutionDetail | null>(null);
  const [province, setProvince] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'sending'>('loading');

  async function loadAll(nextProvince = province) {
    setState('loading');
    setMessage('');
    try {
      const [careerData, institutionData, scholarshipData] = await Promise.all([
        apiRequest<CareerView[]>('/api/v1/careers'),
        apiRequest<InstitutionView[]>('/api/v1/institutions', { query: { province: nextProvince || undefined } }),
        apiRequest<ScholarshipView[]>('/api/v1/scholarships'),
      ]);
      setCareers(careerData ?? []);
      setInstitutions(institutionData ?? []);
      setScholarships(scholarshipData ?? []);
      setState('idle');
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải danh mục hướng nghiệp.');
    }
  }

  useEffect(() => {
    void Promise.all([
      apiRequest<CareerView[]>('/api/v1/careers'),
      apiRequest<InstitutionView[]>('/api/v1/institutions'),
      apiRequest<ScholarshipView[]>('/api/v1/scholarships'),
    ]).then(([careerData, institutionData, scholarshipData]) => {
      setCareers(careerData ?? []);
      setInstitutions(institutionData ?? []);
      setScholarships(scholarshipData ?? []);
      setState('idle');
    }).catch((error) => {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải danh mục hướng nghiệp.');
    });
  }, []);

  async function openInstitution(id: string) {
    setMessage('');
    try {
      setDetail(await apiRequest<InstitutionDetail>(`/api/v1/institutions/${id}`));
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải chi tiết trường.');
    }
  }

  async function submitAdmin(event: FormEvent<HTMLFormElement>, path: string, prefix: string, body: unknown, success: string) {
    event.preventDefault();
    setState('sending');
    setMessage('');
    try {
      await apiRequest(path, { method: 'POST', idempotencyKey: newIdempotencyKey(prefix), body });
      setState('idle');
      setMessage(success);
      await loadAll();
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Thao tác chưa thực hiện được.');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Hướng nghiệp" title="Danh mục nghề & trường" lede="Tra cứu nghề, ngành, trường và học bổng 2024–2026 từ nguồn công khai. Coverage chưa đủ verify mọi tổ hợp × năm — luôn kèm nguồn tham khảo." />
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</p>}

      <div className="workspace-feature-grid">
        <article className="workspace-feature">
          <h2>Nghề nghiệp</h2>
          {state === 'loading' ? <p className="workspace-state" role="status">Đang tải…</p> : careers.length === 0 ? <p className="workspace-state">Chưa có nghề nào.</p> : (
            <ul className="workspace-list">
              {careers.map((career) => (
                <li key={career.id} className="workspace-list-item"><div><strong>{career.name}</strong><br /><small>{career.description || 'Chưa có mô tả.'} · {career.majorCount} ngành liên quan</small></div></li>
              ))}
            </ul>
          )}
        </article>

        <article className="workspace-feature">
          <h2>Trường đại học</h2>
          <form className="login-form" onSubmit={(event) => { event.preventDefault(); void loadAll(); }}>
            <label htmlFor="provinceFilter">Lọc theo tỉnh/thành</label>
            <input id="provinceFilter" value={province} onChange={(event) => setProvince(event.target.value)} maxLength={100} placeholder="Đà Nẵng" />
            <button className="button button-primary" type="submit">Lọc</button>
          </form>
          {institutions.length === 0 ? <p className="workspace-state">Chưa có trường nào.</p> : (
            <ul className="workspace-list">
              {institutions.map((institution) => (
                <li key={institution.id} className="workspace-list-item">
                  <div>
                    <strong>{institution.name}</strong><br />
                    <small>{institution.province ?? 'Chưa rõ tỉnh'} · {institution.programCount} ngành{institution.coverage?.complete === false ? ' · coverage chưa đủ' : ''}</small>
                    {institution.coverage?.disclaimer && <small> · {institution.coverage.disclaimer}</small>}
                  </div>
                  <div className="workspace-list-actions"><button type="button" className="text-link" onClick={() => void openInstitution(institution.id)}>Xem chi tiết</button></div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      {detail && (
        <section aria-labelledby="institution-detail-title" className="workspace-feature" style={{ marginTop: '1.25rem' }}>
          <h2 id="institution-detail-title">{detail.name}</h2>
          {detail.description && <p>{detail.description}</p>}
          {detail.admissionMethod && <p><strong>Phương thức xét tuyển:</strong> {detail.admissionMethod}</p>}
          {detail.tuitionBand && <p><strong>Học phí:</strong> {detail.tuitionBand}</p>}
          {detail.employmentRate != null && <p><strong>Việc làm (tham khảo):</strong> {detail.employmentRate}%</p>}
          {detail.coverage?.disclaimer && <p role="note">{detail.coverage.disclaimer}</p>}
          {detail.website && <p><a className="text-link" href={detail.website} target="_blank" rel="noreferrer">Website trường</a></p>}
          <h3>Ngành &amp; điểm chuẩn</h3>
          {detail.programs.length === 0 ? <p className="workspace-state">Chưa có dữ liệu ngành.</p> : detail.programs.map((program) => (
            <div key={program.institutionMajorId} style={{ marginBottom: '.75rem' }}>
              <strong>{program.majorName}</strong>
              {program.admissionScores.length === 0 ? <p><small>Chưa có điểm chuẩn.</small></p> : (
                <ul>
                  {program.admissionScores.map((score, index) => (
                    <li key={index}>{score.year}{score.examBlock ? ` · ${score.examBlock}` : ''}: {score.score} điểm{score.sourceUrl ? <> · <a className="text-link" href={score.sourceUrl} target="_blank" rel="noreferrer">nguồn</a></> : ''}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <button className="text-link" type="button" onClick={() => setDetail(null)}>Đóng chi tiết</button>
        </section>
      )}

      <section aria-labelledby="scholarships-title" style={{ marginTop: '1.25rem' }}>
        <h2 id="scholarships-title">Học bổng</h2>
        {scholarships.length === 0 ? <p className="workspace-state">Chưa có học bổng.</p> : (
          <ul className="workspace-list">
            {scholarships.map((scholarship) => (
              <li key={scholarship.id} className="workspace-list-item">
                <div><strong>{scholarship.title}</strong><br /><small>{scholarship.institutionName ?? 'Nhiều trường'}{scholarship.deadlineAt ? ` · hạn ${new Date(scholarship.deadlineAt).toLocaleDateString('vi-VN')}` : ''}</small></div>
                {scholarship.sourceUrl && <div className="workspace-list-actions"><a className="text-link" href={scholarship.sourceUrl} target="_blank" rel="noreferrer">Nguồn</a></div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section aria-labelledby="catalog-admin-title" style={{ marginTop: '1.5rem' }}>
          <h2 id="catalog-admin-title">Quản lý danh mục (admin)</h2>
          <div className="workspace-feature-grid">
            <article className="workspace-feature">
              <p>Thêm/cập nhật nghề</p>
              <form className="login-form" onSubmit={(event) => { const form = new FormData(event.currentTarget); void submitAdmin(event, '/api/v1/admin/careers', 'career-upsert', { code: String(form.get('code') ?? ''), name: String(form.get('name') ?? ''), description: String(form.get('description') ?? '') }, 'Đã lưu nghề.'); }}>
                <label htmlFor="careerCode">Mã nghề</label>
                <input id="careerCode" name="code" required placeholder="DATA_SCIENTIST" />
                <label htmlFor="careerName">Tên nghề</label>
                <input id="careerName" name="name" required />
                <label htmlFor="careerDesc">Mô tả</label>
                <input id="careerDesc" name="description" />
                <button className="button button-primary" type="submit" disabled={state === 'sending'}>Lưu nghề</button>
              </form>
            </article>
            <article className="workspace-feature">
              <p>Thêm/cập nhật trường</p>
              <form className="login-form" onSubmit={(event) => { const form = new FormData(event.currentTarget); void submitAdmin(event, '/api/v1/admin/institutions', 'institution-upsert', { code: String(form.get('code') ?? ''), name: String(form.get('name') ?? ''), province: String(form.get('province') ?? '') || undefined }, 'Đã lưu trường.'); }}>
                <label htmlFor="instCode">Mã trường</label>
                <input id="instCode" name="code" required placeholder="DUT" />
                <label htmlFor="instName">Tên trường</label>
                <input id="instName" name="name" required />
                <label htmlFor="instProvince">Tỉnh/thành</label>
                <input id="instProvince" name="province" />
                <button className="button button-primary" type="submit" disabled={state === 'sending'}>Lưu trường</button>
              </form>
            </article>
            <article className="workspace-feature">
              <h2>Crawl nguồn công khai (allowlist)</h2>
              <p>Chỉ HTTPS, host đã khai báo. Không hứa đủ điểm chuẩn 2024–2026.</p>
              <form className="login-form" onSubmit={(event) => {
                event.preventDefault();
                const url = String(new FormData(event.currentTarget).get('url') ?? '');
                void submitAdmin(event, '/api/v1/admin/crawl-jobs', 'crawl-job', { url }, 'Đã xếp hàng và thử lấy excerpt nguồn.');
              }}>
                <label htmlFor="crawlUrl">URL HTTPS</label>
                <input id="crawlUrl" name="url" type="url" required placeholder="https://tuyensinh247.com/..." />
                <button className="button button-primary" type="submit" disabled={state === 'sending'}>Crawl</button>
              </form>
            </article>
            <article className="workspace-feature">
              <h2>Import CSV tổ hợp / điểm chuẩn</h2>
              <p>Cột: institutionCode, majorCode, year, examBlock, score, sourceUrl. Mã ngoài 98 vẫn nhận nếu dạng A00.</p>
              <form className="login-form" onSubmit={(event) => {
                event.preventDefault();
                const file = new FormData(event.currentTarget).get('csv');
                if (!(file instanceof File) || file.size === 0) { setMessage('Hãy chọn tệp CSV.'); return; }
                void file.text().then(async (text) => {
                  const rows = text.split(/\r?\n/).slice(1).map((line) => line.split(',')).filter((cols) => cols.length >= 5).map((cols) => ({
                    institutionCode: cols[0]!.trim().toUpperCase(),
                    majorCode: cols[1]!.trim().toUpperCase(),
                    year: Number(cols[2]),
                    examBlock: cols[3]!.trim().toUpperCase(),
                    score: Number(cols[4]),
                    sourceUrl: cols[5]?.trim() || null,
                  }));
                  setState('sending'); setMessage('');
                  try {
                    await apiRequest('/api/v1/admin/admission-scores/import', { method: 'POST', idempotencyKey: newIdempotencyKey('score-import'), body: { rows } });
                    setState('idle');
                    setMessage('Đã nhập điểm chuẩn.');
                    await loadAll();
                  } catch (error) {
                    setState('error');
                    setMessage(error instanceof ApiRequestError ? error.message : 'Thao tác chưa thực hiện được.');
                  }
                });
              }}>
                <label htmlFor="scoreCsv">Tệp CSV</label>
                <input id="scoreCsv" name="csv" type="file" accept=".csv,.txt,.md" required />
                <button className="button button-primary" type="submit">Nhập CSV</button>
              </form>
            </article>
          </div>
        </section>
      )}
    </>
  );
}
