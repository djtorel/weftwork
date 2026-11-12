// story: e07s02
// The adapter's own faults (e07s02 AC-03 to AC-06): input that is too large,
// empty, never ends or breaks, and work that throws. Each ends in a returned
// value that blocks the stop. Streams here are PassThrough, so no case needs a
// child process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  blockStop,
  failClosed,
  hostBlockExitCode,
  maxHookInputBytes,
  parseHookInput,
  readHookInput,
  stdinDeadlineMs,
} from './claude-hook.ts';

const longDeadlineMs = 60000;

test('AC-e07s02-03 the cap is 1 MiB and the deadline is 10 seconds', () => {
  assert.equal(maxHookInputBytes, 1024 * 1024);
  assert.equal(stdinDeadlineMs, 10000);
});

test('AC-e07s02-03 input that ends within the cap is returned as text', async () => {
  const stream = new PassThrough();
  stream.end('{"hook_event_name":"Stop"}');
  assert.deepEqual(await readHookInput(stream, 1024, longDeadlineMs), {
    ok: true,
    text: '{"hook_event_name":"Stop"}',
  });
});

test('AC-e07s02-03 input of exactly the cap is accepted', async () => {
  const stream = new PassThrough();
  stream.end('x'.repeat(8));
  const result = await readHookInput(stream, 8, longDeadlineMs);
  assert.deepEqual(result, { ok: true, text: 'x'.repeat(8) });
});

test('AC-e07s02-03 input one byte over the cap is refused and the stream is released', async () => {
  const stream = new PassThrough();
  stream.write('x'.repeat(9));
  const result = await readHookInput(stream, 8, longDeadlineMs);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /too large/.test(result.error));
  assert.equal(stream.destroyed, true);
});

test('AC-e07s02-03 the cap counts bytes across chunks, not per chunk', async () => {
  const stream = new PassThrough();
  const pending = readHookInput(stream, 8, longDeadlineMs);
  stream.write('xxxxx');
  stream.write('xxxxx');
  const result = await pending;
  assert.ok(!result.ok && /too large/.test(result.error));
});

test('AC-e07s02-03 the cap counts bytes, not characters', async () => {
  const stream = new PassThrough();
  stream.end('€€€'); // 3 characters, 9 bytes
  const result = await readHookInput(stream, 8, longDeadlineMs);
  assert.ok(!result.ok && /too large/.test(result.error));
});

test('AC-e07s02-03 a character split across two chunks is read whole', async () => {
  const stream = new PassThrough();
  const bytes = Buffer.from('€€');
  const pending = readHookInput(stream, 1024, longDeadlineMs);
  stream.write(bytes.subarray(0, 2));
  stream.write(bytes.subarray(2));
  stream.end();
  assert.deepEqual(await pending, { ok: true, text: '€€' });
});

test('AC-e07s02-05 empty input is returned as empty text, and the parser refuses it', async () => {
  const stream = new PassThrough();
  stream.end();
  const result = await readHookInput(stream, 1024, longDeadlineMs);
  assert.deepEqual(result, { ok: true, text: '' });
  assert.equal(result.ok && parseHookInput(result.text).ok, false);
});

test('AC-e07s02-04 input that never ends is refused at the deadline and the stream is released', async () => {
  const stream = new PassThrough();
  stream.write('{"partial":');
  const started = Date.now();
  const result = await readHookInput(stream, 1024, 40);
  assert.ok(!result.ok && /did not end/.test(result.error));
  assert.equal(stream.destroyed, true);
  assert.ok(Date.now() - started < 5000, 'the deadline, not the test timeout, ended it');
});

test('AC-e07s02-04 a stream that ends first leaves no timer to hold the process', async () => {
  const stream = new PassThrough();
  stream.end('{}');
  await readHookInput(stream, 1024, longDeadlineMs);
  // The process would not exit for 60 s if the deadline timer were still armed;
  // node:test ends this file as soon as the event loop is empty.
  assert.ok(true);
});

test('AC-e07s02-04 a stream error is refused with its message', async () => {
  const stream = new PassThrough();
  const pending = readHookInput(stream, 1024, longDeadlineMs);
  stream.destroy(new Error('boom'));
  const result = await pending;
  assert.ok(!result.ok && /boom/.test(result.error));
});

test('AC-e07s02-04 a stream closed before it ended is refused', async () => {
  const stream = new PassThrough();
  const pending = readHookInput(stream, 1024, longDeadlineMs);
  stream.write('{"partial":');
  stream.destroy();
  const result = await pending;
  assert.ok(!result.ok && /closed/.test(result.error));
});

test('AC-e07s02-06 work that resolves passes through unchanged', async () => {
  const out = { exitCode: 0, stdout: 'ok', stderr: '' };
  assert.deepEqual(await failClosed(async () => out), out);
});

test('AC-e07s02-06 work that rejects becomes a block that says adapter fault', async () => {
  const out = await failClosed(async () => {
    throw new Error('the engine broke');
  });
  assert.equal(out.exitCode, hostBlockExitCode);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /adapter fault: the engine broke/);
});

test('AC-e07s02-06 work that throws before it returns a promise becomes a block', async () => {
  const out = await failClosed(() => {
    throw new Error('sync break');
  });
  assert.equal(out.exitCode, hostBlockExitCode);
  assert.match(out.stderr, /adapter fault: sync break/);
});

test('AC-e07s02-06 a thrown value that is not an Error still blocks', async () => {
  const out = await failClosed(() => Promise.reject('a plain string'));
  assert.deepEqual(out, blockStop('adapter fault: a plain string'));
});
