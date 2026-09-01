import { describe, expect, it } from 'vitest';
import { createIdempotentAction } from './idempotent-action.js';

describe('idempotent action', () => {
  it('rejects concurrent duplicate submissions', () => {
    const action = createIdempotentAction('class', (prefix) => `${prefix}-1`);
    expect(action.begin({ code: '12A1' })).toEqual({ key: 'class-1' });
    expect(action.begin({ code: '12A1' })).toBeNull();
  });

  it('reuses the same key after a failed request and rotates after success', () => {
    let count = 0;
    const action = createIdempotentAction('bank', (prefix) => `${prefix}-${++count}`);
    const input = { name: 'Toán 12' };
    expect(action.begin(input)?.key).toBe('bank-1');
    action.end(input, false);
    expect(action.begin(input)?.key).toBe('bank-1');
    action.end(input, true);
    expect(action.begin(input)?.key).toBe('bank-2');
  });
});
