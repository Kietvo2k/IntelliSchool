import { describe, expect, it } from 'vitest';
import { parseClamAvResponse } from '../src/services/clamav-scanner.js';

describe('parseClamAvResponse', () => {
  it('recognizes a clean ClamAV response', () => {
    expect(parseClamAvResponse('stream: OK\n')).toBe('CLEAN');
  });

  it('recognizes a clean response terminated by a NUL byte', () => {
    expect(parseClamAvResponse('stream: OK\u0000')).toBe('CLEAN');
  });

  it('recognizes an infected ClamAV response', () => {
    expect(parseClamAvResponse('stream: Eicar-Signature FOUND\n')).toBe('INFECTED');
  });

  it('does not treat a scanner service error as a clean response', () => {
    expect(() => parseClamAvResponse('stream: Cannot connect to clamd ERROR\n')).toThrow('Cannot connect to clamd');
  });
});
