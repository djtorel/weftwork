// story: e07s03, e07s04, e11s01
// Entries that name the engine as "$CLAUDE_PROJECT_DIR/src/...", as this
// repository's own settings do, so each worktree runs its own copy (a
// follow-up of PR #95). The install reads them as already registered and keeps
// that form; the live check reads them as registered and resolves the path
// against the project folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardEntry, installGuardHook } from './claude-guard-install.ts';
import { installStopHook, parseStopHookCommand, stopHookCommand, weftworkOnPath } from './claude-install.ts';
import { liveReport } from './claude-live.ts';
import { call, input, source } from './claude-live-test-helpers.ts';
import { hostTimeoutFor } from './claude-hook.ts';
import { defaultStopHookSeconds } from '../engine/budget.ts';

/** The timeout the install writes when no setting file sets the limit. */
const testTimeout = hostTimeoutFor(defaultStopHookSeconds);

const stopCli = '$CLAUDE_PROJECT_DIR/src/claude-hook-cli.ts';
const declared = 'yamllint . && npm test';
const stopEntry = { type: 'command', command: `node "${stopCli}" -- '${declared}'`, timeout: testTimeout };
const guardGroup = {
  matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash',
  hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/src/guard-cli.ts"', timeout: 30 }],
};
/** The settings as this repository holds them. */
const repoSettings = `${JSON.stringify({ hooks: { Stop: [{ hooks: [stopEntry] }], PreToolUse: [guardGroup] } }, null, 2)}\n`;

test('a Stop entry that names "$CLAUDE_PROJECT_DIR/..." is read back, and written the same way', () => {
  assert.deepEqual(parseStopHookCommand(stopEntry.command), { cliPath: stopCli, command: declared });
  assert.equal(stopHookCommand(stopCli, declared), stopEntry.command);
});

test('a double-quoted adapter with shell expansion after the project folder is not weftwork\'s', () => {
  for (const rest of ['$(rm -rf ~)', '`id`', 'a"b', 'a\\b', '$HOME/x']) {
    assert.equal(parseStopHookCommand(`node "$CLAUDE_PROJECT_DIR/${rest}" -- 'npm test'`), null, rest);
  }
  assert.equal(parseStopHookCommand(`node "/opt/src/claude-hook-cli.ts" -- 'npm test'`), null);
});

test('the install from PATH reads the "$CLAUDE_PROJECT_DIR" entries as registered and changes nothing', () => {
  const stop = installStopHook(repoSettings, weftworkOnPath, declared, testTimeout);
  assert.ok(stop.ok, JSON.stringify(stop));
  assert.equal(stop.action, 'unchanged');
  const guard = installGuardHook(stop.text, weftworkOnPath);
  assert.ok(guard.ok, JSON.stringify(guard));
  assert.equal(guard.changed, false);
  assert.equal(guard.text, repoSettings);
});

test('an install repairs a "$CLAUDE_PROJECT_DIR" entry with the old 660 s timeout in place', () => {
  const old = repoSettings.replace(`"timeout": ${testTimeout}`, '"timeout": 660');
  assert.notEqual(old, repoSettings);
  const stop = installStopHook(old, weftworkOnPath, declared, testTimeout);
  assert.ok(stop.ok, JSON.stringify(stop));
  assert.equal(stop.action, 'replaced');
  const guard = installGuardHook(stop.text, weftworkOnPath);
  assert.ok(guard.ok, JSON.stringify(guard));
  assert.equal(guard.text, repoSettings);
});

test('a new declared command replaces the "$CLAUDE_PROJECT_DIR" entry in place and keeps its form', () => {
  const stop = installStopHook(repoSettings, weftworkOnPath, 'npm test', testTimeout);
  assert.ok(stop.ok, JSON.stringify(stop));
  assert.equal(stop.action, 'replaced');
  const hooks = (JSON.parse(stop.text) as { hooks: { Stop: { hooks: unknown[] }[] } }).hooks.Stop.flatMap((g) => g.hooks);
  assert.deepEqual(hooks, [{ ...stopEntry, command: `node "${stopCli}" -- 'npm test'` }]);
});

test('an install from PATH also removes a PATH Stop entry and a PATH guard beside the "$CLAUDE_PROJECT_DIR" ones (review r1m2, r1m3)', () => {
  const both = JSON.stringify({ hooks: {
    Stop: [{ hooks: [stopEntry, { type: 'command', command: stopHookCommand(weftworkOnPath, 'old'), timeout: 660 }] }],
    PreToolUse: [{ matcher: guardGroup.matcher, hooks: [guardEntry(weftworkOnPath)] }, guardGroup],
  } });
  const stop = installStopHook(both, weftworkOnPath, declared, testTimeout);
  assert.ok(stop.ok, JSON.stringify(stop));
  const guard = installGuardHook(stop.text, weftworkOnPath);
  assert.ok(guard.ok, JSON.stringify(guard));
  assert.equal(guard.text, repoSettings);
});

test('the live check reads a "$CLAUDE_PROJECT_DIR" entry as registered and its record as live', () => {
  const project = source('.claude/settings.json', repoSettings);
  const file = '/repo/src/claude-hook-cli.ts';
  const report = liveReport(input({
    project,
    projectDir: '/repo',
    exists: (path) => path === file,
    lastCall: { ok: true, call: { ...call, cliPath: file, command: declared } },
  }));
  assert.equal(report.answer, 'live', report.reason);
});

test('the live check: a "$CLAUDE_PROJECT_DIR" adapter missing from the project is not registered', () => {
  const project = source('.claude/settings.json', repoSettings);
  const report = liveReport(input({ project, projectDir: '/repo', exists: () => false }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /\/repo\/src\/claude-hook-cli\.ts/);
});
