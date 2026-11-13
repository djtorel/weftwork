// story: e07s04
// AC-e07s04-01: the install and the live check agree on what a weftwork entry
// is. parseStopHookCommand reads back exactly the text stopHookCommand writes,
// and nothing else: shell text after the quoted argument, a different prefix
// or an unquoted argument is not weftwork's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installStopHook, parseStopHookCommand, shellQuote, stopHookCommand } from './claude-install.ts';

const cli = '/opt/weft work/src/claude-hook-cli.ts';

test('AC-e07s04-01 the text stopHookCommand writes is read back', () => {
  const command = `echo "it's done" && echo 'two'`;
  assert.deepEqual(parseStopHookCommand(stopHookCommand(cli, command)), { cliPath: cli, command });
});

test('AC-e07s04-01 an adapter path with a quote is read back', () => {
  const quoted = "/opt/it's/src/claude-hook-cli.ts";
  assert.deepEqual(parseStopHookCommand(stopHookCommand(quoted, 'npm test')), {
    cliPath: quoted,
    command: 'npm test',
  });
});

test('AC-e07s04-01 an empty declared command is read back as empty', () => {
  assert.deepEqual(parseStopHookCommand(stopHookCommand(cli, '')), { cliPath: cli, command: '' });
});

test('AC-e07s04-01 shell text after the quoted argument is not weftwork\'s', () => {
  assert.equal(parseStopHookCommand(`${stopHookCommand(cli, 'npm test')} && echo owner`), null);
  assert.equal(parseStopHookCommand(`${stopHookCommand(cli, 'npm test')} `), null);
});

test('AC-e07s04-01 another program, a missing separator or an unquoted argument is not weftwork\'s', () => {
  const cliArg = shellQuote(cli);
  assert.equal(parseStopHookCommand(`bash ${cliArg} -- 'npm test'`), null);
  assert.equal(parseStopHookCommand(`node ${cliArg} 'npm test'`), null);
  assert.equal(parseStopHookCommand(`node ${cliArg} -- npm test`), null);
  assert.equal(parseStopHookCommand(`node ${cli} -- 'npm test'`), null);
  assert.equal(parseStopHookCommand(''), null);
});

test('shell text before the entry is not weftwork\'s (review round 4, B-2)', () => {
  assert.equal(parseStopHookCommand(`echo x; ${stopHookCommand(cli, 'npm test')}`), null);
  assert.equal(parseStopHookCommand(` ${stopHookCommand(cli, 'npm test')}`), null);
});

test('the install keeps an owner hook that runs the entry after its own shell text (review round 4, B-2)', () => {
  const owner = { type: 'command', command: `echo x; ${stopHookCommand(cli, 'npm test')}` };
  const result = installStopHook(JSON.stringify({ hooks: { Stop: [{ hooks: [owner] }] } }), cli, 'npm test');
  assert.ok(result.ok && result.action === 'added', JSON.stringify(result));
  assert.ok(result.text.includes(JSON.stringify(owner.command)), 'the owner hook is kept');
});
