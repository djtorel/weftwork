// story: e12s01
// Each detected command runs once, with a timeout, to check that it resolves:
// passed, failed (it ran and exited non-zero), missing (exit 126 or 127),
// timeout. A run command and a deploy or publish command never run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { checkCommands } from './detect-check.ts';
import type { FoundCommand } from './detect.ts';

const cwd = tmpdir();

async function statusOf(found: FoundCommand, timeoutMs = 20000) {
  const [checked] = await checkCommands([found], cwd, timeoutMs);
  return checked?.check;
}

test('AC-e12s01-07 a command that exits 0 passed, non-zero failed, not found is missing', async () => {
  assert.deepEqual(await statusOf({ kind: 'test', command: 'true', source: 'Makefile' }), { status: 'passed', exitCode: 0 });
  assert.deepEqual(await statusOf({ kind: 'lint', command: 'exit 3', source: 'Makefile' }), { status: 'failed', exitCode: 3 });
  assert.deepEqual(await statusOf({ kind: 'build', command: 'weftwork-no-such-command-xyz', source: 'Makefile' }), { status: 'missing', exitCode: 127 });
});

test('AC-e12s01-08 a command past the timeout is stopped and reported', async () => {
  const checked = await statusOf({ kind: 'test', command: 'sleep 5', source: 'Makefile' }, 200);
  assert.deepEqual(checked, { status: 'timeout', exitCode: null, why: 'stopped after 200 ms' });
});

test('AC-e12s01-09 run, deploy and publish commands are skipped, never run', async () => {
  const marker = `${cwd}/weftwork-detect-should-not-exist-${process.pid}`;
  const commands: FoundCommand[] = [
    { kind: 'run', command: `touch ${marker}`, source: 'package.json', body: 'vite' },
    { kind: 'build', command: 'npm run build', source: 'package.json', body: `touch ${marker} && npm publish` },
    { kind: 'test', command: 'make deploy-test', source: 'Makefile', body: `touch ${marker}` },
  ];
  const checked = await checkCommands(commands, cwd, 20000);
  assert.deepEqual(
    checked.map((found) => found.check.status),
    ['skipped', 'skipped', 'skipped'],
  );
  assert.match(checked[0]?.check.why ?? '', /does not exit/);
  assert.match(checked[1]?.check.why ?? '', /deploy or publish/);
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(marker), false);
});
