import { Worker } from 'node:worker_threads';

const MAX_CODE_CHARS = 8_000;
const DEFAULT_TIMEOUT_MS = 3_000;

export async function runSandboxedJs(code: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{ stdout: string; error?: string }> {
  const source = code.trim();
  if (!source) return { stdout: '', error: 'Chưa có mã để chạy.' };
  if (source.length > MAX_CODE_CHARS) return { stdout: '', error: 'Mã quá dài (tối đa 8000 ký tự).' };

  const workerSource = `
    const { parentPort } = require('node:worker_threads');
    const logs = [];
    const fakeConsole = {
      log: (...args) => { logs.push(args.map((item) => typeof item === 'string' ? item : String(item)).join(' ')); },
      info: (...args) => fakeConsole.log(...args),
      warn: (...args) => fakeConsole.log(...args),
      error: (...args) => fakeConsole.log(...args),
    };
    try {
      const fn = new Function('console', ${JSON.stringify(source)});
      const result = fn(fakeConsole);
      parentPort.postMessage({
        stdout: logs.join('\\n'),
        result: result === undefined || result === null ? '' : String(result),
      });
    } catch {
      parentPort.postMessage({ error: 'Không chạy được mã trong sandbox.' });
    }
  `;

  return new Promise((resolve) => {
    let settled = false;
    const worker = new Worker(workerSource, { eval: true, resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 16 } });
    const finish = (payload: { stdout: string; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(payload);
    };
    const timer = setTimeout(() => finish({ stdout: '', error: 'Hết thời gian 3 giây.' }), timeoutMs);
    worker.on('message', (message: { stdout?: string; result?: string; error?: string }) => {
      if (message.error) {
        finish({ stdout: '', error: 'Không chạy được mã trong sandbox.' });
        return;
      }
      const parts = [message.stdout, message.result].filter((item) => item && item.length > 0);
      finish({ stdout: parts.join('\n') });
    });
    worker.on('error', () => finish({ stdout: '', error: 'Không chạy được mã trong sandbox.' }));
    worker.on('exit', (code) => {
      if (!settled && code !== 0) finish({ stdout: '', error: 'Không chạy được mã trong sandbox.' });
    });
  });
}

export function extractJsCodeFence(message: string): string | null {
  const match = message.match(/```(?:js|javascript|ts|typescript)?\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() || null;
}
