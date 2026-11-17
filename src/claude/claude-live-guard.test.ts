// story: e11s01
// The live check for the guard: is its PreToolUse entry registered, and did
// Claude Code run it? The guard leaves a trace in the session transcript only
// when it blocks a call or fails to run, so those two are the evidence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardEntry, guardMatcher, guardTimeoutSeconds } from './claude-guard-install.ts';
import { legacyRequireWeftwork, weftworkOnPath } from './claude-install.ts';
import { guardReport, type GuardInput } from './claude-live-guard.ts';
import { source } from './claude-live-test-helpers.ts';
import { missingWeftwork } from '../install/launcher.ts';

const cli = '/opt/weftwork/src/guard-cli.ts';
const command = `node '${cli}'`;

function settings(preToolUse: unknown[]): string {
  return JSON.stringify({ hooks: { PreToolUse: preToolUse } });
}

const installed = [{ matcher: guardMatcher, hooks: [guardEntry(cli)] }];

function line(at: string, fields: Record<string, unknown>): string {
  return JSON.stringify({ type: 'attachment', timestamp: at, ...fields });
}

/** A transcript line for a call the guard blocked, as Claude Code writes it. */
function blocked(at: string, cmd = command, stderr = 'weftwork: Bash blocked: the command names weftwork.yaml'): string {
  return JSON.stringify({ type: 'user', timestamp: at, toolUseResult: `Error: PreToolUse:Bash hook error: [${cmd}]: ${stderr}` });
}

/** A transcript line for a guard that could not run: a non-blocking error. */
function failed(at: string, cmd = command): string {
  const attachment = { type: 'hook_non_blocking_error', hookName: 'PreToolUse:Bash', hookEvent: 'PreToolUse', stderr: 'ERR_MODULE_NOT_FOUND', exitCode: 1, command: cmd };
  return line(at, { attachment });
}

function input(change: Partial<GuardInput> = {}): GuardInput {
  return {
    project: source('.claude/settings.json', settings(installed)),
    projectDir: '/repo',
    exists: (path) => path === cli,
    transcripts: { ok: true, texts: [] },
    ...change,
  };
}

test('no guard entry in the project settings: not registered', () => {
  const report = guardReport(input({ project: source('.claude/settings.json', settings([])) }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /no weftwork guard/);
});

test('project settings that are not JSON: not registered, the file named', () => {
  const report = guardReport(input({ project: source('.claude/settings.json', '{') }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /\.claude\/settings\.json/);
});

test('the guard adapter file is missing: not registered, the path named', () => {
  const report = guardReport(input({ exists: () => false }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /\/opt\/weftwork\/src\/guard-cli\.ts/);
});

test('an entry run from PATH where weftwork is missing: not registered', () => {
  const project = source('.claude/settings.json', settings([{ matcher: guardMatcher, hooks: [guardEntry(weftworkOnPath)] }]));
  const report = guardReport(input({ project, exists: () => false }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /not installed for this project: install it in this clone with npx weftwork install/);
});

test('a guard entry as 0.2.0 wrote it, weftwork from PATH only, is still as installed', () => {
  const legacy = {
    type: 'command',
    command: `${legacyRequireWeftwork}weftwork guard`,
    timeout: guardTimeoutSeconds,
  };
  const project = source('.claude/settings.json', settings([{ matcher: guardMatcher, hooks: [legacy] }]));
  const report = guardReport(input({ project, exists: () => true }));
  assert.equal(report.answer, 'not-seen');
});

test('a guard group with a narrower matcher: not registered, changed by hand', () => {
  const project = source('.claude/settings.json', settings([{ matcher: 'Bash', hooks: [guardEntry(cli)] }]));
  const report = guardReport(input({ project }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /changed by hand/);
});

test('registered, no trace in the transcripts: not seen', () => {
  const report = guardReport(input({ transcripts: { ok: true, texts: ['{"type":"user"}\nnot json\n'] } }));
  assert.equal(report.answer, 'not-seen');
  assert.match(report.reason, /blocks a call or fails/);
});

test('a transcript where the guard blocked a call: ran, with the time', () => {
  const report = guardReport(input({ transcripts: { ok: true, texts: [blocked('2026-11-15T10:00:00.000Z')] } }));
  assert.equal(report.answer, 'ran');
  assert.match(report.reason, /2026-11-15T10:00:00\.000Z/);
});

test('the guard failed to run after its last block: failing, calls went through', () => {
  const text = [blocked('2026-11-15T10:00:00.000Z'), failed('2026-11-15T11:00:00.000Z')].join('\n');
  const report = guardReport(input({ transcripts: { ok: true, texts: [text] } }));
  assert.equal(report.answer, 'failing');
  assert.match(report.reason, /2026-11-15T11:00:00\.000Z/);
  assert.match(report.reason, /went ahead/);
});

test('the newest event wins across transcripts: a block after a failure is ran', () => {
  const texts = [blocked('2026-11-15T12:00:00.000Z'), failed('2026-11-15T11:00:00.000Z')];
  assert.equal(guardReport(input({ transcripts: { ok: true, texts } })).answer, 'ran');
});

test('a block by the missing-weftwork check is failing: the guard itself did not run', () => {
  const older = 'weftwork: the weftwork command is not on PATH, so this hook cannot run.';
  for (const stderr of [missingWeftwork, older]) {
    const report = guardReport(input({ transcripts: { ok: true, texts: [blocked('2026-11-15T10:00:00.000Z', command, stderr)] } }));
    assert.equal(report.answer, 'failing', stderr);
    assert.match(report.reason, /weftwork command was not installed/);
  }
});

test('events of another hook command are not the guard\'s', () => {
  const texts = [blocked('2026-11-15T10:00:00.000Z', 'audit.sh'), failed('2026-11-15T10:00:00.000Z', 'audit.sh')];
  assert.equal(guardReport(input({ transcripts: { ok: true, texts } })).answer, 'not-seen');
});

test('the transcripts cannot be read: not seen, the error named', () => {
  const report = guardReport(input({ transcripts: { ok: false, error: 'EACCES' } }));
  assert.equal(report.answer, 'not-seen');
  assert.match(report.reason, /EACCES/);
});

test('a "$CLAUDE_PROJECT_DIR" guard entry resolves against the project folder', () => {
  const cmd = 'node "$CLAUDE_PROJECT_DIR/src/guard-cli.ts"';
  const project = source('.claude/settings.json', settings([{ matcher: guardMatcher, hooks: [{ type: 'command', command: cmd, timeout: 30 }] }]));
  const report = guardReport(input({
    project,
    exists: (path) => path === '/repo/src/guard-cli.ts',
    transcripts: { ok: true, texts: [failed('2026-11-15T10:00:00.000Z', cmd)] },
  }));
  assert.equal(report.answer, 'failing', report.reason);
});

test('a node hook that runs another file is not the guard (review r1m1)', () => {
  const other = { type: 'command', command: "node '/repo/audit.js'", timeout: 30 };
  const project = source('.claude/settings.json', settings([{ matcher: guardMatcher, hooks: [other] }]));
  const report = guardReport(input({ project, exists: () => true }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /no weftwork guard/);
});

test('control characters from the transcript are escaped in the reason', () => {
  const report = guardReport(input({ transcripts: { ok: true, texts: [blocked('2026-11-15T10:00:00.000Z\u001b[2J')] } }));
  assert.ok(!report.reason.includes('\u001b'), report.reason);
});
