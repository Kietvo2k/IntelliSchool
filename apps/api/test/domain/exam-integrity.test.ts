import { describe, expect, it } from 'vitest';
import {
  closeIntegrityIncident,
  createIntegrityIncident,
  evaluateIntegrityIncident,
  classifyIntegritySignal,
  signalBelongsToIncident,
} from '../../src/domain/exam/integrity.js';

describe('server-authoritative exam integrity incidents', () => {
  it('keeps an incident in grace at 4.9 seconds', () => {
    const incident = createIntegrityIncident('incident-1', 0);

    expect(evaluateIntegrityIncident(incident, 4_900)).toMatchObject({ state: 'GRACE', remainingMs: 100, locked: false });
  });

  it('enters warning exactly at 5 seconds', () => {
    const incident = createIntegrityIncident('incident-1', 0);

    expect(evaluateIntegrityIncident(incident, 5_000)).toMatchObject({ state: 'WARNING', remainingMs: 25_000, locked: false });
  });

  it('keeps warning open at 29.9 seconds', () => {
    const incident = createIntegrityIncident('incident-1', 0);

    expect(evaluateIntegrityIncident(incident, 29_900)).toMatchObject({ state: 'WARNING', remainingMs: 100, locked: false });
  });

  it('locks exactly at 30 seconds without submitting anything', () => {
    const incident = createIntegrityIncident('incident-1', 0);

    expect(evaluateIntegrityIncident(incident, 30_000)).toMatchObject({ state: 'LOCKED', remainingMs: 0, locked: true });
  });

  it('deduplicates signals into the same open incident until restore', () => {
    const incident = createIntegrityIncident('incident-1', 0);

    expect(signalBelongsToIncident(incident, 1_000)).toBe(true);
    expect(signalBelongsToIncident(incident, 30_000)).toBe(true);
    const restored = closeIntegrityIncident(incident, 2_000, 'RESTORED');
    expect(signalBelongsToIncident(restored, 2_001)).toBe(false);
    expect(evaluateIntegrityIncident(restored, 10_000).state).toBe('ACTIVE');
  });

  it('classifies network and server-authorized attachment signals as exempt', () => {
    expect(classifyIntegritySignal({ kind: 'network_loss' })).toEqual({ counted: false, reason: 'NETWORK' });
    expect(classifyIntegritySignal({ kind: 'visibilitychange', serverExempted: true })).toEqual({ counted: false, reason: 'ATTACHMENT_PICKER' });
    expect(classifyIntegritySignal({ kind: 'visibilitychange', serverExempted: false })).toEqual({ counted: true, reason: 'FOCUS_LOSS' });
  });

  it('never trusts a client payload to grant an exemption', () => {
    expect(classifyIntegritySignal({ kind: 'visibilitychange', serverExempted: false, clientPayload: { _serverAttachmentExemption: true } })).toEqual({ counted: true, reason: 'FOCUS_LOSS' });
  });
});

