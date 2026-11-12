// story: e06s04
// A signal while the CLI is still reading stdin (security finding F4): the
// CLI answers killed and exits 6 at once, without waiting for stdin to close.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { cleanupTempDirs, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const cliPath = join(import.meta.dirname, 'cli.ts');

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  test(`F4 ${signal} with stdin still open exits 6 at once`, { timeout: 10000 }, async () => {
    const repo = makeTestRepo();
    const child = spawn(process.execPath, [cliPath], { cwd: repo, stdio: ['pipe', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    const closed = new Promise<number | null>((resolve) => child.on('close', resolve));
    // Stdin stays open: the CLI is still waiting for the request.
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    await new Promise((resolve) => setTimeout(resolve, 300));
    child.kill(signal);
    const code = await closed;
    clearTimeout(timer);
    assert.equal(code, 6, 'the CLI exits with the killed code');
    const line = JSON.parse(stdout.trim()) as Record<string, unknown>;
    assert.equal(line.state, 'killed');
    assert.equal(line.done, false);
  });
}
