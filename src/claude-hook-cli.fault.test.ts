// story: e07s02
// The real Claude Code hook CLI under faults of its own (e07s02 AC-03 to
// AC-05, AC-07, AC-08, AC-10, AC-11, AC-14 and AC-16): input that is too large,
// never ends or is empty, a project directory with no git tree, a command that
// cannot run, a bad argument list with stdin left open, an error the awaited
// chain cannot catch, a ledger that is a FIFO, and the residual the story cannot
// close. Each must end in exit 2, except the residual. Signals and the hook's own deadline are in
// claude-hook-cli.signal.test.ts. The CLI runs as an async child so stdin can
// stay open. Every case uses a temporary directory, never this repository's
// ledger.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  cliEnv,
  cliPath,
  killIfAlive,
  makeFifoLedgerRepo,
  startCli,
  startSleeper,
  stopInput,
} from './hook-cli-test-helpers.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo, waitUntilGone } from './test-helpers.ts';

after(cleanupTempDirs);

test('AC-e07s02-03 input over 1 MiB blocks, and the command never runs', async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'touch ran.txt'], cliEnv(repo), 20000);
  child.stdin.end(Buffer.alloc(2 * 1024 * 1024, 'x'));
  const out = await result;
  assert.equal(out.timedOut, false);
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /too large/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false);
});

test('AC-e07s02-04 a host that never closes stdin blocks at the deadline', { timeout: 40000 }, async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'touch ran.txt'], cliEnv(repo), 25000);
  child.stdin.write('{"hook_event_name":"Stop"');
  const out = await result;
  assert.equal(out.timedOut, false);
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /did not end/);
  assert.equal(existsSync(join(repo, 'ran.txt')), false);
});

test('AC-e07s02-05 empty input blocks', async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'true'], cliEnv(repo), 20000);
  child.stdin.end();
  const out = await result;
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /unreadable hook input/);
});

test('AC-e07s02-07 a project directory that is not a git tree blocks and says weftwork could not check', async () => {
  const dir = makeTempDir();
  const { child, result } = startCli(['--', 'true'], cliEnv(dir), 20000);
  child.stdin.end(stopInput(dir));
  const out = await result;
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /could not check/);
});

test('AC-e07s02-08 a declared command the shell cannot find is a failed run and blocks', async () => {
  const repo = makeTestRepo();
  const { child, result } = startCli(['--', 'no-such-command-e07s02'], cliEnv(repo), 20000);
  child.stdin.end(stopInput(repo));
  const out = await result;
  assert.equal(out.status, 2);
  assert.equal(out.stdout, '');
  // The shell answers 127, so the engine's reason is exit-nonzero, not not-started.
  assert.match(out.stderr, /not done \(failed, exit-nonzero\)/);
});

test('AC-e07s02-10 a bad argument list blocks without reading stdin', async () => {
  const repo = makeTestRepo();
  for (const args of [[], ['--'], ['--', 'true', 'extra']]) {
    const started = Date.now();
    const { child, result } = startCli(args, cliEnv(repo), 8000);
    child.stdin.write('{"hook_event_name":"Stop"'); // stdin stays open
    const out = await result;
    assert.equal(out.timedOut, false, args.join(' '));
    assert.equal(out.status, 2, args.join(' '));
    assert.match(out.stderr, /usage/);
    assert.ok(Date.now() - started < 5000, 'it did not wait for stdin');
  }
});

test('AC-e07s02-11 a CLI that cannot start does not exit 2: the residual this story cannot close', () => {
  const missing = join(makeTempDir(), 'claude-hook-cli.ts');
  const result = spawnSync(process.execPath, [missing, '--', 'true'], { encoding: 'utf8' });
  assert.notEqual(result.status, 2, 'the host would not read this as a block');
});

test('AC-e07s02-11 the CLI header names the residual and points to e07s04', () => {
  const source = readFileSync(cliPath, 'utf8');
  const header = source.slice(0, source.indexOf('\nimport '));
  assert.match(header, /fail-open residual/i);
  assert.match(header, /exit 1/);
  assert.match(header, /crash before this code runs/);
  assert.match(header, /before the handlers are installed/);
  assert.match(header, /SIGKILL/);
  assert.match(header, /e07s04/);
});

test('AC-e07s02-16 a ledger that is a FIFO blocks with could not check, and does not hang (BUG-007)', async () => {
  const repo = makeFifoLedgerRepo();
  const started = Date.now();
  const { child, result } = startCli(['--', 'true'], cliEnv(repo), 15000);
  child.stdin.end(stopInput(repo));
  const out = await result;
  assert.equal(out.timedOut, false);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /could not check/);
  assert.ok(Date.now() - started < 10000, 'it answered long before the host would cut it off');
});

/** An environment that preloads a module raising `statement` in the CLI process
 * 2.5 s in: an error the awaited chain cannot catch, with no test seam in the
 * CLI itself. The delay outlasts the start of the command. `flags` go to Node. */
function lateFaultEnv(repo: string, statement: string, flags: string): NodeJS.ProcessEnv {
  const file = join(makeTempDir(), 'late-fault.mjs');
  writeFileSync(file, `setTimeout(() => { ${statement} }, 2500);\n`);
  const options = `--import ${pathToFileURL(file).href} ${flags}`;
  return { ...cliEnv(repo), NODE_OPTIONS: options.trim() };
}

// Node's default turns an unhandled rejection into an uncaught exception, so
// the first handler would catch both. With --unhandled-rejections=warn a
// rejection only prints a warning, so only the second handler ends it.
const lateFaults = [
  ['an uncaught exception', "throw new Error('late fault');", ''],
  ['an unhandled rejection', "Promise.reject(new Error('late fault'));", '--unhandled-rejections=warn'],
] as const;

for (const [what, statement, flags] of lateFaults) {
  test(`AC-e07s02-14 ${what} outside the awaited chain blocks, and the command is killed`, async () => {
    const { result, pid } = await startSleeper(lateFaultEnv(makeTestRepo(), statement, flags));
    try {
      const out = await result;
      assert.equal(out.timedOut, false);
      assert.equal(out.status, 2);
      assert.match(out.stderr, /adapter fault: late fault/);
      assert.ok(await waitUntilGone(pid, 5000), 'the command is gone');
    } finally {
      killIfAlive(pid);
    }
  });
}
