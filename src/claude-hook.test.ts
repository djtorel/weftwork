// story: e07s01
// The Claude Code Stop hook mapping (e07s01 AC-01 to AC-05): an engine
// answer becomes an exit code and the host's output, and the Stop input is
// read for its cwd only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Answer } from './engine.ts';
import { hookAnswer, parseHookInput } from './claude-hook.ts';
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
  assert.ok(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed));
  assert.deepEqual(Object.keys(parsed), ['systemMessage']);
  const message = (parsed as { systemMessage: unknown }).systemMessage;
  assert.equal(typeof message, 'string');
  return message as string;
}

test('AC-e07s01-01 a done run lets the agent stop', () => {
  assert.deepEqual(hookAnswer(answer('done')), { exitCode: 0, stdout: '', stderr: '' });
});

test('AC-e07s01-02 a failed run blocks the stop', () => {
  const out = hookAnswer(answer('failed'));
  assert.equal(out.exitCode, 2);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /not done \(failed, exit-nonzero\): npm test/);
});

for (const state of ['blocked', 'stalled', 'exhausted', 'killed'] as const) {
  test(`AC-e07s01-03 a ${state} run ends and the stop is allowed`, () => {
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
});

test('AC-e07s01-04 no state but done says the work is done', () => {
  for (const state of ['failed', 'blocked', 'stalled', 'exhausted', 'killed', 'overridden'] as const) {
    const out = hookAnswer(answer(state, { detail: 'd' }));
    const text = `${out.stdout}${out.stderr}`;
    // Every "done" must come right after "not ".
    assert.equal(text.replaceAll('not done', '').includes('done'), false, state);
  }
});

test('AC-e07s01-05 the Stop input from the docs is read for cwd', () => {
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
  assert.deepEqual(parseHookInput(input), { ok: true, cwd: '/work/repo' });
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

test('AC-e07s01-05 input with no string or an empty cwd is not ok', () => {
  for (const text of ['{}', '{"cwd":7}', '{"cwd":""}', '{"cwd":null}']) {
    assert.equal(parseHookInput(text).ok, false, text);
  }
});
