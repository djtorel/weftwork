// The hook entries that call the `weftwork` command, as the resolver finds it
// (launcher.ts), instead of naming a checkout's file, so they survive an npm
// upgrade, a moved checkout and a new Node, and that block (exit 2) when the
// command is missing, since a hook that cannot start is a non-blocking error
// in Claude Code.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { guardEntry, installGuardHook } from './claude-guard-install.ts';
import { installStopHook, isAsInstalled, legacyRequireWeftwork, parseStopHookCommand, stopHookCommand, weftworkOnPath } from './claude-install.ts';
import { liveReport } from './claude-live.ts';
import { call, entry, input, settings, source } from './claude-live-test-helpers.ts';
import { engineBin } from '../install/launcher.ts';
import { gitCommonDir } from '../setup/setup.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const gitPath = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();

/** Run a hook entry's command text as Claude Code does, with only `dir` on PATH. */
function runEntry(command: string, dir: string) {
  return spawnSync('/bin/sh', ['-c', command], { env: { PATH: dir }, encoding: 'utf8', timeout: 20000 });
}

/** A folder with a `weftwork` that prints its arguments, one per line. */
function fakeWeftwork(): string {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'weftwork'), '#!/bin/sh\nfor a in "$@"; do printf "%s\\n" "$a"; done\n', { mode: 0o755 });
  return dir;
}

function stopEntryOf(text: string): string {
  const value = JSON.parse(text) as { hooks: { Stop: { hooks: { command: string }[] }[] } };
  return value.hooks.Stop[0]?.hooks[0]?.command ?? '';
}

test('the Stop entry runs weftwork claude-hook from PATH with the declared command, and reads back', () => {
  const command = stopHookCommand(weftworkOnPath, "npm test && echo 'ok'");
  assert.deepEqual(parseStopHookCommand(command), { cliPath: weftworkOnPath, command: "npm test && echo 'ok'" });
  const ran = runEntry(command, fakeWeftwork());
  assert.equal(ran.status, 0, ran.stderr);
  assert.equal(ran.stdout, "claude-hook\n--\nnpm test && echo 'ok'\n");
});

test('with no weftwork on PATH, the Stop entry and the guard entry block (exit 2) and say how to install it', () => {
  const empty = makeTempDir();
  for (const command of [stopHookCommand(weftworkOnPath, 'npm test'), (guardEntry(weftworkOnPath) as { command: string }).command]) {
    const ran = runEntry(command, empty);
    assert.equal(ran.status, 2, command);
    assert.match(ran.stderr, /npm install -g weftwork/);
  }
});

test('the guard entry runs weftwork guard from PATH', () => {
  const ran = runEntry((guardEntry(weftworkOnPath) as { command: string }).command, fakeWeftwork());
  assert.equal(ran.status, 0, ran.stderr);
  assert.equal(ran.stdout, 'guard\n');
});

test('an install from PATH replaces an entry that names a checkout file, in place', () => {
  const old = settings([{ type: 'command', command: "node '/old/weftwork/src/claude-hook-cli.ts' -- 'npm test'", timeout: 660 }]);
  const result = installStopHook(old, weftworkOnPath, 'npm test');
  assert.ok(result.ok);
  assert.equal(result.action, 'replaced');
  assert.equal(stopEntryOf(result.text), stopHookCommand(weftworkOnPath, 'npm test'));
  const again = installStopHook(result.text, weftworkOnPath, 'npm test');
  assert.ok(again.ok);
  assert.equal(again.changed, false);
});

test('an install from PATH replaces a guard entry that names a checkout file, and keeps the owner\'s hooks', () => {
  const owner = { matcher: 'Bash', hooks: [{ type: 'command', command: 'audit.sh' }] };
  const oldGuard = { matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash', hooks: [{ type: 'command', command: "node '/old/weftwork/dist/guard-cli.js'", timeout: 30 }] };
  const result = installGuardHook(JSON.stringify({ hooks: { PreToolUse: [owner, oldGuard] } }), weftworkOnPath);
  assert.ok(result.ok);
  const list = (JSON.parse(result.text) as { hooks: { PreToolUse: unknown[] } }).hooks.PreToolUse;
  assert.deepEqual(list, [owner, { matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash', hooks: [guardEntry(weftworkOnPath)] }]);
});

test('live check: an entry from PATH is live when weftwork is on PATH and the record is of a weftwork Stop hook file with the same command', () => {
  const project = source('.claude/settings.json', settings([entry('npm test', weftworkOnPath)]));
  const record = { ...call, cliPath: '/usr/lib/node_modules/weftwork/dist/claude-hook-cli.js' };
  const onPath = (path: string) => path === weftworkOnPath;
  assert.equal(liveReport(input({ project, exists: onPath, lastCall: { ok: true, call: record } })).answer, 'live');
  const other = { ...record, cliPath: '/tmp/evil.js' };
  assert.equal(liveReport(input({ project, exists: onPath, lastCall: { ok: true, call: other } })).answer, 'not-seen');
});

test('live check: an entry from PATH with no weftwork on PATH is not registered, and the reason says to install it', () => {
  const project = source('.claude/settings.json', settings([entry('npm test', weftworkOnPath)]));
  const report = liveReport(input({ project, exists: () => false }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /not installed for this project: install it in this clone with npx weftwork install, or for every project with npm install -g weftwork/);
});

test('a Stop entry as 0.2.0 wrote it, weftwork from PATH only, reads back, is as installed, and an install replaces it', () => {
  const legacy = { type: 'command', command: `${legacyRequireWeftwork}weftwork claude-hook -- 'npm test'`, timeout: 660 };
  const read = parseStopHookCommand(legacy.command);
  assert.deepEqual(read, { cliPath: weftworkOnPath, command: 'npm test' });
  assert.ok(read !== null && isAsInstalled(legacy, read));
  const result = installStopHook(settings([legacy]), weftworkOnPath, 'npm test');
  assert.ok(result.ok);
  assert.equal(result.action, 'replaced');
  assert.equal(stopEntryOf(result.text), stopHookCommand(weftworkOnPath, 'npm test'));
});

test('the Stop entry runs the clone\'s own install before the one on PATH', () => {
  const repo = makeTestRepo();
  const local = engineBin(gitCommonDir(repo) ?? '');
  mkdirSync(dirname(local), { recursive: true });
  writeFileSync(local, '#!/bin/sh\necho "local:$*"\n', { mode: 0o755 });
  const onPath = fakeWeftwork();
  writeFileSync(join(onPath, 'git'), `#!/bin/sh\nexec ${JSON.stringify(gitPath)} "$@"\n`, { mode: 0o755 });
  const ran = spawnSync('/bin/sh', ['-c', stopHookCommand(weftworkOnPath, 'npm test')], {
    cwd: repo,
    env: { PATH: onPath, CLAUDE_PROJECT_DIR: repo },
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(ran.stdout, 'local:claude-hook -- npm test\n', ran.stderr);
});
