import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, allowFailure = false) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', env: process.env });
  if (!allowFailure && (result.status ?? 1) !== 0) throw new Error(`${command} ${args.join(' ')} failed with status ${result.status ?? 1}`);
  return result.status ?? 1;
}

let exitCode = 1;
try {
  run(npmCommand, ['run', 'test:stack:down']);
  run(npmCommand, ['run', 'test:stack:up']);
  run(npmCommand, ['run', 'verify']);
  run(npmCommand, ['run', 'test:integration:isolated']);
  run(process.execPath, ['-e', "const fs=require('node:fs'); const e=JSON.parse(fs.readFileSync('docs/prompt-evals/ai-runtime-production-2026-09-02.json','utf8')); if(e.cases.length<12||e.cases.length>20) process.exit(1); console.log('AI eval set: '+e.cases.length+' cases')"]);
  process.env.AI_LIVE_REQUIRED = 'true';
  run(process.execPath, ['--env-file=.env', 'node_modules/vitest/vitest.mjs', 'run', 'apps/api/test/ai-provider.live.test.ts']);
  for (const testName of ['grounded chat', 'teacher compose', 'career analysis', 'Thinking']) {
    run(process.execPath, ['--env-file=.env', 'scripts/with-test-env.mjs', 'npm', 'run', 'test', '-w', '@smart-path/api', '--', '--maxWorkers=1', '--no-file-parallelism', '--hookTimeout=300000', 'test/ai-runtime.live.integration.test.ts', '-t', testName]);
  }
  // Build app-test from the current worktree so E2E never runs a stale image.
  run(npmCommand, ['run', 'test:e2e:stack:build']);
  run('node', ['scripts/with-test-env.mjs', 'npm', 'run', 'test:e2e:browser', '-w', '@smart-path/web']);
  run(npmCommand, ['audit', '--audit-level=high']);
  run(npmCommand, ['run', 'check:bundle']);
  run('git', ['diff', '--check']);
  exitCode = 0;
} finally {
  run(npmCommand, ['run', 'test:stack:down'], true);
}

process.exit(exitCode);
