export const INTEGRITY_GRACE_MS = 5_000;
export const INTEGRITY_LOCK_MS = 30_000;
export const INTEGRITY_DEBOUNCE_MS = 1_000;
export const INTEGRITY_LOCK_AFTER = 3;

export type IntegrityState = 'ACTIVE' | 'GRACE' | 'WARNING' | 'LOCKED';
export type IntegrityIncidentReason = 'ATTACHMENT_PICKER' | 'NETWORK' | 'FOCUS_LOSS' | 'PROHIBITED_ACTION' | 'UNKNOWN';

export interface IntegrityIncident {
  incidentId: string;
  startedAt: number;
  lastSignalAt: number;
  graceEndsAt: number;
  lockAt: number;
  state: Exclude<IntegrityState, 'ACTIVE'>;
  closedAt: number | null;
  closeReason: string | null;
}

export interface IntegritySignalClassification {
  counted: boolean;
  reason: IntegrityIncidentReason;
}

export interface IntegrityEvaluation {
  state: IntegrityState;
  graceEndsAt: number;
  lockAt: number;
  remainingMs: number;
  locked: boolean;
  closedAt: number | null;
}

export function createIntegrityIncident(incidentId: string, serverNow: number): IntegrityIncident {
  return {
    incidentId,
    startedAt: serverNow,
    lastSignalAt: serverNow,
    graceEndsAt: serverNow + INTEGRITY_GRACE_MS,
    lockAt: serverNow + INTEGRITY_LOCK_MS,
    state: 'GRACE',
    closedAt: null,
    closeReason: null,
  };
}

export function evaluateIntegrityIncident(incident: IntegrityIncident, serverNow: number): IntegrityEvaluation {
  if (incident.closedAt !== null) {
    return { state: 'ACTIVE', graceEndsAt: incident.graceEndsAt, lockAt: incident.lockAt, remainingMs: 0, locked: false, closedAt: incident.closedAt };
  }
  if (serverNow >= incident.lockAt) {
    return { state: 'LOCKED', graceEndsAt: incident.graceEndsAt, lockAt: incident.lockAt, remainingMs: 0, locked: true, closedAt: null };
  }
  if (serverNow >= incident.graceEndsAt) {
    return { state: 'WARNING', graceEndsAt: incident.graceEndsAt, lockAt: incident.lockAt, remainingMs: Math.max(0, incident.lockAt - serverNow), locked: false, closedAt: null };
  }
  return { state: 'GRACE', graceEndsAt: incident.graceEndsAt, lockAt: incident.lockAt, remainingMs: Math.max(0, incident.graceEndsAt - serverNow), locked: false, closedAt: null };
}

export function signalBelongsToIncident(incident: IntegrityIncident, _serverNow: number): boolean {
  return incident.closedAt === null;
}

export function closeIntegrityIncident(incident: IntegrityIncident, serverNow: number, reason: string): IntegrityIncident {
  return { ...incident, state: 'GRACE', closedAt: serverNow, closeReason: reason, lastSignalAt: serverNow };
}

export function classifyIntegritySignal(input: { kind: string; serverExempted?: boolean; clientPayload?: Record<string, unknown> }): IntegritySignalClassification {
  if (input.serverExempted === true) return { counted: false, reason: 'ATTACHMENT_PICKER' };
  if (input.kind === 'network_loss' || input.kind === 'heartbeat_timeout') return { counted: false, reason: 'NETWORK' };
  if (input.kind === 'visibilitychange' || input.kind === 'blur' || input.kind === 'fullscreen_exit') return { counted: true, reason: 'FOCUS_LOSS' };
  if (input.kind === 'clipboard' || input.kind === 'contextmenu' || input.kind === 'devtools') return { counted: true, reason: 'PROHIBITED_ACTION' };
  return { counted: false, reason: 'UNKNOWN' };
}

// Compatibility helpers retained for non-state-machine callers during the migration.
export interface IntegrityEvent { kind: string; occurredAt: number; payload?: Record<string, unknown>; }
export interface IntegrityIncidentClassification { counted: boolean; reason: IntegrityIncidentReason | 'SHORT_FULLSCREEN_EXIT'; }

export function classifyIntegrityIncident(event: IntegrityEvent): IntegrityIncidentClassification {
  const result = classifyIntegritySignal({ kind: event.kind, clientPayload: event.payload });
  return result;
}

export function countConfirmedIntegrityStrikes(events: readonly IntegrityEvent[], debounceMs = INTEGRITY_DEBOUNCE_MS): number {
  const relevant = events.filter((event) => classifyIntegritySignal({ kind: event.kind }).counted).slice().sort((left, right) => left.occurredAt - right.occurredAt);
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
  return { strikeCount: normalized, warningsRemaining: Math.max(0, lockAfter - normalized), locked: shouldLockExam(normalized, lockAfter) };
}

