import { describe, expect, it } from 'vitest';
import { extractJsCodeFence, runSandboxedJs } from '../../src/domain/ai/sandbox.js';

describe('JS sandbox', () => {
  it('returns stdout without leaking a stack', async () => {
    const result = await runSandboxedJs('console.log(2 + 2)');
    expect(result.stdout).toContain('4');
    expect(result.error).toBeUndefined();
  });

  it('times out a tight loop without exposing internals', async () => {
    const result = await runSandboxedJs('while (true) {}', 800);
    expect(result.error).toBe('Hết thời gian 3 giây.');
    expect(JSON.stringify(result)).not.toMatch(/at |stack/i);
  });

  it('extracts a javascript fence', () => {
    expect(extractJsCodeFence('Xem:\n```js\n1+1\n```')).toBe('1+1');
  });
});
