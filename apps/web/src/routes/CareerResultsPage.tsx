import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Info, Layers, Radar, Search, Sparkles, TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { ScrollReveal } from '../components/ScrollReveal.js';
import { RIASEC_AXES, SimgrRadar } from '../components/ui/SimgrRadar.js';
import { apiRequest } from '../lib/api.js';

interface Match {
  id: string;
  title: string;
  score: number;
  components?: {
    strengths: number;
    interests: number;
    market: number;
    growth: number;
    risk: number;
  };
}
interface Recommendations {
  disclaimer: string;
  confidence?: number;
  riasec: {
    code: string;
    scores: Record<string, number>;
  };
  matches: Match[];
}

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
    try {
      setData(await apiRequest<Recommendations>('/api/v1/career/recommendations'));
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = useMemo(() => data?.matches.filter((match) => compare.includes(match.id)).slice(0, 3) ?? [], [compare, data]);
  const visibleMatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return (data?.matches ?? []).filter((match) => !normalized || match.title.toLocaleLowerCase('vi').includes(normalized));
  }, [data, query]);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Hướng nghiệp"
        title="Kết quả SIMGR"
        lede="Điểm phù hợp nghề là gợi ý tham khảo từ hồ sơ học tập và trắc nghiệm. Em có thể so sánh 2–3 nghề."
      />

      {loadState === 'loading' && (
        <div className="flex items-center justify-center p-12 text-slate-500" role="status" aria-busy="true">
          <div className="text-center space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            <p>Đang tải kết quả từ hồ sơ và dữ liệu đã kiểm chứng…</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="form-message is-error" role="alert">
          Chưa tải được kết quả. <button className="text-link font-semibold underline" type="button" onClick={() => void load()}>Thử lại</button>
        </div>
      )}

      {loadState === 'ready' && data && (
        <>
          {/* Top Informative Banner */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-sm text-teal-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-teal-900">{data.disclaimer}</p>
                {typeof data.confidence === 'number' && (
                  <p className="text-xs text-teal-800/80 mt-0.5">
                    Độ tin cậy dữ liệu hiện tại: <strong>{(data.confidence * 100).toFixed(0)}%</strong> · Điểm này phản ánh mức đầy đủ của hồ sơ, không phải xác suất trúng tuyển.
                  </p>
                )}
              </div>
            </div>
            {data.riasec.code && (
              <span className="shrink-0 rounded-full bg-teal-700 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                Mã Holland: {data.riasec.code}
              </span>
            )}
          </div>

          <p className="hidden">
            <strong>Mã Holland / RIASEC:</strong> {data.riasec.code || 'Chưa đủ dữ liệu — đang dùng mức trung tính 0.5'}
          </p>

          {/* 2-Column Visual Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SIMGR Radar Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
                    <Radar size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Phân tích SIMGR Đa chiều</h2>
                    <p className="text-xs text-slate-500">{data.matches[0] ? data.matches[0].title : 'Chỉ số trung bình'}</p>
                  </div>
                </div>
                {data.matches[0] && (
                  <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-800">
                    {Math.round(data.matches[0].score * 100)}% phù hợp
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center">
                <SimgrRadar
                  scores={data.matches[0]?.components ?? { strengths: 0.5, interests: 0.5, market: 0.5, growth: 0.5, risk: 0.5 }}
                  caption={data.matches[0] ? `SIMGR · ${data.matches[0].title}` : 'Biểu đồ SIMGR. Nhãn chữ, không chỉ màu.'}
                />
              </div>
            </section>

            {/* Holland RIASEC Radar Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Hồ sơ thiên hướng Holland (RIASEC)</h2>
                    <p className="text-xs text-slate-500">{data.riasec.code ? `Nhóm tính cách nghề: ${data.riasec.code}` : 'Đang sử dụng dữ liệu tiêu chuẩn'}</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                  {data.riasec.code || 'RIASEC'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <SimgrRadar
                  scores={data.riasec.scores}
                  axes={RIASEC_AXES}
                  caption="Biểu đồ Holland / RIASEC. Nhãn chữ, không chỉ màu."
                />
              </div>
            </section>
          </div>

          {/* Comparison Panel if selected */}
          {selected.length >= 2 && (
            <section className="rounded-2xl border border-teal-300 bg-white p-6 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="text-teal-700" size={20} />
                  Bảng so sánh {selected.length} ngành nghề đã chọn
                </h2>
                <button
                  type="button"
                  onClick={() => setCompare([])}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="w-1/4">Thành phần</th>
                      {selected.map((match) => (
                        <th key={match.id} className="text-teal-800">
                          {match.title}
                          <span className="block text-xs font-normal text-slate-500">{(match.score * 100).toFixed(0)}% phù hợp</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(SIMGR_LABELS) as Array<keyof typeof SIMGR_LABELS>).map((key) => (
                      <tr key={key}>
                        <td className="font-semibold text-slate-700">{SIMGR_LABELS[key]}</td>
                        {selected.map((match) => (
                          <td key={match.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-teal-600 rounded-full"
                                  style={{ width: `${((match.components?.[key] ?? 0) * 100).toFixed(0)}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-800 min-w-[2.5rem] text-right">
                                {((match.components?.[key] ?? 0) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Search & Matches Grid */}
          <section className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Danh sách ngành nghề phù hợp</h2>
                <p className="text-sm text-slate-500">
                  Hiển thị {visibleMatches.length} kết quả phù hợp trong danh mục. Chọn để so sánh tối đa 3 nghề.
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <label className="results-search sr-only" htmlFor="career-results-filter">Tìm nghề/ngành</label>
                <input
                  id="career-results-filter"
                  className="results-search-input pl-10 pr-4 py-2 text-sm w-full rounded-xl border border-slate-200 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none transition-all"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm ngành, nghề, từ khóa…"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleMatches.slice(0, 40).map((match, index) => {
                const isChecked = compare.includes(match.id);
                const scorePercent = Math.round(match.score * 100);
                return (
                  <ScrollReveal key={match.id} index={index}>
                    <div
                      className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                        isChecked
                          ? 'border-teal-500 bg-teal-50/50 shadow-sm ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              checked={isChecked}
                              onChange={(event) =>
                                setCompare((current) =>
                                  event.target.checked
                                    ? [...current, match.id].slice(0, 3)
                                    : current.filter((id) => id !== match.id)
                                )
                              }
                            />
                            <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-teal-700 transition-colors">
                              {match.title}
                            </h3>
                          </label>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-teal-600" />
                            Độ tương thích: <strong className="text-slate-800">{scorePercent}%</strong>
                          </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center justify-center rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-teal-700 border border-teal-100">
                          {scorePercent}%
                        </span>
                      </div>

                      {match.components && (
                        <div className="mt-3.5 grid grid-cols-5 gap-1 pt-3 border-t border-slate-100 text-[10px] text-slate-500 text-center">
                          <div>
                            <div className="h-1 bg-slate-100 rounded-full mb-1 overflow-hidden">
                              <div className="h-full bg-teal-500" style={{ width: `${match.components.strengths * 100}%` }} />
                            </div>
                            <span>Năng lực</span>
                          </div>
                          <div>
                            <div className="h-1 bg-slate-100 rounded-full mb-1 overflow-hidden">
                              <div className="h-full bg-teal-500" style={{ width: `${match.components.interests * 100}%` }} />
                            </div>
                            <span>Sở thích</span>
                          </div>
                          <div>
                            <div className="h-1 bg-slate-100 rounded-full mb-1 overflow-hidden">
                              <div className="h-full bg-teal-500" style={{ width: `${match.components.market * 100}%` }} />
                            </div>
                            <span>Thị trường</span>
                          </div>
                          <div>
                            <div className="h-1 bg-slate-100 rounded-full mb-1 overflow-hidden">
                              <div className="h-full bg-teal-500" style={{ width: `${match.components.growth * 100}%` }} />
                            </div>
                            <span>Tăng trưởng</span>
                          </div>
                          <div>
                            <div className="h-1 bg-slate-100 rounded-full mb-1 overflow-hidden">
                              <div className="h-full bg-amber-500" style={{ width: `${match.components.risk * 100}%` }} />
                            </div>
                            <span>Rủi ro</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <Link
                className="ws-btn ws-btn-primary inline-flex items-center gap-2"
                to="/app/career-schools"
              >
                <span>Xem trường và ngành phù hợp</span>
                <ChevronRight size={18} />
              </Link>
              <Link
                className="ws-btn ws-btn-quiet text-sm"
                to="/app/career-quiz"
              >
                Làm lại bài trắc nghiệm
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
