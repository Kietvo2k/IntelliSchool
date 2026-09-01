import { FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { presentAssistantText } from '../../lib/present-assistant.js';
import { DURATION, EASE_OUT } from '../../lib/motion.js';
import type { ChatBubble } from './ChatThread.js';
import { AssistantRichText } from './AssistantRichText.js';

export interface ChatSessionItem {
  id: string;
  title: string;
  updatedAt?: string | null;
  status?: string;
}

export type ChatReasoningMode = 'STANDARD' | 'THINKING';
export type ChatSourceMode = 'AUTO' | 'SCHOOL_LIBRARY' | 'MY_UPLOADS' | 'SELECTED';
export interface ChatAttachment { id: string; name: string; status?: 'UPLOADING' | 'READY' | 'FAILED'; }

export function ChatShell({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  messages,
  sending,
  notice,
  onSend,
  placeholder = 'Nhập tin nhắn…',
  submitLabel = 'Gửi',
  contextSlot,
  banner,
  footerNote,
  toolBlocks,
  reasoningMode = 'STANDARD',
  agentic = false,
  sourceMode = 'AUTO',
  onReasoningModeChange,
  onAgenticChange,
  onSourceModeChange,
  onAttachFile,
  attachments = [],
}: {
  sessions?: ChatSessionItem[];
  currentSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onNewSession?: () => void;
  messages: ChatBubble[];
  sending: boolean;
  notice?: string;
  onSend: (text: string) => Promise<void> | void;
  placeholder?: string;
  submitLabel?: string;
  contextSlot?: ReactNode;
  banner?: ReactNode;
  footerNote?: ReactNode;
  toolBlocks?: ReactNode;
  reasoningMode?: ChatReasoningMode;
  agentic?: boolean;
  sourceMode?: ChatSourceMode;
  onReasoningModeChange?: (value: ChatReasoningMode) => void;
  onAgenticChange?: (value: boolean) => void;
  onSourceModeChange?: (value: ChatSourceMode) => void;
  onAttachFile?: (file: File) => Promise<void> | void;
  attachments?: ChatAttachment[];
}) {
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [messages.length, sending, reduce]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    await onSend(text);
  }

  return (
    <div className="chat-shell">
      {sessions && (
        <aside className="chat-shell-sessions" aria-label="Phiên trò chuyện">
          <div className="chat-shell-sessions-head">
            <p className="eyebrow">Phiên</p>
            {onNewSession && <button type="button" className="button button-quiet" onClick={onNewSession}>Phiên mới</button>}
          </div>
          {sessions.length === 0 && <p className="muted-copy">Chưa có phiên lưu.</p>}
          <ul>
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className={`chat-session-btn${session.id === currentSessionId ? ' is-active' : ''}`}
                  onClick={() => onSelectSession?.(session.id)}
                >
                  <strong>{session.title || 'Cuộc trò chuyện'}</strong>
                  {session.updatedAt && <small>{new Date(session.updatedAt).toLocaleString('vi-VN')}</small>}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <div className="chat-shell-main">
        {banner}
        {contextSlot}
        {(onReasoningModeChange || onAgenticChange || onSourceModeChange) && (
          <div className="chat-mode-toolbar" aria-label="Chế độ AI">
            <span className="chat-mode-label">Chế độ</span>
            {onReasoningModeChange && (
              <div className="chat-mode-segment" role="group" aria-label="Mức suy luận">
                <button type="button" className={reasoningMode === 'STANDARD' ? 'is-active' : ''} aria-pressed={reasoningMode === 'STANDARD'} onClick={() => onReasoningModeChange('STANDARD')}>Tiêu chuẩn</button>
                <button type="button" className={reasoningMode === 'THINKING' ? 'is-active' : ''} aria-pressed={reasoningMode === 'THINKING'} onClick={() => onReasoningModeChange('THINKING')}>Thinking</button>
              </div>
            )}
            {onAgenticChange && (
              <button type="button" className={`chat-mode-toggle${agentic ? ' is-active' : ''}`} aria-pressed={agentic} onClick={() => onAgenticChange(!agentic)}>Agentic</button>
            )}
            {onSourceModeChange && (
              <label className="chat-source-select">Nguồn
                <select value={sourceMode} onChange={(event) => onSourceModeChange(event.target.value as ChatSourceMode)}>
                  <option value="AUTO">Tự động</option>
                  <option value="SCHOOL_LIBRARY">Nguồn thư viện</option>
                  <option value="MY_UPLOADS">Tài liệu của em</option>
                  <option value="SELECTED">Đã chọn</option>
                </select>
              </label>
            )}
          </div>
        )}
        <div className="chat-thread-log" ref={scroller} role="log" aria-live="polite">
          {messages.length === 0 && <p className="muted-copy">Chưa có tin. Hãy bắt đầu cuộc trò chuyện.</p>}
          {messages.map((item) => (
            <motion.article
              key={item.id}
              className={`chat-bubble ${item.role === 'USER' ? 'is-user' : 'is-assistant'}`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.fast, ease: EASE_OUT }}
            >
              {item.role === 'ASSISTANT' ? <AssistantRichText content={presentAssistantText(undefined, item.content)} /> : <p>{item.content}</p>}
              {item.citations && item.citations.length > 0 && (
                <ul className="chat-citations">
                  {item.citations.map((citation, index) => (
                    <li key={`${item.id}-${index}`}><strong>[{index + 1}]</strong> {citation.documentTitle}<br /><small>{citation.snippet}</small></li>
                  ))}
                </ul>
              )}
            </motion.article>
          ))}
          {sending && (
            <p className="chat-typing" role="status">
              <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
              Đang soạn…
            </p>
          )}
          {toolBlocks}
        </div>
        {notice && <p className="form-message" role="status">{notice}</p>}
        {footerNote}
        <form className="chat-composer" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor="chat-message">Tin nhắn</label>
          <textarea
            id="chat-message"
            name="message"
            rows={2}
            maxLength={4000}
            required
            placeholder={placeholder}
            disabled={sending}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {onAttachFile && (
            <>
              <label className="chat-attach-button" htmlFor="chat-attachment">Đính kèm tài liệu</label>
              <input id="chat-attachment" className="sr-only" type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.mp4" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onAttachFile(file); event.currentTarget.value = ''; }} />
            </>
          )}
          <motion.button className="button button-primary" type="submit" disabled={sending} whileTap={reduce ? undefined : { scale: 0.97 }}>
            {sending ? 'Đang gửi…' : submitLabel}
          </motion.button>
        </form>
        {attachments.length > 0 && <ul className="chat-attachments" aria-label="Tài liệu đính kèm">{attachments.map((attachment) => <li key={attachment.id}>{attachment.name} · {attachment.status === 'UPLOADING' ? 'Đang tải' : attachment.status === 'FAILED' ? 'Lỗi' : 'Đã sẵn sàng'}</li>)}</ul>}
      </div>
    </div>
  );
}
