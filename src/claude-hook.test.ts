// story: e07s01, e07s02
// The Claude Code Stop hook mapping (e07s01 AC-01 to AC-05, AC-11, AC-12): an
// engine answer becomes an exit code and the host's output, the Stop input is
// checked, and the directory and command come from the owner, not the agent.
// e07s02 AC-01 and AC-02: the timeout pair, and a failed run that says what is
// wrong for each reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Answer } from './engine.ts';
import {
  blockStop,
  engineTimeoutMs,
  hookAnswer,
  hookRequest,
  hookTimeoutSeconds,
  hostBlockExitCode,
  parseHookInput,
  projectDir,
} from './claude-hook.ts';
import type { Reason } from './gate.ts';
import { isRecord } from './json.ts';
import type { State } from './states.ts';

function answer(state: State, extra: Partial<Answer> = {}): Answer {
  return {
    done: state === 'done',
    exitCode: state === 'done' ? 0 : 1,
    reason: state === 'done' ? 'passed' : 'exit-nonzero',
    command: 'npm test',
    fingerprint: 'abc',
    state,
    ...extra,
  };
}

/** Parse stdout as one JSON object and return it. */
function systemMessage(stdout: string): string {
  const parsed: unknown = JSON.parse(stdout);
  assert.ok(isRecord(parsed));
  assert.deepEqual(Object.keys(parsed), ['systemMessage']);
  const message = parsed.systemMessage;
  assert.ok(typeof message === 'string');
  return message;
}

test('AC-e07s01-01 a done run lets the agent stop', () => {
  assert.deepEqual(hookAnswer(answer('done')), { exitCode: 0, stdout: '', stderr: '' });
});

test('AC-e07s01-02 a failed run blocks the stop', () => {
  const out = hookAnswer(answer('failed'));
  assert.equal(out.exitCode, hostBlockExitCode);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /not done \(failed, exit-nonzero\): npm test/);
  assert.match(out.stderr, /Make that command pass before you stop\./);
});

for (const state of ['blocked', 'stalled', 'exhausted', 'killed'] as const) {
  test(`AC-e07s01-03 a run that ends ${state} allows the stop`, () => {
    const out = hookAnswer(answer(state, { detail: 'the detail text' }));
    assert.equal(out.exitCode, 0);
    assert.equal(out.stderr, '');
    const message = systemMessage(out.stdout);
    assert.match(message, /not done/);
    assert.ok(message.includes(state));
    assert.ok(message.includes('the detail text'));
  });
}

test('AC-e07s01-03 a state with no detail names the reason instead', () => {
  const out = hookAnswer(answer('killed', { reason: 'killed' }));
  assert.equal(out.exitCode, 0);
  assert.match(systemMessage(out.stdout), /not done \(killed\): killed/);
});

test('AC-e07s01-04 an overridden run is allowed and never reads as done', () => {
  const out = hookAnswer(answer('overridden'));
  assert.equal(out.exitCode, 0);
  assert.equal(out.stderr, '');
  const message = systemMessage(out.stdout);
  assert.match(message, /overridden/);
  assert.match(message, /not done/);
  assert.ok(message.includes('npm test'));
});

test('AC-e07s01-04 no state but done says the work is done', () => {
  // The owner's command and detail are free text, so take them out first:
  // only the words weftwork writes must keep "done" behind "not".
  const command = 'make the-command';
  const detail = 'the-detail';
  for (const state of ['failed', 'blocked', 'stalled', 'exhausted', 'killed', 'overridden'] as const) {
    const out = hookAnswer(answer(state, { command, detail }));
    const ours = `${out.stdout}${out.stderr}`.replaceAll(command, '').replaceAll(detail, '');
    assert.equal(ours.toLowerCase().replaceAll('not done', '').includes('done'), false, state);
  }
});

test('AC-e07s01-05 a Stop input that is a JSON object is ok', () => {
  const input = JSON.stringify({
    session_id: 's1',
    transcript_path: '/tmp/t.jsonl',
    cwd: '/work/repo',
    permission_mode: 'default',
    hook_event_name: 'Stop',
    stop_hook_active: true,
    last_assistant_message: 'all done',
    background_tasks: [],
    session_crons: [],
  });
  assert.deepEqual(parseHookInput(input), { ok: true });
});

test('AC-e07s01-05 input that is not JSON is not ok', () => {
  assert.equal(parseHookInput('not json').ok, false);
  assert.equal(parseHookInput('').ok, false);
});

test('AC-e07s01-05 input that is not an object is not ok', () => {
  for (const text of ['[]', '"cwd"', '7', 'null', 'true']) {
    assert.equal(parseHookInput(text).ok, false, text);
  }
});

test('AC-e07s01-11 the directory is CLAUDE_PROJECT_DIR and nothing else', () => {
  assert.deepEqual(projectDir({ CLAUDE_PROJECT_DIR: '/work/repo' }), { ok: true, dir: '/work/repo' });
});

test('AC-e07s01-11 a missing, empty or relative project directory is not ok', () => {
  for (const value of [undefined, '', 'repo', '.']) {
    const result = projectDir({ CLAUDE_PROJECT_DIR: value });
    assert.equal(result.ok, false, String(value));
    assert.ok(!result.ok && result.error.includes('CLAUDE_PROJECT_DIR'));
  }
  assert.equal(projectDir({}).ok, false);
});

test('AC-e07s01-12 one command after -- becomes the request', () => {
  const result = hookRequest(['--', 'npm test'], '/work/repo');
  assert.deepEqual(result, {
    ok: true,
    request: { command: 'npm test', cwd: '/work/repo', timeoutMs: engineTimeoutMs },
  });
});

test('AC-e07s01-12 anything but -- and one command is not ok', () => {
  for (const args of [[], ['true'], ['--'], ['--', 'a', 'b'], ['a', 'b'], ['-x', 'true']]) {
    const result = hookRequest(args, '/work/repo');
    assert.equal(result.ok, false, args.join(' '));
    assert.ok(!result.ok && result.error.includes('usage'));
  }
});

test('AC-e07s01-12 a blank command is not ok', () => {
  for (const command of ['', ' ', '\t\n']) {
    assert.equal(hookRequest(['--', command], '/work/repo').ok, false, JSON.stringify(command));
  }
});

test('AC-e07s01-12 blockStop blocks with one weftwork line on stderr', () => {
  assert.deepEqual(blockStop('why'), {
    exitCode: hostBlockExitCode,
    stdout: '',
    stderr: 'weftwork: why\n',
  });
  assert.equal(hostBlockExitCode, 2);
});

test('AC-e07s02-01 the hook timeout exceeds the engine timeout by 60 seconds or more', () => {
  assert.equal(engineTimeoutMs, 600000);
  assert.equal(hookTimeoutSeconds, 660);
  assert.ok(hookTimeoutSeconds * 1000 - engineTimeoutMs >= 60000);
});

test('AC-e07s02-01 hookRequest gives the engine the engine timeout', () => {
  const result = hookRequest(['--', 'npm test'], '/work/repo');
  assert.ok(result.ok);
  assert.equal(result.request.timeoutMs, engineTimeoutMs);
});

const failedWords: Array<[Reason, RegExp]> = [
  ['exit-nonzero', /Make that command pass/],
  ['signal', /Make that command pass/],
  ['timeout', /ran past/],
  ['tree-changed', /changed the working tree/],
  ['no-tree', /could not check/],
  ['no-ledger', /could not check/],
  ['not-started', /could not check/],
  ['not-run', /could not check/],
];

for (const [reason, words] of failedWords) {
  test(`AC-e07s02-02 a failed run with reason ${reason} blocks and says what is wrong`, () => {
    const out = hookAnswer(answer('failed', { reason }));
    assert.equal(out.exitCode, hostBlockExitCode);
    assert.equal(out.stdout, '');
    assert.match(out.stderr, new RegExp(`not done \\(failed, ${reason}\\): npm test`));
    assert.match(out.stderr, words);
  });
}

test('AC-e07s02-02 a fault Claude cannot fix, or a run too slow, says to tell the owner', () => {
  for (const reason of ['timeout', 'no-tree', 'no-ledger', 'not-started', 'not-run'] as const) {
    assert.match(hookAnswer(answer('failed', { reason })).stderr, /tell the owner/, reason);
  }
});

test('AC-e07s02-02 a passing run that changed the tree says the result is not trusted', () => {
  assert.match(hookAnswer(answer('failed', { reason: 'tree-changed' })).stderr, /not trusted/);
});

test('AC-e07s02-02 no failed reason says the work is done', () => {
  for (const [reason] of failedWords) {
    const out = hookAnswer(answer('failed', { reason }));
    const ours = out.stderr.replaceAll('npm test', '');
    assert.equal(ours.toLowerCase().replaceAll('not done', '').includes('done'), false, reason);
  }
});
