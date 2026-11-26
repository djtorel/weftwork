// story: e06s04
// A signal while the CLI is still reading stdin (security finding F4): the
// CLI answers killed and exits 6 at once, without waiting for stdin to close.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { cleanupTempDirs, makeTestRepo, isolatedEnv } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, '..', 'cli.ts');

/** Start the CLI with stdin left open, wait `waitMs`, send `signal`, and
 * give its exit code (null: ended by the signal) and stdout. */
async function signalAfter(signal: NodeJS.Signals, waitMs: number): Promise<{ code: number | null; stdout: string }> {
  const repo = makeTestRepo();
  const child = spawn(process.execPath, [cliPath], { cwd: repo, stdio: ['pipe', 'pipe', 'ignore'], env: isolatedEnv() });
  let stdout = '';
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });
  const closed = new Promise<number | null>((resolve) => child.on('close', resolve));
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const timer = setTimeout(() => child.kill('SIGKILL'), 4000);
  child.kill(signal);
  const code = await closed;
  clearTimeout(timer);
  return { code, stdout };
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  test(`F4 ${signal} with stdin still open exits 6 at once`, { timeout: 60000 }, async () => {
    // Stdin stays open: the CLI is still waiting for the request. A signal
    // sent before the listeners are installed gets the default action and
    // ends the process by signal (code null). That says nothing of the
    // handler, and start-up on a loaded machine can take longer than any
    // fixed wait, so such a run is tried again with a longer wait. Node itself
    // catches both signals from its start, so /proc cannot tell when ours are in.
    let run = { code: null as number | null, stdout: '' };
    for (const waitMs of [1500, 4000, 8000]) {
      run = await signalAfter(signal, waitMs);
      if (run.code !== null) break;
    }
    assert.equal(run.code, 6, 'the CLI exits with the killed code');
    const line = JSON.parse(run.stdout.trim()) as Record<string, unknown>;
    assert.equal(line.state, 'killed');
    assert.equal(line.done, false);
  });
}
