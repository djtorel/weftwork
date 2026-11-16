// The SessionStart entry (claude-env-install.ts): it hands the resolver to the
// session's Bash commands through CLAUDE_ENV_FILE, so the skills' `weftwork`
// and `$(weftwork path)` resolve without a global install.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { envHookCommand, envHookEntry, installEnvHook } from './claude-env-install.ts';
import { engineBin } from './launcher.ts';
import { gitCommonDir } from './setup.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const shells = ['/bin/sh', '/usr/bin/bash', '/usr/bin/zsh', '/bin/dash'].filter((shell) => existsSync(shell));

function sessionStart(text: string): unknown {
  return (JSON.parse(text) as { hooks: { SessionStart: unknown } }).hooks.SessionStart;
}

test('the install adds one SessionStart group, keeps every other key and hook, and is idempotent', () => {
  const owner = { matcher: 'startup', hooks: [{ type: 'command', command: 'echo hi' }] };
  const text = JSON.stringify({ model: 'x', hooks: { SessionStart: [owner], Stop: [] } });
  const first = installEnvHook(text);
  assert.ok(first.ok);
  const value = JSON.parse(first.text) as { model: string; hooks: { Stop: unknown } };
  assert.equal(value.model, 'x');
  assert.deepEqual(value.hooks.Stop, []);
  assert.deepEqual(sessionStart(first.text), [owner, { hooks: [envHookEntry] }]);
  const again = installEnvHook(first.text);
  assert.ok(again.ok);
  assert.equal(again.changed, false);
});

test('the install replaces another version\'s entry and leaves the owner\'s hooks in its group', () => {
  const older = { type: 'command', command: `[ -z "\${CLAUDE_ENV_FILE:-}" ] || printf '%s\\n' 'weftwork() { old; }' >> "$CLAUDE_ENV_FILE"` };
  const mine = { type: 'command', command: 'echo mine' };
  const result = installEnvHook(JSON.stringify({ hooks: { SessionStart: [{ hooks: [mine, older] }] } }));
  assert.ok(result.ok);
  assert.deepEqual(sessionStart(result.text), [{ hooks: [mine] }, { hooks: [envHookEntry] }]);
});

test('the install refuses a SessionStart that is not a list', () => {
  const result = installEnvHook(JSON.stringify({ hooks: { SessionStart: {} } }));
  assert.ok(!result.ok);
  assert.match(result.error, /SessionStart/);
});

for (const shell of shells) {
  test(`${shell}: after the entry runs, a Bash command of the session finds the clone's install as weftwork`, () => {
    const repo = makeTestRepo();
    const local = engineBin(gitCommonDir(repo) ?? '');
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, '#!/bin/sh\n[ "$1" = path ] && echo /engine || echo "local:$*"\n', { mode: 0o755 });
    const envFile = join(makeTempDir(), 'env.sh');
    const env = { ...process.env, CLAUDE_ENV_FILE: envFile, CLAUDE_PROJECT_DIR: repo, WEFTWORK_BIN: '' };
    const hook = spawnSync('/bin/sh', ['-c', envHookCommand], { cwd: repo, env, encoding: 'utf8' });
    assert.equal(hook.status, 0, hook.stderr);
    assert.match(readFileSync(envFile, 'utf8'), /^weftwork\(\) \{/);
    // Claude Code runs the file before each Bash command, in the same shell.
    const command = `. ${JSON.stringify(envFile)}; weftwork review 'a b'; echo "$(weftwork path)/docs"`;
    const ran = spawnSync(shell, ['-c', command], { cwd: repo, env, encoding: 'utf8' });
    assert.equal(ran.stdout, 'local:review a b\n/engine/docs\n', ran.stderr);
  });
}

test('without CLAUDE_ENV_FILE the entry does nothing and exits 0', () => {
  const env = { ...process.env };
  delete env.CLAUDE_ENV_FILE;
  const hook = spawnSync('/bin/sh', ['-c', envHookCommand], { cwd: makeTempDir(), env, encoding: 'utf8' });
  assert.equal(hook.status, 0, hook.stderr);
  assert.equal(hook.stdout, '');
});
