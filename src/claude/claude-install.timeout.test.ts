// The install writes the Stop entry's host timeout from the setting files
// (budget.stop_hook_timeout_seconds plus the 60 s reserve), repairs an entry an older
// weftwork wrote with 660 s, and refuses a setting it cannot use.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installInProject } from './claude-settings-file.ts';
import { stopHookCommand, weftworkOnPath } from './claude-install.ts';
import { cleanupTempDirs, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';

after(cleanupTempDirs);

const clis = { stop: weftworkOnPath, guard: weftworkOnPath };
const noUser = (): NodeJS.ProcessEnv => ({ XDG_CONFIG_HOME: makeTempDir() });

/** The timeouts of the Stop entries in `repo`'s settings. */
function stopTimeouts(repo: string): unknown[] {
  const value = JSON.parse(readFileSync(join(repo, '.claude', 'settings.json'), 'utf8')) as {
    hooks: { Stop: { hooks: { timeout?: unknown }[] }[] };
  };
  return value.hooks.Stop.flatMap((group) => group.hooks.map((hook) => hook.timeout));
}

test('with no setting the install writes 1860 s: the 1800 s default plus 60', () => {
  const repo = makeTestRepo();
  const result = installInProject(repo, clis, 'npm test', noUser());
  assert.ok(result.ok, result.ok ? '' : result.error);
  assert.deepEqual(stopTimeouts(repo), [1860]);
});

test('budget.stop_hook_timeout_seconds in the repository file sets the timeout the install writes', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': '---\nbudget:\n  stop_hook_timeout_seconds: 900\n' });
  const result = installInProject(repo, clis, 'npm test', noUser());
  assert.ok(result.ok, result.ok ? '' : result.error);
  assert.deepEqual(stopTimeouts(repo), [960]);
});

test('the user file sets it too, below the repository file', () => {
  const home = makeTempDir();
  mkdirSync(join(home, 'weftwork'));
  writeFileSync(join(home, 'weftwork', 'config.yaml'), 'budget:\n  stop_hook_timeout_seconds: 2400\n');
  const repo = makeTestRepo();
  assert.ok(installInProject(repo, clis, 'npm test', { XDG_CONFIG_HOME: home }).ok);
  assert.deepEqual(stopTimeouts(repo), [2460]);
});

test('an install repairs an entry an older weftwork wrote with 660 s', () => {
  const old = { type: 'command', command: stopHookCommand(weftworkOnPath, 'npm test'), timeout: 660 };
  const repo = makeTestRepo({ '.claude/settings.json': JSON.stringify({ hooks: { Stop: [{ hooks: [old] }] } }) });
  const result = installInProject(repo, clis, 'npm test', noUser());
  assert.ok(result.ok, result.ok ? '' : result.error);
  assert.equal(result.action, 'replaced');
  assert.deepEqual(stopTimeouts(repo), [1860]);
});

test('a setting it cannot use is refused, naming the key, and nothing is written', () => {
  const repo = makeTestRepo({ 'weftwork.yaml': '---\nbudget:\n  stop_hook_timeout_seconds: 10\n' });
  const result = installInProject(repo, clis, 'npm test', noUser());
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /budget\.stop_hook_timeout_seconds must be an integer from 60 to 86400/);
  assert.throws(() => readFileSync(join(repo, '.claude', 'settings.json')));
});
