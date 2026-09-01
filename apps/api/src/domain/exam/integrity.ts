/** Đếm sự kiện chuyển tab/rời trang sau debounce, để tránh nhầm 1 lần thành nhiều strike. */

export const TAB_SWITCH_KINDS = new Set(['visibilitychange']);
export const INTEGRITY_DEBOUNCE_MS = 1_000;
export const INTEGRITY_LOCK_AFTER = 3;

export interface IntegrityEvent {
  kind: string;
  occurredAt: number;
  payload?: Record<string, unknown>;
}

export type IntegrityIncidentReason = 'ATTACHMENT_PICKER' | 'NETWORK' | 'FOCUS_LOSS' | 'SHORT_FULLSCREEN_EXIT' | 'PROHIBITED_ACTION' | 'UNKNOWN';

export interface IntegrityIncidentClassification {
  counted: boolean;
  reason: IntegrityIncidentReason;
}

/**
 * Classifies a browser signal before it can affect the server-side strike count.
 * Client-provided reasons are only hints; the API must still authorize any
 * attachment exemption before accepting it.
 */
export function classifyIntegrityIncident(event: IntegrityEvent): IntegrityIncidentClassification {
  const payload = event.payload ?? {};
  // Only a server-set marker can exempt a focus event. Client payloads are untrusted
  // and must never be able to turn a real tab switch into a non-incident.
  if (payload._serverAttachmentExemption === true) {
    return { counted: false, reason: 'ATTACHMENT_PICKER' };
  }
  if (event.kind === 'network_loss' || event.kind === 'heartbeat_timeout') {
    return { counted: false, reason: 'NETWORK' };
  }
  if (event.kind === 'fullscreen_exit' && typeof payload.durationMs === 'number' && payload.durationMs < 2_000) {
    return { counted: false, reason: 'SHORT_FULLSCREEN_EXIT' };
  }
  if (TAB_SWITCH_KINDS.has(event.kind)) return { counted: true, reason: 'FOCUS_LOSS' };
  if (event.kind === 'clipboard' || event.kind === 'contextmenu' || event.kind === 'devtools') {
    return { counted: true, reason: 'PROHIBITED_ACTION' };
  }
  return { counted: false, reason: 'UNKNOWN' };
}

export function countConfirmedIntegrityStrikes(
  events: readonly IntegrityEvent[],
  debounceMs = INTEGRITY_DEBOUNCE_MS,
): number {
  const relevant = events
    .filter((event) => classifyIntegrityIncident(event).counted)
    .slice()
    .sort((left, right) => left.occurredAt - right.occurredAt);
  let count = 0;
  let lastAccepted = Number.NEGATIVE_INFINITY;
  for (const event of relevant) {
    if (event.occurredAt - lastAccepted < debounceMs) continue;
    count += 1;
    lastAccepted = event.occurredAt;
  }
  return count;
}

export function shouldLockExam(strikeCount: number, lockAfter = INTEGRITY_LOCK_AFTER): boolean {
  return strikeCount >= lockAfter;
}

export function integrityStatus(strikeCount: number, lockAfter = INTEGRITY_LOCK_AFTER): { strikeCount: number; warningsRemaining: number; locked: boolean } {
  const normalized = Math.max(0, Math.floor(Number.isFinite(strikeCount) ? strikeCount : 0));
  return {
    strikeCount: normalized,
    warningsRemaining: Math.max(0, lockAfter - normalized),
    locked: shouldLockExam(normalized, lockAfter),
  };
}
