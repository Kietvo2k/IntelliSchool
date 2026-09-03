import { FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Bot, FileUp, MessageSquarePlus, Paperclip, Send, Sparkles } from 'lucide-react';
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
export interface ChatAttachment {
  id: string;
  name: string;
  status?: 'UPLOADING' | 'READY' | 'FAILED';
}

const STARTER_PROMPTS = [
  { icon: '📐', text: 'Giải thích chi tiết khảo sát hàm số bậc ba' },
  { icon: '🔬', text: 'Tóm tắt các dạng bài tập Hóa học 12 thường gặp' },
  { icon: '📝', text: 'Gợi ý dàn ý phân tích tác phẩm ngữ văn' },
  { icon: '🎯', text: 'Tạo 5 câu hỏi trắc nghiệm ôn tập nhanh' },
];

export function ChatShell({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  messages,
  sending,
  notice,
  onSend,
  placeholder = 'Nhập câu hỏi học tập…',
  submitLabel = 'Gửi câu hỏi',
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

  function handlePromptClick(promptText: string) {
    setDraft(promptText);
  }

  return (
    <div className="chat-shell rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[600px] grid grid-cols-1 md:grid-cols-12">
      {sessions && (
        <aside className="chat-shell-sessions md:col-span-4 lg:col-span-3 border-r border-slate-100 bg-slate-50/60 p-3.5 flex flex-col justify-between" aria-label="Phiên trò chuyện">
          <div className="space-y-3">
            <div className="chat-shell-sessions-head flex items-center justify-between">
              <p className="eyebrow text-xs font-bold uppercase tracking-wider text-slate-500">Phiên trò chuyện</p>
              {onNewSession && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 transition-colors"
                  onClick={onNewSession}
                >
                  <MessageSquarePlus size={14} />
                  <span>Phiên mới</span>
                </button>
              )}
            </div>
            {sessions.length === 0 && (
              <p className="text-xs text-slate-400 italic py-4 text-center">Chưa có phiên lưu.</p>
            )}
            <ul className="space-y-1 overflow-y-auto max-h-[460px] pr-1">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className={`chat-session-btn w-full text-left p-2.5 rounded-xl transition-all ${
                      session.id === currentSessionId
                        ? 'bg-teal-700 text-white shadow-sm font-semibold'
                        : 'text-slate-700 hover:bg-slate-100/80 font-normal'
                    }`}
                    onClick={() => onSelectSession?.(session.id)}
                  >
                    <strong className="block text-xs truncate leading-snug">{session.title || 'Cuộc trò chuyện'}</strong>
                    {session.updatedAt && (
                      <small className={`block text-[10px] mt-0.5 ${session.id === currentSessionId ? 'text-teal-100' : 'text-slate-400'}`}>
                        {new Date(session.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(session.updatedAt).toLocaleDateString('vi-VN')}
                      </small>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-3 border-t border-slate-200/60 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles size={13} className="text-teal-600 shrink-0" />
            <span>AI học tập với tài liệu nhà trường</span>
          </div>
        </aside>
      )}

      <div className={`chat-shell-main flex flex-col justify-between p-4 sm:p-5 ${sessions ? 'md:col-span-8 lg:col-span-9' : 'md:col-span-12'}`}>
        <div className="space-y-3">
          {banner}
          {contextSlot}

          {/* Sleek Mode Toolbar */}
          {(onReasoningModeChange || onAgenticChange || onSourceModeChange) && (
            <div className="chat-mode-toolbar flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs" aria-label="Chế độ AI">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chat-mode-label font-bold text-slate-500 uppercase tracking-wider text-[11px]">Chế độ</span>
                {onReasoningModeChange && (
                  <div className="chat-mode-segment inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs" role="group" aria-label="Mức suy luận">
                    <button
                      type="button"
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                        reasoningMode === 'STANDARD' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      aria-pressed={reasoningMode === 'STANDARD'}
                      onClick={() => onReasoningModeChange('STANDARD')}
                    >
                      Tiêu chuẩn
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                        reasoningMode === 'THINKING' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      aria-pressed={reasoningMode === 'THINKING'}
                      onClick={() => onReasoningModeChange('THINKING')}
                    >
                      Thinking
                    </button>
                  </div>
                )}
                {onAgenticChange && (
                  <button
                    type="button"
                    className={`chat-mode-toggle rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                      agentic
                        ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    aria-pressed={agentic}
                    onClick={() => onAgenticChange(!agentic)}
                  >
                    Agentic
                  </button>
                )}
              </div>

              {onSourceModeChange && (
                <label className="chat-source-select flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <span>Nguồn</span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-600"
                    value={sourceMode}
                    onChange={(event) => onSourceModeChange(event.target.value as ChatSourceMode)}
                  >
                    <option value="AUTO">Tự động</option>
                    <option value="SCHOOL_LIBRARY">Nguồn thư viện</option>
                    <option value="MY_UPLOADS">Tài liệu của em</option>
                    <option value="SELECTED">Đã chọn</option>
                  </select>
                </label>
              )}
            </div>
          )}

          {/* Chat Messages Thread */}
          <div
            className="chat-thread-log overflow-y-auto space-y-4 pr-1 min-h-[260px] max-h-[380px]"
            ref={scroller}
            role="log"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="py-6 px-4 text-center space-y-4">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  <Bot size={28} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">Em muốn hỏi về chủ đề nào hôm nay?</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    AI trợ giảng ưu tiên tra cứu từ bài giảng SGK và tài liệu chính khóa của trường.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-w-lg mx-auto text-left">
                  {STARTER_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePromptClick(p.text)}
                      className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-700 hover:border-teal-500 hover:bg-teal-50/40 hover:text-teal-900 transition-all text-left"
                    >
                      <span className="text-sm">{p.icon}</span>
                      <span className="font-medium leading-snug">{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((item) => (
              <motion.article
                key={item.id}
                className={`chat-bubble ${item.role === 'USER' ? 'is-user' : 'is-assistant'}`}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE_OUT }}
              >
                {item.role === 'ASSISTANT' ? (
                  <AssistantRichText content={presentAssistantText(undefined, item.content)} />
                ) : (
                  <p className="whitespace-pre-wrap">{item.content}</p>
                )}
                {item.citations && item.citations.length > 0 && (
                  <ul className="chat-citations mt-2 pt-2 border-t border-slate-200/40 space-y-1 text-xs">
                    {item.citations.map((citation, index) => (
                      <li key={`${item.id}-${index}`} className="text-[11px] text-teal-800">
                        <strong>[{index + 1}]</strong> {citation.documentTitle}
                        <br />
                        <small className="text-slate-500 line-clamp-2">{citation.snippet}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.article>
            ))}

            {sending && (
              <p className="chat-typing flex items-center gap-2 text-xs text-slate-500 italic p-2" role="status">
                <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                <span>AI đang tìm tài liệu và soạn câu trả lời…</span>
              </p>
            )}
            {toolBlocks}
          </div>
        </div>

        {/* Bottom Composer Container */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          {notice && <p className="form-message text-xs py-2" role="status">{notice}</p>}
          {footerNote}

          <form className="chat-composer relative" onSubmit={(event) => void submit(event)}>
            <label className="sr-only" htmlFor="chat-message">Tin nhắn</label>
            <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white shadow-xs focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100 transition-all p-1.5">
              <textarea
                id="chat-message"
                name="message"
                rows={1}
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
                className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none min-h-[38px] max-h-[100px]"
              />

              <div className="flex items-center gap-1 shrink-0 pr-1">
                {onAttachFile && (
                  <>
                    <label
                      className="chat-attach-button grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition-colors"
                      htmlFor="chat-attachment"
                      title="Đính kèm tài liệu"
                      aria-label="Đính kèm tài liệu"
                    >
                      <span className="sr-only">Đính kèm tài liệu</span>
                      <Paperclip size={18} />
                    </label>
                    <input
                      id="chat-attachment"
                      className="sr-only"
                      type="file"
                      accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.mp4"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void onAttachFile(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </>
                )}

                <motion.button
                  className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-white shadow-xs hover:bg-teal-800 disabled:opacity-50 transition-colors"
                  type="submit"
                  disabled={sending || !draft.trim()}
                  whileTap={reduce ? undefined : { scale: 0.94 }}
                  title={submitLabel}
                >
                  <Send size={16} />
                </motion.button>
              </div>
            </div>
          </form>

          {attachments.length > 0 && (
            <ul className="chat-attachments flex flex-wrap gap-1.5 pt-1" aria-label="Tài liệu đính kèm">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800 border border-teal-100"
                >
                  <FileUp size={12} />
                  <span>{attachment.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
