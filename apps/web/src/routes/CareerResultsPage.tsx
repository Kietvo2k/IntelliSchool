import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader.js';
import { ScrollReveal } from '../components/ScrollReveal.js';
import { RIASEC_AXES, SimgrRadar } from '../components/ui/SimgrRadar.js';
import { apiRequest } from '../lib/api.js';

interface Match { id: string; title: string; score: number; components?: { strengths: number; interests: number; market: number; growth: number; risk: number } }
interface Recommendations { disclaimer: string; confidence?: number; riasec: { code: string; scores: Record<string, number> }; matches: Match[] }

const SIMGR_LABELS = {
  strengths: 'Năng lực',
  interests: 'Sở thích',
  market: 'Thị trường',
  growth: 'Tăng trưởng',
  risk: 'Rủi ro',
} as const;

export function CareerResultsPage() {
  const [data, setData] = useState<Recommendations | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [compare, setCompare] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  async function load() {
    setLoadState('loading');
    try { setData(await apiRequest<Recommendations>('/api/v1/career/recommendations')); setLoadState('ready'); }
    catch { setLoadState('error'); }
  }
  useEffect(() => { void load(); }, []);
  const selected = useMemo(() => data?.matches.filter((match) => compare.includes(match.id)).slice(0, 3) ?? [], [compare, data]);
  const visibleMatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return (data?.matches ?? []).filter((match) => !normalized || match.title.toLocaleLowerCase('vi').includes(normalized));
  }, [data, query]);

  return (
    <>
      <PageHeader eyebrow="Hướng nghiệp" title="Kết quả SIMGR" lede="Điểm phù hợp nghề là gợi ý tham khảo. Em có thể so sánh 2–3 nghề." />
      {loadState === 'loading' && <p className="workspace-state" role="status" aria-busy="true">Đang tải kết quả từ hồ sơ và dữ liệu đã kiểm chứng…</p>}
      {loadState === 'error' && <p className="form-message is-error" role="alert">Chưa tải được kết quả. <button className="text-link" type="button" onClick={() => void load()}>Thử lại</button></p>}
      {loadState === 'ready' && data && (
        <>
          <p className="form-message" role="note">{data.disclaimer}</p>
          {typeof data.confidence === 'number' && <p className="muted-copy">Độ tin cậy dữ liệu hiện tại: {(data.confidence * 100).toFixed(0)}% · Điểm này phản ánh mức đầy đủ của hồ sơ, không phải xác suất trúng tuyển.</p>}
          <p><strong>Mã Holland / RIASEC:</strong> {data.riasec.code || 'Chưa đủ dữ liệu — đang dùng mức trung tính 0.5'}</p>
          <SimgrRadar
            scores={data.matches[0]?.components ?? { strengths: 0.5, interests: 0.5, market: 0.5, growth: 0.5, risk: 0.5 }}
            caption={data.matches[0] ? `SIMGR · ${data.matches[0].title}` : 'Biểu đồ SIMGR. Nhãn chữ, không chỉ màu.'}
          />
          <SimgrRadar scores={data.riasec.scores} axes={RIASEC_AXES} caption="Biểu đồ Holland / RIASEC. Nhãn chữ, không chỉ màu." />
          <label className="results-search" htmlFor="career-results-filter">Tìm nghề/ngành</label>
          <input id="career-results-filter" className="results-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: công nghệ thông tin, y khoa…" />
          <p className="muted-copy">Hiển thị {visibleMatches.length} kết quả phù hợp trong danh mục.</p>
          <ol className="workspace-list">
            {visibleMatches.slice(0, 40).map((match, index) => (
              <ScrollReveal as="li" className="workspace-list-item" key={match.id} index={index}>
                <label>
                  <input type="checkbox" checked={compare.includes(match.id)} onChange={(event) => setCompare((current) => event.target.checked ? [...current, match.id].slice(0, 3) : current.filter((id) => id !== match.id))} />
                  {match.title} · {(match.score * 100).toFixed(0)}%
                </label>
              </ScrollReveal>
            ))}
          </ol>
          <p><Link className="button button-primary" to="/app/career-schools">Xem trường và ngành phù hợp</Link></p>
          {selected.length >= 2 && (
            <section className="workspace-feature">
              <h2>So sánh nghề</h2>
              <table className="data-table">
                <thead><tr><th>Thành phần</th>{selected.map((match) => <th key={match.id}>{match.title}</th>)}</tr></thead>
                <tbody>
                  {(Object.keys(SIMGR_LABELS) as Array<keyof typeof SIMGR_LABELS>).map((key) => (
                    <tr key={key}><td>{SIMGR_LABELS[key]}</td>{selected.map((match) => <td key={match.id}>{((match.components?.[key] ?? 0) * 100).toFixed(0)}%</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </>
  );
}
