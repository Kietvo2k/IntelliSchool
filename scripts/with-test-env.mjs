import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

for (const line of readFileSync(new URL('../.env.test', import.meta.url), 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const separator = trimmed.indexOf('=');
  if (separator < 1) throw new Error(`Invalid .env.test line: ${trimmed}`);
  const key = trimmed.slice(0, separator);
  if (!(key in process.env)) process.env[key] = trimmed.slice(separator + 1);
}

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Usage: node scripts/with-test-env.mjs <command> [...args]');
const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', env: process.env });
process.exit(result.status ?? 1);
