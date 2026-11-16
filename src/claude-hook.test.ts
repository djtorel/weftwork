// story: e07s01, e07s02, e09s03, e09s04
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
  hookDeadline,
  hookDeadlineMs,
  hookRequest,
  hookTimeoutSeconds,
  hostBlockExitCode,
  parseHookInput,
  projectDir,
  stdinDeadlineMs,
} from './claude-hook.ts';
import type { Reason } from './gate.ts';
import { isRecord } from './json.ts';
import type { State } from './states.ts';
import type { TokenRead } from './transcript-usage.ts';

function answer(state: State, extra: Partial<Answer> = {}): Answer {
  return {
    done: state === 'done',
    exitCode: state === 'done' ? 0 : 1,
    reason: state === 'done' ? 'passed' : 'exit-nonzero',
    command: 'npm test',
    fingerprint: 'abc',
    state,
    budget: { runs: 2, maxRuns: null, failures: 1, maxFailures: 5 },
    ...extra,
  };
}

const tokens: TokenRead = { ok: true, tokens: { input: 7, output: 222, cacheRead: 74918, cacheWrite: 22705 } };

/** The budget line for the default answer and tokens above. */
const budget =
  'budget: 2 runs in this loop (no ceiling), 1 failed in a row (ceiling 5), ' +
  'tokens 7 input, 222 output, 74918 cache read, 22705 cache write';

function hookFor(given: Answer, read: TokenRead = tokens) {
  return hookAnswer(given, read);
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

test('AC-e07s01-01 a done run lets the agent stop, with the budget line only (e09s04)', () => {
  const out = hookFor(answer('done'));
  assert.equal(out.exitCode, 0);
  assert.equal(out.stderr, '');
  assert.equal(systemMessage(out.stdout), `weftwork: done. ${budget}`);
});

test('AC-e07s01-02 a failed run blocks the stop', () => {
  const out = hookFor(answer('failed'));
  assert.equal(out.exitCode, hostBlockExitCode);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /not done \(failed, exit-nonzero\): npm test/);
  assert.match(out.stderr, /Make that command pass before you stop\./);
});

for (const state of ['blocked', 'stalled', 'exhausted', 'killed'] as const) {
  test(`AC-e07s01-03 a run that ends ${state} allows the stop`, () => {
    const out = hookFor(answer(state, { detail: 'the detail text' }));
    assert.equal(out.exitCode, 0);
    assert.equal(out.stderr, '');
    const message = systemMessage(out.stdout);
    assert.match(message, /not done/);
    assert.ok(message.includes(state));
    assert.ok(message.includes('the detail text'));
  });
}

test('AC-e07s01-03 a state with no detail names the reason instead', () => {
  const out = hookFor(answer('killed', { reason: 'killed' }));
  assert.equal(out.exitCode, 0);
  assert.match(systemMessage(out.stdout), /not done \(killed\): killed/);
});

test('AC-e07s01-04 an overridden run is allowed and never reads as done', () => {
  const out = hookFor(answer('overridden'));
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
    const out = hookFor(answer(state, { command, detail }));
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
  assert.deepEqual(parseHookInput(input), { ok: true, transcriptPath: '/tmp/t.jsonl' });
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
    request: { command: 'npm test', cwd: '/work/repo', timeoutMs: engineTimeoutMs, stopHook: true },
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
    const out = hookFor(answer('failed', { reason }));
    assert.equal(out.exitCode, hostBlockExitCode);
    assert.equal(out.stdout, '');
    assert.match(out.stderr, new RegExp(`not done \\(failed, ${reason}\\): npm test`));
    assert.match(out.stderr, words);
  });
}

test('AC-e07s02-02 a fault Claude cannot fix, or a run too slow, says to tell the owner', () => {
  for (const reason of ['timeout', 'no-tree', 'no-ledger', 'not-started', 'not-run'] as const) {
    assert.match(hookFor(answer('failed', { reason })).stderr, /tell the owner/, reason);
  }
});

test('AC-e07s02-02 a passing run that changed the tree says the result is not trusted', () => {
  assert.match(hookFor(answer('failed', { reason: 'tree-changed' })).stderr, /not trusted/);
});

test('AC-e07s02-02 no failed reason says the work is done', () => {
  for (const [reason] of failedWords) {
    const out = hookFor(answer('failed', { reason }));
    const ours = out.stderr.replaceAll('npm test', '');
    assert.equal(ours.toLowerCase().replaceAll('not done', '').includes('done'), false, reason);
  }
});

test('AC-e07s02-12 the hook deadline sits below the host timeout and above engine plus stdin', () => {
  assert.equal(hookTimeoutSeconds * 1000 - hookDeadlineMs, 15000);
  assert.ok(hookDeadlineMs >= engineTimeoutMs + stdinDeadlineMs);
});

test('AC-e07s02-12 an unset or unusable deadline variable leaves the built-in deadline', () => {
  const unusable = [undefined, '', '0', '-5', 'abc', '1.5', String(hookDeadlineMs), '9999999'];
  for (const value of unusable) {
    assert.equal(hookDeadline({ WEFTWORK_HOOK_DEADLINE_MS: value }), hookDeadlineMs, String(value));
  }
  assert.equal(hookDeadline({}), hookDeadlineMs);
});

test('AC-e07s02-12 a shorter deadline from the variable is used, and never a longer one', () => {
  assert.equal(hookDeadline({ WEFTWORK_HOOK_DEADLINE_MS: '1500' }), 1500);
  assert.equal(hookDeadline({ WEFTWORK_HOOK_DEADLINE_MS: String(hookDeadlineMs - 1) }), hookDeadlineMs - 1);
});

test('AC-e07s02-15 the timeout line names the limit', () => {
  const out = hookFor(answer('failed', { reason: 'timeout' }));
  assert.match(out.stderr, new RegExp(`${engineTimeoutMs / 1000} s`));
});

test('AC-e07s02-15 the no-ledger line says the passing run could not be recorded', () => {
  const out = hookFor(answer('failed', { reason: 'no-ledger' }));
  assert.match(out.stderr, /could not be recorded/);
  assert.match(out.stderr, /could not check/);
});

// e09s03 R4: a failed answer within the handover reserve carries a detail,
// and the block reason ends with it, so the agent reads it.
test('AC-e09s03-10 a failed answer with a detail blocks with the detail as the last line', () => {
  const out = hookFor(answer('failed', { detail: '2 runs since the last done, 1 left: write the handoff' }));
  assert.equal(out.exitCode, 2);
  assert.equal(out.stdout, '');
  assert.equal(
    out.stderr,
    'weftwork: not done (failed, exit-nonzero): npm test\n' +
      `${budget}\n` +
      'Make that command pass before you stop.\n' +
      '2 runs since the last done, 1 left: write the handoff\n',
  );
});

test('AC-e09s03-10 a failed answer with no detail ends with what to do', () => {
  const out = hookFor(answer('failed'));
  assert.equal(
    out.stderr,
    `weftwork: not done (failed, exit-nonzero): npm test\n${budget}\nMake that command pass before you stop.\n`,
  );
});

// e09s04: the budget used and the session's tokens, on every answer.
test('AC-e09s04-11 every state shows the budget line', () => {
  const states = ['done', 'failed', 'blocked', 'stalled', 'exhausted', 'killed', 'overridden'] as const;
  for (const state of states) {
    const out = hookFor(answer(state, { detail: 'the detail' }));
    assert.ok(`${out.stdout}${out.stderr}`.includes(budget.split(',')[0] as string), state);
  }
});

test('AC-e09s04-11 the ceilings in force are named, and counts the engine could not read say so', () => {
  const counted = hookFor(answer('failed', { budget: { runs: 3, maxRuns: 9, failures: 2, maxFailures: 4 } }));
  assert.match(counted.stderr, /3 runs in this loop \(ceiling 9\), 2 failed in a row \(ceiling 4\)/);
  const unread = hookFor(answer('failed', { budget: { runs: null, maxRuns: null, failures: null, maxFailures: 5 } }));
  assert.match(unread.stderr, /runs not counted \(no ceiling\), failures not counted \(ceiling 5\)/);
});

test('AC-e09s04-12 a transcript that cannot be used says why and never changes the answer', () => {
  const missing: TokenRead = { ok: false, error: 'no transcript at /x\u001b[2J.jsonl' };
  const done = hookFor(answer('done'), missing);
  assert.equal(done.exitCode, 0);
  const message = systemMessage(done.stdout);
  assert.match(message, /tokens not counted \(no transcript at \/x\\u001b\[2J\.jsonl\)/);
  assert.ok(!message.includes('\u001b'), 'a control character from outside is escaped');
  assert.equal(hookFor(answer('failed'), missing).exitCode, hostBlockExitCode);
});
