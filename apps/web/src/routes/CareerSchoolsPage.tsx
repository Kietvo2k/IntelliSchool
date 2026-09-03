import { useEffect, useRef, useState } from 'react';
import { Bookmark, Building2, ExternalLink, Filter, GraduationCap, Info, MapPin, Scale, Search, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { ScrollReveal } from '../components/ScrollReveal.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';

interface Ranked {
  institutionMajorId: string;
  institutionId: string;
  institutionName: string;
  province: string | null;
  majorName: string;
  allowedBlocks: string[];
  matchedBlock: string | null;
  matchedBlockLabel?: string | null;
  applicantScore: number | null;
  cutoff: number | null;
  sourceUrl: string | null;
  gap: number | null;
  missingSubjects?: string[];
  matchReasons?: string[];
  dataQuality?: 'SOURCED' | 'NO_SOURCE';
}
interface Detail {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  programs: Array<{
    institutionMajorId: string;
    majorName: string;
    admissionScores: Array<{
      year: number;
      examBlock: string | null;
      score: number;
      sourceUrl: string | null;
    }>;
  }>;
}
interface ExamBlockOption {
  code: string;
  label: string;
}

export function CareerSchoolsPage() {
  const [query, setQuery] = useState('');
  const [examBlock, setExamBlock] = useState('');
  const [items, setItems] = useState<Ranked[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [compare, setCompare] = useState<Ranked[]>([]);
  const [message, setMessage] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [blocks, setBlocks] = useState<ExamBlockOption[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const detailCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!detail) return;
    detailCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detail]);

  async function search() {
    setLoadState('loading');
    try {
      const data = await apiRequest<{ disclaimer: string; items: Ranked[] }>('/api/v1/career/schools/rank', {
        query: { query: query || undefined, examBlock: examBlock || undefined },
      });
      setDisclaimer(data.disclaimer);
      setItems(data.items ?? []);
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể xếp hạng trường.');
    }
  }

  useEffect(() => {
    void apiRequest<{ disclaimer: string; items: Ranked[] }>('/api/v1/career/schools/rank')
      .then((data) => {
        setDisclaimer(data.disclaimer);
        setItems(data.items ?? []);
        setLoadState('ready');
      })
      .catch((error) => {
        setLoadState('error');
        setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể xếp hạng trường.');
      });
    void apiRequest<{ blocks: ExamBlockOption[] }>('/api/v1/career/exam-blocks')
      .then((data) => setBlocks(data.blocks ?? []))
      .catch(() => setBlocks([]));
  }, []);

  async function bookmark(item: Ranked) {
    try {
      await apiRequest('/api/v1/saved-items', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('save-school'),
        body: { itemType: 'INSTITUTION', itemId: item.institutionId },
      });
      setSavedIds((prev) => new Set(prev).add(item.institutionId));
      setMessage(`Đã lưu ${item.institutionName} vào danh sách của em.`);
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu.');
    }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Hướng nghiệp"
        title="Trường gợi ý"
        lede="Lọc theo tổ hợp ngành–trường cho phép. Điểm chuẩn chỉ hiện khi có nguồn chính thức đã kiểm chứng."
      />

      {message && (
        <div className="form-message flex items-center justify-between" role="status">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-xs text-slate-500 hover:text-slate-800">Đóng</button>
        </div>
      )}

      {/* Enhanced Filter Bar */}
      <form
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6 space-y-1">
            <label htmlFor="schoolQuery" className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Search size={14} className="text-teal-600" />
              Tìm trường / ngành
            </label>
            <div className="relative">
              <input
                id="schoolQuery"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none transition-all"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ví dụ: Bách Khoa, Sư phạm, Công nghệ thông tin…"
              />
            </div>
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label htmlFor="blockFilter" className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Filter size={14} className="text-teal-600" />
              Tổ hợp môn
            </label>
            <input
              id="blockFilter"
              list="exam-block-options"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm uppercase bg-slate-50/50 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none transition-all font-semibold text-slate-800"
              value={examBlock}
              onChange={(event) => setExamBlock(event.target.value.toUpperCase())}
              placeholder="A00, B00, C00, D01…"
              maxLength={4}
            />
            <datalist id="exam-block-options">
              {blocks.map((block) => (
                <option key={block.code} value={block.code}>
                  {block.label}
                </option>
              ))}
            </datalist>
          </div>

          <div className="sm:col-span-2">
            <button className="ws-btn ws-btn-primary w-full h-[42px] font-bold" type="submit">
              Lọc kết quả
            </button>
          </div>
        </div>
      </form>

      {/* Disclaimer Banner */}
      {disclaimer && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 text-xs sm:text-sm text-teal-900 flex items-center gap-2.5">
          <Info size={18} className="text-teal-700 shrink-0" />
          <span>{disclaimer}</span>
        </div>
      )}

      {loadState === 'loading' && (
        <div className="flex items-center justify-center p-12 text-slate-500" role="status" aria-busy="true">
          <div className="text-center space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            <p>Đang tìm trường theo ngành, tổ hợp và dữ liệu đã có nguồn…</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="form-message is-error" role="alert">
          Chưa tải được danh sách trường. <button className="text-link font-semibold underline" type="button" onClick={() => void search()}>Thử lại</button>
        </div>
      )}

      {/* School Cards List */}
      {loadState === 'ready' && (
        <div className="space-y-3.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tìm thấy {items.length} cơ sở đào tạo phù hợp
          </p>

          {items.map((item, index) => {
            const isCompared = Boolean(compare.find((row) => row.institutionMajorId === item.institutionMajorId));
            const isSaved = savedIds.has(item.institutionId);

            return (
              <ScrollReveal key={item.institutionMajorId} index={index}>
                <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-teal-500 hover:shadow-md">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Info */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-700">
                          <Building2 size={16} />
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-800 transition-colors">
                          {item.institutionName}
                        </h3>
                        {item.province && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            <MapPin size={12} />
                            {item.province}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 pl-10">
                        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                          <GraduationCap size={15} className="text-teal-600" />
                          <span>Chuyên ngành: <strong className="text-slate-900">{item.majorName}</strong></span>
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-xs text-slate-500">Tổ hợp xét tuyển:</span>
                          {item.allowedBlocks.map((b) => (
                            <span
                              key={b}
                              className={`rounded px-1.5 py-0.5 text-xs font-mono font-bold ${
                                item.matchedBlock === b
                                  ? 'bg-teal-700 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {b}
                            </span>
                          ))}
                        </div>

                        {item.cutoff !== null ? (
                          <p className="text-xs text-slate-600 pt-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-800 border border-amber-200">
                              Điểm chuẩn: {item.cutoff} {item.matchedBlock ? `(${item.matchedBlock})` : ''}
                            </span>
                            {item.gap !== null && (
                              <span className={`ml-2 font-semibold ${item.gap >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                                {item.gap >= 0 ? `+${item.gap} so với điểm của em` : `${item.gap} so với điểm của em`}
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic pt-1">Chưa có dữ liệu điểm chuẩn kèm nguồn</p>
                        )}

                        {item.missingSubjects && item.missingSubjects.length > 0 && (
                          <p className="text-xs text-amber-700 font-medium">
                            ⚠️ Còn thiếu điểm: {item.missingSubjects.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 md:self-center pl-10 md:pl-0">
                      <button
                        className="ws-btn ws-btn-quiet text-xs font-semibold px-3 py-2 h-9"
                        type="button"
                        onClick={() => void apiRequest<Detail>(`/api/v1/institutions/${item.institutionId}`).then(setDetail)}
                      >
                        <span>Chi tiết</span>
                      </button>

                      <button
                        className={`ws-btn text-xs font-semibold px-3 py-2 h-9 ${
                          isCompared ? 'bg-teal-100 text-teal-800 border border-teal-300' : 'ws-btn-quiet'
                        }`}
                        type="button"
                        onClick={() =>
                          setCompare((current) =>
                            current.find((row) => row.institutionMajorId === item.institutionMajorId)
                              ? current.filter((row) => row.institutionMajorId !== item.institutionMajorId)
                              : [...current, item].slice(0, 3)
                          )
                        }
                      >
                        <Scale size={14} />
                        <span>{isCompared ? 'Đã chọn' : 'So sánh'}</span>
                      </button>

                      <button
                        className={`ws-btn text-xs font-semibold px-3 py-2 h-9 ${
                          isSaved ? 'bg-teal-700 text-white' : 'ws-btn-primary'
                        }`}
                        type="button"
                        onClick={() => void bookmark(item)}
                      >
                        <Bookmark size={14} />
                        <span>{isSaved ? 'Đã lưu' : 'Lưu'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>
      )}

      {/* Comparison Drawer */}
      {compare.length > 1 && (
        <aside className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[480px] z-30 rounded-2xl border border-teal-300 bg-white p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Scale size={16} className="text-teal-700" />
              So sánh nhanh ({compare.length}/3 trường)
            </h3>
            <button
              type="button"
              onClick={() => setCompare([])}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Xóa
            </button>
          </div>
          <div className="space-y-2 text-xs">
            {compare.map((item) => (
              <div key={item.institutionMajorId} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="font-semibold text-slate-800 truncate max-w-[280px]">
                  {item.institutionName} · {item.majorName}
                </span>
                <span className="font-bold text-teal-700">
                  {item.cutoff ? `${item.cutoff}đ` : 'Chưa có'}
                </span>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Detail Slide-Over Modal */}
      {detail && (
        <div
          className="detail-sheet-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetail(null);
          }}
        >
          <section className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="school-detail-title">
            <div className="detail-sheet-head">
              <div>
                <p className="eyebrow">Chi tiết cơ sở đào tạo</p>
                <h2 id="school-detail-title" className="text-xl font-bold text-slate-900">{detail.name}</h2>
              </div>
              <button
                ref={detailCloseRef}
                className="ws-btn ws-btn-quiet h-9 px-3"
                type="button"
                aria-label="Đóng chi tiết trường"
                onClick={() => setDetail(null)}
              >
                <X size={16} />
                <span>Đóng</span>
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              {detail.description || 'Chưa có mô tả chính thức từ đề án tuyển sinh.'}
            </p>

            {detail.website && (
              <p>
                <a
                  href={detail.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline"
                >
                  <span>Mở website chính thức của trường</span>
                  <ExternalLink size={14} />
                </a>
              </p>
            )}

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Các chương trình & Điểm chuẩn đã kiểm chứng</h3>
              {detail.programs.map((program) => (
                <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5" key={program.institutionMajorId}>
                  <h4 className="font-bold text-sm text-slate-800">{program.majorName}</h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    {program.admissionScores.length > 0 ? (
                      program.admissionScores.map((score, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">Năm {score.year}:</span>
                          <span className="font-mono font-bold text-teal-700">{score.score} điểm</span>
                          {score.examBlock && <span className="rounded bg-white px-1.5 py-0.5 border border-slate-200 text-slate-600">Khối {score.examBlock}</span>}
                        </div>
                      ))
                    ) : (
                      <p className="italic text-slate-400">Chưa có điểm chuẩn có nguồn chính thức.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
