// story: e07s04
// The live check (e07s04 AC-02 to AC-05): from the three settings files, which
// adapter files exist and the call record, one of three answers. Only a record
// of the same adapter and command as an entry in the settings now reads as
// live; everything the check cannot see makes it say less, never more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopHookCommand } from './claude-install.ts';
import { liveReport, type LiveInput, type SettingsSource } from './claude-live.ts';
import type { LastCall } from './last-call.ts';

const cli = '/opt/weft work/src/claude-hook-cli.ts';
const now = new Date('2026-11-12T12:00:00.000Z');
const call: LastCall = { at: '2026-11-12T11:58:00.000Z', cliPath: cli, command: 'npm test' };

/** Settings text with one Stop group holding `hooks`, plus `extra` keys. */
function settings(hooks: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...extra, hooks: { Stop: [{ hooks: hooks }] } });
}

/** weftwork's entry for `command` and the adapter at `path`. */
function entry(command = 'npm test', path = cli) {
  return { type: 'command', command: stopHookCommand(path, command), timeout: 660 };
}

function source(name: string, text: string | null): SettingsSource {
  return { name, read: { ok: true, text } };
}

/** A live setup; each test changes one part. */
function input(change: Partial<LiveInput> = {}): LiveInput {
  return {
    local: source('.claude/settings.local.json', null),
    project: source('.claude/settings.json', settings([entry()])),
    user: source('/home/u/.claude/settings.json', null),
    exists: (path) => path === cli,
    lastCall: { ok: true, call },
    now,
    ...change,
  };
}

test('AC-e07s04-05 the same adapter and command were called: live, with the time', () => {
  const report = liveReport(input());
  assert.equal(report.answer, 'live');
  assert.match(report.reason, /2026-11-12T11:58:00\.000Z/);
  assert.match(report.reason, /2 min ago/);
});

test('AC-e07s04-05 two weftwork entries: a note says two Stop hooks run', () => {
  const project = source('.claude/settings.json', settings([entry(), entry('npm run check')]));
  const report = liveReport(input({ project }));
  assert.equal(report.answer, 'live');
  assert.ok(report.notes.some((note) => /2 weftwork Stop hooks/.test(note)), report.notes.join('\n'));
});

test('AC-e07s04-05 the notes name what the check cannot see', () => {
  const notes = liveReport(input()).notes.join('\n');
  assert.match(notes, /managed settings/i);
  assert.match(notes, /--settings/);
  assert.match(notes, /CLAUDE_PROJECT_DIR/);
  assert.match(notes, /GIT_DIR/);
  assert.match(notes, /evidence, not proof/);
});

test('AC-e07s04-02 no project settings file: not registered', () => {
  const report = liveReport(input({ project: source('.claude/settings.json', null) }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /no weftwork Stop hook/);
});

test('AC-e07s04-02 project settings that are not JSON or cannot be read: not registered', () => {
  for (const project of [
    source('.claude/settings.json', '{"hooks":'),
    { name: '.claude/settings.json', read: { ok: false, error: 'is not a regular file' } } as const,
  ]) {
    const report = liveReport(input({ project }));
    assert.equal(report.answer, 'not-registered');
    assert.match(report.reason, /\.claude\/settings\.json/);
  }
});

test('AC-e07s04-02 only another command\'s hook: not registered, and it is counted', () => {
  const other = { type: 'command', command: 'npm run lint' };
  const report = liveReport(input({ project: source('.claude/settings.json', settings([other])) }));
  assert.equal(report.answer, 'not-registered');
  assert.match(report.reason, /1 other Stop hook/);
});

test('AC-e07s04-02 a weftwork entry whose adapter does not exist: not registered, path named', () => {
  const gone = '/home/teammate/weftwork/src/claude-hook-cli.ts';
  const project = source('.claude/settings.json', settings([entry('npm test', gone)]));
  const report = liveReport(input({ project }));
  assert.equal(report.answer, 'not-registered');
  assert.ok(report.reason.includes(gone), report.reason);
  assert.match(report.reason, /install again/);
});

test('AC-e07s04-03 disableAllHooks follows precedence: local, then project, then user', () => {
  const on = { disableAllHooks: true };
  const off = { disableAllHooks: false };
  const cases: [Partial<LiveInput>, string, RegExp | null][] = [
    [{ project: source('.claude/settings.json', settings([entry()], on)) }, 'not-seen', /settings\.json/],
    [{ user: source('/home/u/.claude/settings.json', JSON.stringify(on)) }, 'not-seen', /\/home\/u/],
    [
      {
        user: source('/home/u/.claude/settings.json', JSON.stringify(on)),
        project: source('.claude/settings.json', settings([entry()], off)),
      },
      'live',
      null,
    ],
    [
      {
        project: source('.claude/settings.json', settings([entry()], off)),
        local: source('.claude/settings.local.json', JSON.stringify(on)),
      },
      'not-seen',
      /settings\.local\.json/,
    ],
  ];
  for (const [change, answer, names] of cases) {
    const report = liveReport(input(change));
    assert.equal(report.answer, answer, JSON.stringify(change));
    if (names !== null) {
      assert.match(report.reason, /disableAllHooks/);
      assert.match(report.reason, names);
    }
  }
});

test('AC-e07s04-04 no call record: registered, not seen', () => {
  const report = liveReport(input({ lastCall: { ok: true, call: null } }));
  assert.equal(report.answer, 'not-seen');
  assert.match(report.reason, /no call/);
});

test('AC-e07s04-04 a call record that cannot be read: not seen', () => {
  const report = liveReport(input({ lastCall: { ok: false, error: 'is not a call record' } }));
  assert.equal(report.answer, 'not-seen');
  assert.match(report.reason, /is not a call record/);
});

test('AC-e07s04-04 a record for another command or another adapter: not seen', () => {
  for (const other of [{ ...call, command: 'npm run old' }, { ...call, cliPath: '/elsewhere/claude-hook-cli.ts' }]) {
    const report = liveReport(input({ lastCall: { ok: true, call: other } }));
    assert.equal(report.answer, 'not-seen', JSON.stringify(other));
    assert.match(report.reason, /another command or adapter/);
  }
});

test('AC-e07s04-04 local or user settings that cannot be read: not seen', () => {
  for (const change of [
    { user: { name: '/home/u/.claude/settings.json', read: { ok: false, error: 'HOME is not set' } } as const },
    { local: source('.claude/settings.local.json', 'not json') },
  ]) {
    const report = liveReport(input(change));
    assert.equal(report.answer, 'not-seen', JSON.stringify(change));
    assert.match(report.reason, /cannot tell whether hooks are on/);
  }
});
