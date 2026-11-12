// story: e07s03
// The settings edit that registers the Stop hook (e07s03 AC-01 to AC-06): one
// weftwork entry under hooks.Stop with the host timeout, every other key and
// hook kept in order, a second run that changes nothing, and settings of the
// wrong shape refused with no output text.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hookTimeoutSeconds } from './claude-hook.ts';
import { installStopHook, shellQuote, stopHookCommand } from './claude-install.ts';
import { isRecord } from './json.ts';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

const cli = '/opt/weft work/src/claude-hook-cli.ts';

/** The result of an install that must have worked, with its text parsed. */
function installed(text: string | null, command = 'npm test') {
  const result = installStopHook(text, cli, command);
  assert.ok(result.ok, result.ok ? '' : result.error);
  return { ...result, value: JSON.parse(result.text) as unknown };
}

/** The Stop groups of a parsed settings value. */
function stopGroups(value: unknown): unknown[] {
  assert.ok(isRecord(value));
  assert.ok(isRecord(value.hooks));
  assert.ok(Array.isArray(value.hooks.Stop));
  return value.hooks.Stop;
}

test('AC-e07s03-01 no settings file gives one Stop entry with the host timeout', () => {
  const { value, changed, action } = installed(null);
  const groups = stopGroups(value);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0], {
    hooks: [
      {
        type: 'command',
        command: `node '/opt/weft work/src/claude-hook-cli.ts' -- 'npm test'`,
        timeout: hookTimeoutSeconds,
      },
    ],
  });
  assert.equal(changed, true);
  assert.equal(action, 'added');
});

test('AC-e07s03-01 the output is 2-space JSON with a final newline', () => {
  const result = installStopHook(null, cli, 'npm test');
  assert.ok(result.ok);
  assert.equal(result.text, `${JSON.stringify(JSON.parse(result.text), null, 2)}\n`);
});

test('AC-e07s03-02 other keys and hooks are kept, in order', () => {
  const before = {
    env: { A: '1' },
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'other-stop' }] }],
    },
    permissions: { allow: ['Bash(ls)'] },
  };
  const { value } = installed(JSON.stringify(before));
  assert.ok(isRecord(value));
  assert.deepEqual(Object.keys(value), ['env', 'hooks', 'permissions']);
  assert.deepEqual(value.env, before.env);
  assert.deepEqual(value.permissions, before.permissions);
  assert.ok(isRecord(value.hooks));
  assert.deepEqual(Object.keys(value.hooks), ['PreToolUse', 'Stop']);
  assert.deepEqual(value.hooks.PreToolUse, before.hooks.PreToolUse);
  const groups = stopGroups(value);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], before.hooks.Stop[0]);
});

test('AC-e07s03-02 a settings file with no hooks key gets one', () => {
  const { value } = installed('{"env":{"A":"1"}}');
  assert.ok(isRecord(value));
  assert.deepEqual(Object.keys(value), ['env', 'hooks']);
  assert.equal(stopGroups(value).length, 1);
});

test('AC-e07s03-03 a second run changes nothing', () => {
  const first = installed(null);
  const second = installStopHook(first.text, cli, 'npm test');
  assert.ok(second.ok);
  assert.equal(second.changed, false);
  assert.equal(second.action, 'unchanged');
  assert.equal(second.text, first.text);
});

test('AC-e07s03-03 a file with the entry but other spacing is re-printed', () => {
  const first = installed(null);
  const result = installStopHook(JSON.stringify(JSON.parse(first.text)), cli, 'npm test');
  assert.ok(result.ok);
  assert.equal(result.changed, true);
  assert.equal(result.text, first.text);
});

test('AC-e07s03-04 a new command replaces the entry in place', () => {
  const other = { hooks: [{ type: 'command', command: 'other-stop' }] };
  const first = installed(
    JSON.stringify({ hooks: { Stop: [other] } }),
    'npm test',
  );
  const second = installStopHook(first.text, cli, 'npm run check');
  assert.ok(second.ok);
  assert.equal(second.action, 'replaced');
  assert.equal(second.changed, true);
  const groups = stopGroups(JSON.parse(second.text));
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], other);
  assert.match(JSON.stringify(groups[1]), /npm run check/);
  assert.doesNotMatch(second.text, /npm test/);
});

test('AC-e07s03-04 duplicate weftwork entries collapse to one, an emptied group goes', () => {
  const entry = { type: 'command', command: stopHookCommand(cli, 'old'), timeout: 5 };
  const text = JSON.stringify({
    hooks: { Stop: [{ hooks: [entry] }, { hooks: [entry, { type: 'command', command: 'keep' }] }] },
  });
  const { value } = installed(text, 'new');
  const groups = stopGroups(value);
  const all = JSON.stringify(groups);
  assert.equal(all.split(shellQuote(cli)).length - 1, 1);
  assert.match(all, /keep/);
  assert.doesNotMatch(all, /old/);
  assert.equal(groups.length, 2);
});

test('AC-e07s03-04 an entry from another checkout is not replaced', () => {
  const foreign = {
    type: 'command',
    command: stopHookCommand('/elsewhere/src/claude-hook-cli.ts', 'npm test'),
  };
  const { value } = installed(JSON.stringify({ hooks: { Stop: [{ hooks: [foreign] }] } }));
  const groups = stopGroups(value);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], { hooks: [foreign] });
});

test('AC-e07s03-05 bad settings are refused, with no text', () => {
  const bad: Record<string, string> = {
    'not JSON': 'not json',
    'empty text': '',
    'a JSON array': '[]',
    'a JSON string': '"x"',
    'null': 'null',
    'hooks is a string': '{"hooks":"x"}',
    'hooks is an array': '{"hooks":[]}',
    'hooks.Stop is an object': '{"hooks":{"Stop":{}}}',
    'a Stop group that is not an object': '{"hooks":{"Stop":["x"]}}',
    'a Stop group whose hooks is not a list': '{"hooks":{"Stop":[{"hooks":"x"}]}}',
  };
  for (const [name, text] of Object.entries(bad)) {
    const result = installStopHook(text, cli, 'npm test');
    assert.equal(result.ok, false, name);
    assert.ok(!result.ok && result.error.length > 0, name);
    assert.equal('text' in result, false, name);
  }
});

test('AC-e07s03-05 a blank command is refused', () => {
  for (const command of ['', '   ', '\n\t']) {
    const result = installStopHook(null, cli, command);
    assert.equal(result.ok, false);
  }
});

test('AC-e07s03-06 quotes in the command survive the shell', () => {
  const dir = makeTempDir();
  const script = join(dir, 'print args.mjs');
  writeFileSync(script, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
  const command = `echo "it's done" && echo 'two'`;
  const line = stopHookCommand(script, command);
  const out = execFileSync('sh', ['-c', line], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), ['--', command]);
});

test('AC-e07s03-06 shellQuote closes and reopens around a single quote', () => {
  assert.equal(shellQuote(`a'b`), `'a'\\''b'`);
  assert.equal(shellQuote(''), "''");
});
