// story: e11s05
// The UI CLI as a real process in a temporary repository: it runs ui.screenshot
// with WEFTWORK_SHOTS set, keeps the PNG files it wrote in the engine's folder,
// and refuses before screenshots once the tree already changes ui.paths.
// Exit 0 taken (or UI checks off), 1 refused or failed, 2 when it cannot run.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTestRepo, writePng } from './test-helpers.ts';
import { weftworkDir } from './ledger.ts';

after(cleanupTempDirs);

const uiCli = join(import.meta.dirname, 'ui-cli.ts');

function ui(cwd: string, input: object) {
  const out = spawnSync(process.execPath, [uiCli], { cwd, input: JSON.stringify(input), env: isolatedEnv(), encoding: 'utf8', timeout: 30000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

function uiRepo(screenshot: string): string {
  return makeTestRepo({ 'weftwork.yaml': `---\nui:\n  screenshot: ${JSON.stringify(screenshot)}\n  paths: ['web/**']\n`, 'web/a.html': '<p>a</p>\n' });
}

test('no ui setting: UI checks are off, exit 0, and nothing runs', () => {
  const out = ui(makeTestRepo(), { phase: 'before' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork ui: off$/m);
});

test('before, on a tree with no UI change: the PNG files are kept with their hashes', async () => {
  const repo = uiRepo(writePng('home.png'));
  const out = ui(repo, { phase: 'before' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork ui: taken$/m);
  assert.match(out.stdout, /^before: .*\/ui\/before\/home\.png 8 bytes sha256:[0-9a-f]{12}$/m);
  const manifest = JSON.parse(readFileSync(join((await weftworkDir(repo)) as string, 'ui', 'before', 'manifest.json'), 'utf8'));
  assert.equal(manifest.branch, 'main');
  assert.deepEqual(manifest.files.map((f: { name: string }) => f.name), ['home.png']);
});

test('before, once the tree changes ui.paths: refused, exit 1, and the command does not run', () => {
  const repo = uiRepo(`${writePng('home.png')}; touch ran`);
  writeFileSync(join(repo, 'web', 'a.html'), '<p>b</p>\n');
  const out = ui(repo, { phase: 'before' });
  assert.equal(out.status, 1, out.stderr);
  assert.match(out.stdout, /^weftwork ui: refused$/m);
  assert.match(out.stdout, /^why: the tree already changes ui\.paths: web\/a\.html$/m);
  assert.equal(existsSync(join(repo, 'ran')), false);
});

test('after a UI change: taken, exit 0', () => {
  const repo = uiRepo(writePng('home.png'));
  writeFileSync(join(repo, 'web', 'a.html'), '<p>b</p>\n');
  const out = ui(repo, { phase: 'after' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^after: .*home\.png 8 bytes/m);
});

for (const [name, command, why] of [
  ['a command that fails', 'exit 3', /^why: the screenshot command failed: exit 3$/m],
  ['a command that writes no PNG', 'echo hi > "$WEFTWORK_SHOTS/a.txt"', /^why: the screenshot command wrote no PNG file$/m],
  ['a file named .png that is not a PNG', 'echo hi > "$WEFTWORK_SHOTS/a.png"', /^why: a\.png is not a PNG file$/m],
  ['a command that changes the tree', `${writePng('a.png')}; echo x > tracked.txt`, /^why: the screenshot command changed the tree$/m],
] as [string, string, RegExp][]) {
  test(`${name}: failed, exit 1`, () => {
    const out = ui(uiRepo(command), { phase: 'after' });
    assert.equal(out.status, 1, out.stderr);
    assert.match(out.stdout, /^weftwork ui: failed$/m);
    assert.match(out.stdout, why);
  });
}

test('a bad phase: exit 2 with the reason on stderr', () => {
  const out = ui(makeTestRepo(), { phase: 'during' });
  assert.equal(out.status, 2);
  assert.match(out.stderr, /"phase" must be "before" or "after"/);
});
