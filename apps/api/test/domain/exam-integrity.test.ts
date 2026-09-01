import { describe, expect, it } from 'vitest';
import { countConfirmedIntegrityStrikes, integrityStatus, shouldLockExam, classifyIntegrityIncident } from '../../src/domain/exam/integrity.js';

describe('exam integrity debounce', () => {
  it('ignores tab events that arrive within one second of the previous strike', () => {
    const count = countConfirmedIntegrityStrikes([
      { kind: 'visibilitychange', occurredAt: 1_000 },
      { kind: 'blur', occurredAt: 1_400 },
      { kind: 'visibilitychange', occurredAt: 2_200 },
    ]);
    expect(count).toBe(2);
  });

  it('locks after three confirmed strikes', () => {
    const events = [0, 2_000, 4_000].map((occurredAt) => ({ kind: 'visibilitychange', occurredAt }));
    expect(countConfirmedIntegrityStrikes(events)).toBe(3);
    expect(shouldLockExam(3)).toBe(true);
    expect(shouldLockExam(2)).toBe(false);
  });

  it('reports warnings remaining without treating a network failure as a strike', () => {
    expect(integrityStatus(0)).toEqual({ strikeCount: 0, warningsRemaining: 3, locked: false });
    expect(integrityStatus(2)).toEqual({ strikeCount: 2, warningsRemaining: 1, locked: false });
    expect(integrityStatus(3)).toEqual({ strikeCount: 3, warningsRemaining: 0, locked: true });
  });

  it('does not count an attachment picker event only when the server marks it exempt', () => {
    expect(classifyIntegrityIncident({
      kind: 'visibilitychange',
      occurredAt: 10_000,
      payload: { state: 'hidden', _serverAttachmentExemption: true },
    })).toEqual({ counted: false, reason: 'ATTACHMENT_PICKER' });
    expect(classifyIntegrityIncident({
      kind: 'visibilitychange',
      occurredAt: 10_000,
      payload: { state: 'hidden', reason: 'attachment_picker', attachmentExemption: true },
    })).toEqual({ counted: true, reason: 'FOCUS_LOSS' });
  });

  it('groups blur and fullscreen exit from one focus loss into one incident', () => {
    expect(classifyIntegrityIncident({
      kind: 'fullscreen_exit',
      occurredAt: 10_000,
      payload: { incidentId: 'focus-1', durationMs: 2500 },
    })).toEqual({ counted: false, reason: 'UNKNOWN' });
    expect(countConfirmedIntegrityStrikes([
      { kind: 'blur', occurredAt: 10_000 },
      { kind: 'visibilitychange', occurredAt: 10_100 },
      { kind: 'fullscreen_exit', occurredAt: 10_200 },
    ])).toBe(1);
  });

  it('does not let a client payload suppress a recomputed strike', () => {
    expect(countConfirmedIntegrityStrikes([
      { kind: 'visibilitychange', occurredAt: 10_000, payload: { attachmentExemption: true } },
    ])).toBe(1);
  });
});
