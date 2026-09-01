import { FormEvent, useEffect, useState } from 'react';
import { ChatThread, type ChatBubble } from '../components/ui/ChatThread.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { presentAssistantText } from '../lib/present-assistant.js';

interface Agent { type: string; name: string; description: string }
interface Finding { title: string; description: string; severity: string }
interface Run {
  id: string;
  isFallback: boolean;
  createdAt: string;
  result?: { report?: string };
  report?: string;
  findings?: Finding[];
}

export function CareerAiPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [current, setCurrent] = useState<Run | null>(null);
  const [targetMajor, setTargetMajor] = useState('');
  const [compare, setCompare] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [chat, setChat] = useState<ChatBubble[]>([]);
  const [chatSession, setChatSession] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);

  async function reload() {
    const [agentData, runData] = await Promise.all([
      apiRequest<{ agents: Agent[] }>('/api/v1/career/ai/agents'),
      apiRequest<Run[]>('/api/v1/career/ai/runs'),
    ]);
    setAgents(agentData.agents ?? []);
    setRuns(runData ?? []);
  }

  useEffect(() => { void reload().catch((err) => { setError(true); setMessage(err instanceof ApiRequestError ? err.message : 'Chưa tải được phân tích AI.'); }); }, []);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    setSending(true); setMessage(''); setError(false);
    try {
      const result = await apiRequest<Run>('/api/v1/career/ai/analyze', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('career-ai'),
        body: {
          agentTypes: selected,
          targetMajor: targetMajor || undefined,
          mode: compare.trim() ? 'compare' : 'analyze',
          compareMajors: compare.trim() ? compare.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 3) : undefined,
        },
      });
      setCurrent(result);
      if (result.isFallback) {
        setError(true);
        setMessage(result.report ?? result.result?.report ?? 'Nhà trường chưa cấu hình AI.');
      }
      await reload();
    } catch (err) {
      setError(true);
      setMessage(err instanceof ApiRequestError ? err.message : 'Chưa thể phân tích.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Hướng nghiệp" title="Phân tích AI" lede="Mười chuyên gia hỗ trợ định hướng. Không trừ credit; trường TRIAL/ACTIVE dùng đủ tính năng." />
      {message && <p className={`form-message ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>{message}</p>}
      <form className="workspace-feature login-form" onSubmit={(event) => void analyze(event)}>
        <label htmlFor="targetMajor">Ngành quan tâm (để trống nếu đã có nguyện vọng/mục tiêu)</label>
        <input id="targetMajor" value={targetMajor} onChange={(event) => setTargetMajor(event.target.value)} />
        <label htmlFor="compareMajors">So sánh 2–3 ngành (cách nhau bằng dấu phẩy)</label>
        <input id="compareMajors" value={compare} onChange={(event) => setCompare(event.target.value)} />
        <fieldset>
          <legend>Chọn tác vụ</legend>
          {agents.map((agent) => (
            <label key={agent.type} style={{ display: 'block', fontWeight: 400 }}>
              <input type="checkbox" checked={selected.includes(agent.type)} onChange={(event) => setSelected((currentSelected) => event.target.checked ? [...currentSelected, agent.type] : currentSelected.filter((item) => item !== agent.type))} />
              {agent.name} — {agent.description}
            </label>
          ))}
        </fieldset>
        <button className="button button-primary" type="submit" disabled={sending}>{sending ? 'Đang phân tích…' : 'Chạy phân tích'}</button>
      </form>
      {current && !current.isFallback && (
        <section className="workspace-feature">
          <h2>Báo cáo</h2>
          <p>{presentAssistantText('CAREER_CHAT', current.report ?? current.result?.report ?? '')}</p>
          <div className="compose-cards">
            {(current.findings ?? []).map((finding) => (
              <article key={finding.title} className={`finding-card is-${finding.severity === 'warning' ? 'warning' : finding.severity === 'positive' ? 'positive' : ''}`}>
                <h3>{finding.title}</h3>
                <p>{finding.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="workspace-feature">
        <h2>Chat phân tích</h2>
        <p className="muted-copy">Tư vấn tham khảo, không cam kết đỗ. Catalog có thể thiếu tổ hợp × năm 2024–2026.</p>
        <ChatThread
          messages={chat}
          sending={chatSending}
          onSend={async (text) => {
            setChatSending(true);
            setChat((currentChat) => [...currentChat, { id: `u-${Date.now()}`, role: 'USER', content: text }]);
            try {
              const reply = await apiRequest<{ sessionId: string; message: { id: string; content: string } }>('/api/v1/ai/chat', {
                method: 'POST',
                idempotencyKey: newIdempotencyKey('career-chat'),
                body: { message: text, sessionId: chatSession, purpose: 'CAREER_CHAT' },
              });
              setChatSession(reply.sessionId);
              setChat((currentChat) => [...currentChat, { id: reply.message.id, role: 'ASSISTANT', content: presentAssistantText('CAREER_CHAT', reply.message.content) }]);
            } catch (err) {
              setError(true);
              setMessage(err instanceof ApiRequestError ? err.message : 'Chưa chat được.');
            } finally {
              setChatSending(false);
            }
          }}
          placeholder="Ngành hoặc trường em đang nghĩ…"
          submitLabel="Gửi"
        />
      </section>
      <section className="workspace-feature">
        <h2>Lịch sử</h2>
        <ul>{runs.map((run) => <li key={run.id}>{new Date(run.createdAt).toLocaleString('vi-VN')}{run.isFallback ? ' · chưa cấu hình AI' : ''}</li>)}</ul>
      </section>
    </>
  );
}
