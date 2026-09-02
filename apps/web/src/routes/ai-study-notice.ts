interface AiStudyReplyNotice {
  executionMode: 'MODEL' | 'UNAVAILABLE';
  notice?: string;
  provider?: string | null;
  usedModel?: string | null;
  requestId?: string;
}

export function visibleAiStudyNotice(reply: AiStudyReplyNotice): string {
  return reply.notice?.trim() ?? '';
}
