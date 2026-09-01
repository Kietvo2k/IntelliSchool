import { FormEvent, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { presentAssistantText } from '../../lib/present-assistant.js';
import { DURATION, EASE_OUT } from '../../lib/motion.js';
import { AssistantRichText } from './AssistantRichText.js';

export interface ChatBubble {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations?: Array<{ documentTitle: string; snippet: string; score: number }>;
}

export function ChatThread({
  messages,
  sending,
  notice,
  onSend,
  placeholder = 'Nhập tin nhắn…',
  submitLabel = 'Gửi',
}: {
  messages: ChatBubble[];
  sending: boolean;
  notice?: string;
  onSend: (text: string) => Promise<void> | void;
  placeholder?: string;
  submitLabel?: string;
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
    <div className="chat-thread">
      <div className="chat-thread-log" ref={scroller} role="log" aria-live="polite">
        {messages.length === 0 && <p className="muted-copy">Chưa có tin. Hãy bắt đầu cuộc trò chuyện.</p>}
        {messages.map((item) => (
          <motion.article
            key={item.id}
            className={`chat-bubble ${item.role === 'USER' ? 'is-user' : 'is-assistant'}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
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
      </div>
      {notice && <p className="form-message" role="status">{notice}</p>}
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
        <motion.button className="button button-primary" type="submit" disabled={sending} whileTap={reduce ? undefined : { scale: 0.97 }}>
          {sending ? 'Đang gửi…' : submitLabel}
        </motion.button>
      </form>
    </div>
  );
}
