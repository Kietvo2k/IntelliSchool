import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useSession } from '../lib/SessionContext.js';
import { createIdempotentAction } from '../lib/idempotent-action.js';

interface AiModel { id: string; provider: string; modelName: string; tier: string; isEnabled: boolean; monthlyCostLimitVnd: number | null; inputVndPer1k: number; outputVndPer1k: number; }
interface UsageSummary { monthCostVnd: number; monthRequests: number; monthlyCostLimitVnd: number | null; }
interface ProviderHealth { configured: boolean; reachable: boolean; provider: string | null; model: string | null; capabilities: { chat: boolean; embeddings: boolean; structuredOutput: boolean }; checkedAt: string; reason?: string; requestId: string; }

export function AiSettingsPage() {
  const { user } = useSession();
  const isOwner = user.role === 'SCHOOL_OWNER';
  const [models, setModels] = useState<AiModel[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const modelAction = useRef(createIdempotentAction('ai-model', newIdempotencyKey)).current;

  async function reload() {
    try {
      const [modelData, usageData] = await Promise.all([
        apiRequest<AiModel[]>('/api/v1/ai/models'),
        apiRequest<UsageSummary>('/api/v1/ai/usage'),
      ]);
      setModels(modelData ?? []);
      setUsage(usageData);
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải cấu hình AI.');
    }
  }

  useEffect(() => { void reload(); }, []);

  async function addModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = {
      provider: String(form.get('provider') ?? ''),
      modelName: String(form.get('modelName') ?? ''),
      tier: String(form.get('tier') ?? 'CLOUD'),
      endpointUrl: String(form.get('endpointUrl') ?? '') || null,
      isEnabled: true,
      monthlyCostLimitVnd: Number(form.get('monthlyCostLimitVnd') ?? 0) || null,
      inputVndPer1k: Number(form.get('inputVndPer1k') ?? 0),
      outputVndPer1k: Number(form.get('outputVndPer1k') ?? 0),
    };
    const ticket = modelAction.begin(input);
    if (!ticket) return;
    setState('sending');
    setMessage('');
    try {
      await apiRequest('/api/v1/ai/models', {
        method: 'POST',
        idempotencyKey: ticket.key,
        body: input,
      });
      setState('idle');
      setMessage('Đã lưu model AI. Khóa API chỉ đặt trong biến môi trường máy chủ, không lưu trong hệ thống.');
      formElement.reset();
      modelAction.end(input, true);
      void reload().catch(() => setMessage('Đã lưu model AI nhưng chưa làm mới được danh sách.'));
      setStep(2);
    } catch (error) {
      modelAction.end(input, false);
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu model AI.');
    }
  }

  async function checkHealth() {
    setHealth(null);
    try {
      setHealth(await apiRequest<ProviderHealth>('/api/v1/ai/health'));
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Không kiểm tra được.');
    }
  }

  return (
    <>
      <PageHeader eyebrow="Soạn bài AI" title="Cấu hình AI" lede="Khai báo model AI (OpenAI-compatible hoặc Anthropic) và hạn mức chi phí theo trường. Khóa API luôn nằm trong biến môi trường máy chủ." />
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role={state === 'error' ? 'alert' : 'status'}>{message}</p>}

      <div className="wizard-container">
        <nav className="wizard-steps" aria-label="Các bước cấu hình AI">
          <button
            type="button"
            className={`wizard-step-btn ${step === 1 ? 'is-active' : step > 1 ? 'is-completed' : ''}`}
            onClick={() => setStep(1)}
            aria-current={step === 1 ? 'step' : undefined}
          >
            <span className="wizard-step-badge">{step > 1 ? <Check size={14} aria-hidden="true" /> : '1'}</span>
            <span>1. Kiểm tra kết nối & Sử dụng</span>
          </button>
          <div className="wizard-step-connector" aria-hidden="true" />
          <button
            type="button"
            className={`wizard-step-btn ${step === 2 ? 'is-active' : step > 2 ? 'is-completed' : ''}`}
            onClick={() => setStep(2)}
            aria-current={step === 2 ? 'step' : undefined}
          >
            <span className="wizard-step-badge">{step > 2 ? <Check size={14} aria-hidden="true" /> : '2'}</span>
            <span>2. Danh sách model</span>
          </button>
          {isOwner && (
            <>
              <div className="wizard-step-connector" aria-hidden="true" />
              <button
                type="button"
                className={`wizard-step-btn ${step === 3 ? 'is-active' : ''}`}
                onClick={() => setStep(3)}
                aria-current={step === 3 ? 'step' : undefined}
              >
                <span className="wizard-step-badge">3</span>
                <span>3. Thêm model</span>
              </button>
            </>
          )}
        </nav>

        {step === 1 && (
          <article className="wizard-panel">
            <h2>Bước 1: Tình trạng kết nối & Chi phí sử dụng</h2>
            {usage ? (
              <div className="mb-4">
                <p className="text-lg">
                  <strong>{usage.monthRequests}</strong> lượt yêu cầu · <strong>{usage.monthCostVnd.toLocaleString('vi-VN')}đ</strong>
                  {usage.monthlyCostLimitVnd !== null ? ` / hạn mức ${usage.monthlyCostLimitVnd.toLocaleString('vi-VN')}đ` : ' · không giới hạn hạn mức'}
                </p>
              </div>
            ) : (
              <p className="text-muted mb-4">Chưa có dữ liệu sử dụng tháng này.</p>
            )}
            <div className="flex items-center gap-3">
              <button type="button" className="button button-quiet" onClick={() => void checkHealth()}>Kiểm tra kết nối AI</button>
              {health && (
                <div role="status" className={`text-xs font-bold ${health.reachable ? 'text-[var(--green)]' : 'text-amber-700'}`}>
                  <p className="m-0">{health.reachable ? 'Reachable' : 'Unavailable'} · {health.provider ?? 'chưa cấu hình'} · {health.model ?? 'chưa có model'}</p>
                  <small>{health.configured ? 'configured' : 'not configured'} · chat {health.capabilities.chat ? '✓' : '—'} · embeddings {health.capabilities.embeddings ? '✓' : '—'} · structured {health.capabilities.structuredOutput ? '✓' : '—'} · checked {new Date(health.checkedAt).toLocaleTimeString('vi-VN')}</small>
                </div>
              )}
            </div>
            <div className="wizard-footer">
              <div />
              <button type="button" className="button button-primary" onClick={() => setStep(2)}>
                Xem danh sách model <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </article>
        )}

        {step === 2 && (
          <article className="wizard-panel">
            <h2>Bước 2: Model đã cấu hình</h2>
            {models.length === 0 ? <p className="workspace-state">Chưa có model nào.</p> : (
              <ul className="workspace-list">
                {models.map((model) => (
                  <li key={model.id} className="workspace-list-item">
                    <div>
                      <strong>{model.modelName}</strong> · {model.provider} · {model.tier}
                      <br />
                      <small>{model.isEnabled ? 'Đang bật' : 'Đã tắt'} · giá {model.inputVndPer1k}/{model.outputVndPer1k}đ per 1k · hạn mức {model.monthlyCostLimitVnd !== null ? `${model.monthlyCostLimitVnd.toLocaleString('vi-VN')}đ` : 'không giới hạn'}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="wizard-footer">
              <button type="button" className="button button-quiet" onClick={() => setStep(1)}>
                <ArrowLeft size={16} aria-hidden="true" /> Quay lại kiểm tra
              </button>
              {isOwner && (
                <button type="button" className="button button-primary" onClick={() => setStep(3)}>
                  Thêm model mới <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </article>
        )}

        {step === 3 && isOwner && (
          <article className="wizard-panel">
            <h2>Bước 3: Thêm model</h2>
            <form className="login-form" onSubmit={addModel}>
              <label htmlFor="aiProvider">Nhà cung cấp</label>
              <select id="aiProvider" name="provider"><option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic</option></select>
              <label htmlFor="aiModelName">Tên model</label>
              <input id="aiModelName" name="modelName" required placeholder="gpt-4o-mini hoặc claude-sonnet" />
              <label htmlFor="aiTier">Cấp</label>
              <select id="aiTier" name="tier"><option value="CLOUD">CLOUD</option><option value="LOCAL_QUALITY">LOCAL_QUALITY</option><option value="LOCAL_FAST">LOCAL_FAST</option></select>
              <label htmlFor="aiEndpoint">Endpoint (tùy chọn)</label>
              <input id="aiEndpoint" name="endpointUrl" placeholder="https://modelapi.vn/v1" />
              <label htmlFor="aiLimit">Hạn mức tháng (VND, 0 = không giới hạn)</label>
              <input id="aiLimit" name="monthlyCostLimitVnd" type="number" min={0} defaultValue={0} />
              <label htmlFor="aiInput">Giá input / 1k token (VND)</label>
              <input id="aiInput" name="inputVndPer1k" type="number" min={0} defaultValue={0} />
              <label htmlFor="aiOutput">Giá output / 1k token (VND)</label>
              <input id="aiOutput" name="outputVndPer1k" type="number" min={0} defaultValue={0} />
              <div className="wizard-footer">
                <button type="button" className="button button-quiet" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Quay lại danh sách
                </button>
                <button className="button button-primary" type="submit" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Đang lưu…' : 'Lưu model'}
                </button>
              </div>
            </form>
          </article>
        )}
      </div>
    </>
  );
}
