import type { ChatReasoningMode, ChatSourceMode } from '../components/ui/ChatShell.js';

export const STUDY_CHAT_DEFAULTS: {
  reasoningMode: ChatReasoningMode;
  agentic: boolean;
  sourceMode: ChatSourceMode;
} = {
  reasoningMode: 'STANDARD',
  agentic: true,
  sourceMode: 'AUTO',
};
