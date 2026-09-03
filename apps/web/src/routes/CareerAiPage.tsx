import { FormEvent, useEffect, useState } from 'react';
import { BookOpen, CheckCircle, ChevronDown, Clock, Compass, FileText, History, MessageSquare, Sparkles, TrendingUp } from 'lucide-react';
import { ChatThread, type ChatBubble } from '../components/ui/ChatThread.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { presentAssistantText } from '../lib/present-assistant.js';

interface Agent {
  type: string;
  name: string;
  description: string;
}
interface Finding {
  title: string;
  description: string;
  severity: string;
}
interface Run {
  id: string;
  isFallback: boolean;
  createdAt: string;
  result?: { report?: string };
  report?: string;
  findings?: Finding[];
}

type AnalysisPreset = 'ACADEMIC' | 'ADMISSION' | 'COMPREHENSIVE';

const PRESET_CONFIG: Record<AnalysisPreset, { label: string; desc: string; types: string[] }> = {
  ACADEMIC: {
    label: 'Học lực & Khối thi',
    desc: 'Đánh giá điểm số các môn trên lớp và độ mạnh yếu theo từng tổ hợp xét tuyển.',
    types: ['ACADEMIC_ANALYST', 'TREND_DETECTOR', 'SUBJECT_RECOMMENDER'],
  },
  ADMISSION: {
    label: 'Cơ hội & Điểm chuẩn',
    desc: 'So sánh tương quan điểm với điểm chuẩn các trường, đánh giá độ an toàn và rủi ro.',
    types: ['ADMISSION_STRATEGIST', 'COMPETITIVENESS_ANALYST', 'RISK_ASSESSOR'],
  },
  COMPREHENSIVE: {
    label: 'Đánh giá toàn diện',
    desc: 'Phân tích đầy đủ học lực, cơ hội tuyển sinh, thị trường việc làm và kế hoạch học tập.',
    types: [
      'ACADEMIC_ANALYST',
      'TREND_DETECTOR',
      'SUBJECT_RECOMMENDER',
      'MARKET_ANALYST',
      'ADMISSION_STRATEGIST',
      'COMPETITIVENESS_ANALYST',
      'STUDY_PLAN_ADVISOR',
      'RISK_ASSESSOR',
    ],
  },
};

const SUGGESTED_MAJORS = [
  'Khoa học Máy tính',
  'Y đa khoa',
  'Kinh tế Quốc tế',
  'Kỹ thuật Phần mềm',
  'Luật Thương mại',
  'Tự động hóa',
];

const STARTER_QUESTIONS = [
  'Điểm tổ hợp A00 của em hiện tại có an toàn cho ngành này không?',
  'Cần bứt phá thêm môn nào để tăng cơ hội trúng tuyển?',
  'Gợi ý các trường đào tạo ngành này phù hợp với học lực của em.',
];

export function CareerAiPage() {
  const [_agents, setAgents] = useState<Agent[]>([]);
  const [preset, setPreset] = useState<AnalysisPreset>('COMPREHENSIVE');
  const [runs, setRuns] = useState<Run[]>([]);
  const [current, setCurrent] = useState<Run | null>(null);
  const [targetMajor, setTargetMajor] = useState('');
  const [compare, setCompare] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [chat, setChat] = useState<ChatBubble[]>([]);
  const [chatSession, setChatSession] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function reload() {
    const [agentData, runData] = await Promise.all([
      apiRequest<{ agents: Agent[] }>('/api/v1/career/ai/agents'),
      apiRequest<Run[]>('/api/v1/career/ai/runs'),
    ]);
    setAgents(agentData.agents ?? []);
    setRuns(runData ?? []);
  }

  useEffect(() => {
    void reload().catch((err) => {
      setError(true);
      setMessage(err instanceof ApiRequestError ? err.message : 'Chưa tải được dữ liệu phân tích.');
    });
  }, []);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setMessage('');
    setError(false);
    try {
      const validCompare = compare
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);

      const result = await apiRequest<Run>('/api/v1/career/ai/analyze', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('career-ai'),
        body: {
          agentTypes: PRESET_CONFIG[preset].types,
          targetMajor: targetMajor.trim() || undefined,
          mode: validCompare.length >= 2 ? 'compare' : 'analyze',
          compareMajors: validCompare.length >= 2 ? validCompare : undefined,
        },
      });
      setCurrent(result);
      if (result.isFallback) {
        setError(false);
        setMessage('Đã hoàn tất phân tích dựa trên dữ liệu học tập.');
      } else {
        setMessage('Đã hoàn tất phân tích hồ sơ.');
      }
      await reload();
    } catch (err) {
      setError(true);
      setMessage(err instanceof ApiRequestError ? err.message : 'Chưa thể phân tích.');
    } finally {
      setSending(false);
    }
  }

  async function sendChatMessage(text: string) {
    setChatSending(true);
    setChat((prev) => [...prev, { id: `u-${Date.now()}`, role: 'USER', content: text }]);
    try {
      const reply = await apiRequest<{ sessionId: string; message: { id: string; content: string } }>(
        '/api/v1/ai/chat',
        {
          method: 'POST',
          idempotencyKey: newIdempotencyKey('career-chat'),
          body: { message: text, sessionId: chatSession, purpose: 'CAREER_CHAT' },
        }
      );
      setChatSession(reply.sessionId);
      setChat((prev) => [
        ...prev,
        {
          id: reply.message.id,
          role: 'ASSISTANT',
          content: presentAssistantText('CAREER_CHAT', reply.message.content),
        },
      ]);
    } catch (err) {
      setError(true);
      setMessage(err instanceof ApiRequestError ? err.message : 'Chưa gửi được câu hỏi.');
    } finally {
      setChatSending(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Hướng nghiệp"
        title="Phân tích AI"
        lede="Tư vấn và đánh giá mức độ phù hợp ngành học dựa trên điểm số thực tế, dữ liệu điểm chuẩn và đề án tuyển sinh chính thức."
      />

      {message && (
        <div
          className={`form-message flex items-center justify-between ${
            error ? 'is-error' : 'is-success'
          }`}
          role={error ? 'alert' : 'status'}
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 2-Column Balanced Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configuration & Controls */}
        <section className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Thiết lập mục tiêu tư vấn</h2>
              <p className="text-xs text-slate-500 mt-0.5">Lựa chọn ngành học mục tiêu và phạm vi đánh giá</p>
            </div>

            <form className="space-y-4" onSubmit={(event) => void analyze(event)}>
              {/* Target Major */}
              <div className="space-y-1.5">
                <label htmlFor="targetMajor" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Ngành học mục tiêu
                </label>
                <input
                  id="targetMajor"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none transition-all font-medium text-slate-800"
                  value={targetMajor}
                  onChange={(event) => setTargetMajor(event.target.value)}
                  placeholder="Ví dụ: Khoa học Máy tính, Y đa khoa, Kinh tế…"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Gợi ý:</span>
                  {SUGGESTED_MAJORS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTargetMajor(m)}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-800 transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Analysis Scope Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Phạm vi phân tích
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(PRESET_CONFIG) as AnalysisPreset[]).map((key) => {
                    const item = PRESET_CONFIG[key];
                    const isSelected = preset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPreset(key)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50/70 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
                        }`}
                      >
                        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                          isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {key === 'ACADEMIC' ? <BookOpen size={14} /> : key === 'ADMISSION' ? <TrendingUp size={14} /> : <Compass size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <strong className="text-xs font-bold text-slate-900 block">{item.label}</strong>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Compare Majors Collapsible */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowCompare(!showCompare)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                >
                  <ChevronDown size={14} className={`transition-transform ${showCompare ? 'rotate-180' : ''}`} />
                  <span>{showCompare ? 'Ẩn so sánh ngành phụ' : '+ So sánh thêm 1–2 ngành khác (tùy chọn)'}</span>
                </button>

                {showCompare && (
                  <div className="pt-2 space-y-1 animate-in fade-in">
                    <input
                      id="compareMajors"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50/50 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
                      value={compare}
                      onChange={(event) => setCompare(event.target.value)}
                      placeholder="Nhập tên ngành, phân cách bằng dấu phẩy"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  className="ws-btn ws-btn-primary w-full h-[44px] font-bold inline-flex items-center justify-center gap-2 shadow-sm"
                  type="submit"
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Đang tổng hợp dữ liệu…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Phân tích hồ sơ ngay</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Analysis History */}
          {runs.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <History size={14} className="text-teal-600" />
                  Lịch sử phân tích ({runs.length} lần)
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>

              {showHistory && (
                <ul className="space-y-1.5 pt-3 border-t border-slate-200/60 mt-3 text-xs">
                  {runs.slice(0, 5).map((run) => (
                    <li key={run.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                      <span className="text-slate-700 flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        {new Date(run.createdAt).toLocaleString('vi-VN')}
                      </span>
                      <span className={`text-[11px] font-semibold ${run.isFallback ? 'text-amber-700' : 'text-teal-700'}`}>
                        {run.isFallback ? 'Dữ liệu dự phòng' : 'Hoàn tất ✓'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Analysis Results & Direct Interactive Advisory */}
        <section className="lg:col-span-7 space-y-4">
          {/* Active Report or Professional Welcome Card */}
          {current ? (
            <div className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-700">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Báo cáo đánh giá chuyên môn</h3>
                  <p className="text-xs text-slate-500">Cập nhật lúc: {new Date(current.createdAt).toLocaleTimeString('vi-VN')} · {new Date(current.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>

              <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700 whitespace-pre-wrap rounded-xl bg-slate-50/60 p-4 border border-slate-100">
                {presentAssistantText('CAREER_CHAT', current.report ?? current.result?.report ?? '')}
              </div>

              {current.findings && current.findings.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Phát hiện & Khuyến nghị quan trọng
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {current.findings.map((finding) => {
                      const isWarn = finding.severity === 'warning';
                      const isPos = finding.severity === 'positive';
                      return (
                        <article
                          key={finding.title}
                          className={`rounded-xl border p-3 space-y-1 ${
                            isWarn
                              ? 'border-amber-200 bg-amber-50/50 text-amber-950'
                              : isPos
                              ? 'border-teal-200 bg-teal-50/50 text-teal-950'
                              : 'border-slate-200 bg-slate-50/50 text-slate-900'
                          }`}
                        >
                          <h5 className="font-bold text-xs flex items-center gap-1.5">
                            {isWarn ? '⚠️' : isPos ? '✨' : '📌'} {finding.title}
                          </h5>
                          <p className="text-xs text-slate-600 leading-snug">{finding.description}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
                  <Compass size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Quy trình tư vấn hướng nghiệp</h3>
                  <p className="text-xs text-slate-500">Hệ thống phân tích độc lập dựa trên 3 trụ cột dữ liệu chính</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
                    <CheckCircle size={14} className="text-teal-600" />
                    <span>1. Học lực thực tế</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Điểm số học kỳ và thi thử CBT của từng môn học trên lớp.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
                    <CheckCircle size={14} className="text-teal-600" />
                    <span>2. Dữ liệu tuyển sinh</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Điểm chuẩn và tổ hợp xét tuyển chính thức của các trường đại học.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
                    <CheckCircle size={14} className="text-teal-600" />
                    <span>3. Lộ trình cải thiện</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Đề xuất môn học cần bứt phá để nâng cao xác suất trúng tuyển.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Advisory Chat Thread */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-teal-700" />
                <h3 className="text-sm font-bold text-slate-900">Hỏi đáp trực tiếp với Ban tư vấn</h3>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {STARTER_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void sendChatMessage(q)}
                  className="rounded-full border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-900 transition-all text-left"
                >
                  💡 {q}
                </button>
              ))}
            </div>

            <ChatThread
              messages={chat}
              sending={chatSending}
              onSend={sendChatMessage}
              placeholder="Đặt câu hỏi về ngành học, khối thi, điểm chuẩn…"
              submitLabel="Gửi câu hỏi"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
