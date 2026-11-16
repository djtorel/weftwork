// `weftwork update [path]` from the terminal: it shows the plan, and writes
// only with --yes or a yes at the prompt; with neither and no terminal it is a
// dry run.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { skillTexts } from './setup.ts';
import { cleanupTempDirs, isolatedEnv, makeTestRepo } from './test-helpers.ts';

after(cleanupTempDirs);

const bin = join(import.meta.dirname, 'weftwork-cli.ts');
const engineDir = join(import.meta.dirname, '..');

function update(args: string[], cwd: string) {
  const out = spawnSync(process.execPath, [bin, 'update', ...args], { cwd, env: isolatedEnv(), encoding: 'utf8', timeout: 60000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

/** A project with this version's skills, less weft-improve: one behind. */
function behindByOne(): string {
  const texts = skillTexts(engineDir);
  assert.ok(texts.ok);
  const dir = makeTestRepo(Object.fromEntries(texts.files));
  rmSync(join(dir, '.claude/skills/weft-improve'), { recursive: true });
  return dir;
}

test('with no terminal and no --yes, update shows the plan and writes nothing', () => {
  const dir = behindByOne();
  const out = update([], dir);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /create +\.claude\/skills\/weft-improve\/SKILL\.md/);
  assert.match(out.stdout, /weftwork update --yes/);
  assert.equal(existsSync(join(dir, '.claude/skills/weft-improve/SKILL.md')), false);
});

test('update --yes writes the plan, and then the project is up to date', () => {
  const dir = behindByOne();
  const out = update(['--yes'], dir);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /wrote +\.claude\/skills\/weft-improve\/SKILL\.md/);
  assert.ok(readFileSync(join(dir, '.claude/skills/weft-improve/SKILL.md'), 'utf8').startsWith('---\nname: weft-improve'));
  const again = update([], dir);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /up to date/);
});

test('update takes the project folder as its argument', () => {
  const dir = behindByOne();
  const out = update(['--yes', dir], makeTestRepo());
  assert.equal(out.status, 0, out.stderr);
  assert.ok(existsSync(join(dir, '.claude/skills/weft-improve/SKILL.md')));
});

test('a folder weftwork did not set up is refused with exit 1 and the command that sets it up', () => {
  const out = update([], makeTestRepo({ 'README.md': '# x\n' }));
  assert.equal(out.status, 1);
  assert.match(out.stderr, /weftwork update: .*weftwork init/);
});

test('--help prints the usage; an unknown option exits 2', () => {
  const help = update(['--help'], makeTestRepo());
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Usage: weftwork update \[path\]/);
  const bad = update(['--nope'], makeTestRepo());
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Usage: weftwork update/);
});
