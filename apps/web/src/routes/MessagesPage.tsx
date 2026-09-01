import { useCallback, useEffect, useState } from 'react';
import { ChatThread, type ChatBubble } from '../components/ui/ChatThread.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useSession } from '../lib/SessionContext.js';

interface Thread { kind: 'CLASS' | 'DIRECT'; classId: string; peerId: string | null; label: string }
interface Channel {
  classId: string;
  className?: string;
  peerId: string | null;
  peerName: string | null;
  classes?: Array<{ classId: string; className: string }>;
  threads?: Thread[];
}
interface Person { id: string; displayName: string }
interface Message { id: string; senderId: string; senderName: string; body: string; createdAt: string }

export function MessagesPage() {
  const { user } = useSession();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [items, setItems] = useState<Message[]>([]);
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  const loadChannel = useCallback(async () => {
    try {
      const data = await apiRequest<Channel | null>('/api/v1/messages/channel');
      setChannel(data);
      setThreads(data?.threads ?? []);
      setActive((current) => current ?? data?.threads?.[0] ?? null);
    } catch (error) {
      setNotice(error instanceof ApiRequestError ? error.message : 'Chưa tải được kênh lớp.');
    }
  }, []);

  const loadThread = useCallback(async (thread: Thread) => {
    try {
      setItems(await apiRequest<Message[]>('/api/v1/messages', {
        query: { classId: thread.classId, peerId: thread.peerId ?? undefined, channelKind: thread.kind },
      }) ?? []);
    } catch (error) {
      setNotice(error instanceof ApiRequestError ? error.message : 'Chưa tải được tin nhắn.');
    }
  }, []);

  async function selectClass(classId: string, className: string) {
    try {
      const students = await apiRequest<Person[]>('/api/v1/students', { query: { classId } });
      const next: Thread[] = [
        { kind: 'CLASS', classId, peerId: null, label: `Kênh lớp · ${className}` },
        ...students.map((student) => ({ kind: 'DIRECT' as const, classId, peerId: student.id, label: student.displayName })),
      ];
      setThreads(next);
      setActive(next[0] ?? null);
    } catch (error) {
      setNotice(error instanceof ApiRequestError ? error.message : 'Chưa tải được danh sách lớp.');
    }
  }

  useEffect(() => { void loadChannel(); }, [loadChannel]);
  useEffect(() => {
    if (!active) return;
    void loadThread(active);
    const timer = window.setInterval(() => void loadThread(active), 5_000);
    return () => window.clearInterval(timer);
  }, [active, loadThread]);

  const bubbles: ChatBubble[] = items.map((item) => ({
    id: item.id,
    role: item.senderId === user.userId ? 'USER' : 'ASSISTANT',
    content: `${item.senderName}: ${item.body}`,
  }));

  async function send(text: string) {
    if (!active) { setNotice('Chọn một kênh trước.'); return; }
    setSending(true);
    try {
      await apiRequest('/api/v1/messages', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('msg'),
        body: { classId: active.classId, recipientId: active.kind === 'DIRECT' ? active.peerId : null, channelKind: active.kind, body: text },
      });
      await loadThread(active);
    } catch (error) {
      setNotice(error instanceof ApiRequestError ? error.message : 'Chưa gửi được tin.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Tin nhắn" title="Kênh lớp và 1-1" lede="Cột trái chọn kênh lớp hoặc trò chuyện trực tiếp. Tin mới hiện khi tải lại mỗi 5 giây." />
      {notice && <p className="form-message" role="status">{notice}</p>}
      {channel?.classes && channel.classes.length > 1 && (
        <label htmlFor="msgClass">Lớp
          <select id="msgClass" value={active?.classId ?? channel.classId} onChange={(event) => {
            const selected = channel.classes?.find((item) => item.classId === event.target.value);
            if (selected) void selectClass(selected.classId, selected.className);
          }}>
            {channel.classes.map((item) => <option key={item.classId} value={item.classId}>{item.className}</option>)}
          </select>
        </label>
      )}
      <div className="msg-layout">
        <nav className="msg-threads" aria-label="Các kênh">
          {threads.length === 0 && <p className="muted-copy" style={{ padding: '1rem' }}>Chưa có kênh. Học sinh cần được ghi danh lớp.</p>}
          {threads.map((thread) => (
            <button
              key={`${thread.kind}-${thread.classId}-${thread.peerId ?? 'class'}`}
              type="button"
              className={`msg-thread-btn${active?.kind === thread.kind && active.peerId === thread.peerId && active.classId === thread.classId ? ' is-current' : ''}`}
              onClick={() => setActive(thread)}
            >
              {thread.label}
            </button>
          ))}
        </nav>
        <div className="msg-pane">
          <ChatThread messages={bubbles} sending={sending} onSend={send} placeholder="Nhập tin nhắn…" submitLabel="Gửi" />
        </div>
      </div>
    </>
  );
}
