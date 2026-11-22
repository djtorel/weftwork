// story: e16s02
// The design CLI as a real process in a temporary repository, with a fake
// reviewer that prints a fixed reply: a round is graded, its record and the
// marked screenshot are kept in the clone's design folder, the loop stops at
// its ceiling (rounds with no verdict included), and a lesson reaches the
// next round's prompt.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTempDir, makeTestRepo } from '../test-support/test-helpers.ts';
import { criteria } from './design.ts';
import { decodePng, encodePng } from './png-mark.ts';

after(cleanupTempDirs);

const designCli = join(import.meta.dirname, '..', 'design-cli.ts');

function run(cwd: string, input: object, env: NodeJS.ProcessEnv = {}) {
  const out = spawnSync(process.execPath, [designCli], { cwd, input: JSON.stringify(input), env: { ...isolatedEnv(), ...env }, encoding: 'utf8', timeout: 30000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

function reply(grade: number, extra = ''): string {
  return `${criteria.map((c) => `GRADE ${c.key}: ${c.key === 'layout' ? grade : 5} ok`).join('\n')}\n${extra}`;
}

/** A repository whose one design reviewer saves its prompt and prints the file `answer`. */
function setup(maxRounds = 5, extra = '') {
  const dir = makeTempDir();
  const answer = join(dir, 'answer.txt');
  // It saves the prompt and what it was given in seen/<round>, named for the
  // folder of the first image (the copies are gone after the round).
  const seen = join(dir, 'seen');
  const reviewer = `cat | { d="${seen}/$(basename "$(dirname "\${WEFTWORK_IMAGES%%,*}")")"; mkdir -p "$d"; cat > "$d/prompt.txt"; echo "$WEFTWORK_IMAGES" > "$d/images.txt"; echo "$WEFTWORK_IMAGES_DIR" > "$d/dir.txt"; echo "\${WEFTWORK_DIFF-unset}" > "$d/diff.txt"; cat ${JSON.stringify(answer)}; }`;
  const repo = makeTestRepo({ 'weftwork.yaml': `---\ndesign:\n  reviewers: [${JSON.stringify(reviewer)}]\n  max_rounds: ${maxRounds}\n${extra}` });
  const image = join(dir, 'home.desktop.png');
  writeFileSync(image, encodePng({ width: 200, height: 100, rgba: Buffer.alloc(200 * 100 * 4, 255) }));
  const common = join(repo, '.git', 'weftwork', 'design');
  return { repo, image, common, seen, answer: (text: string) => writeFileSync(answer, text) };
}

test('a round below the pass mark: changes, exit 1, with the record, the marked image and the index', () => {
  const t = setup();
  t.answer(reply(2, 'MARK home.desktop.png 20,10,100,50 layout: The cards overlap. Fix: add 24px between them.'));
  const out = run(t.repo, { images: [t.image], brief: 'The home screen of a notes app.' });
  assert.equal(out.status, 1, out.stderr);
  assert.match(out.stdout, /^weftwork design: changes$/m);
  assert.match(out.stdout, /^round: 1 of 5$/m);
  assert.match(out.stdout, /^below the pass mark: layout 2$/m);
  assert.match(out.stdout, /^mark 1 \(cat\) home\.desktop\.png \[20,10,100,50\] layout: The cards overlap\./m);
  const round = join(t.common, 'main', 'app', 'round-01');
  assert.match(readFileSync(join(round, 'round.md'), 'utf8'), /\| layout \| 2 \| 2 \(below\) \|/);
  // The path, so a reviewer with no shell (agy) can open an image from outside the repository.
  // The path of a copy outside the git dir, so a reviewer with no shell
  // (agy) can open it, and Claude Code, which reads nothing under .git, can too.
  const copy = /^- home\.desktop\.png at (\S+), 200 by 100 pixels$/m.exec(readFileSync(join(t.seen, 'round-01', 'prompt.txt'), 'utf8'))?.[1] ?? '';
  assert.match(copy, /\/round-01\/home\.desktop\.png$/);
  assert.doesNotMatch(copy, /\/\.git\//);
  assert.equal(readFileSync(join(t.seen, 'round-01', 'dir.txt'), 'utf8').trim(), copy.replace(/\/round-01\/home\.desktop\.png$/, ''));
  assert.equal(existsSync(copy), false, 'the copies are removed after the round');
  const marked = decodePng(readFileSync(join(round, 'marked', 'home.desktop.png')));
  assert.deepEqual(readFileSync(join(round, 'home.desktop.png')), readFileSync(t.image), 'the original is kept as it was');
  assert.ok(marked !== null);
  const at = (59 * 200 + 60) * 4;
  assert.deepEqual([...marked.rgba.subarray(at, at + 3)], [230, 0, 80], 'the bottom edge of the box is red');
  assert.match(readFileSync(join(t.common, 'README.md'), 'utf8'), /\| main \| \[app\]\(<main\/app\/loop\.md>\) \| 1 \|/);
  assert.match(readFileSync(join(t.common, 'main', 'app', 'loop.md'), 'utf8'), /\| \[1\]/);
});

test('a round at the pass mark with no must-fix: pass, exit 0', () => {
  const t = setup();
  t.answer(reply(4));
  const out = run(t.repo, { images: [t.image], brief: 'b', loop: 'canvas' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork design: pass$/m);
  assert.ok(existsSync(join(t.common, 'main', 'canvas', 'round-01', 'round.md')));
});

test('the ceiling: the last round stops the loop with exit 5, and a round past it runs no reviewer', () => {
  const t = setup(2);
  t.answer(reply(2));
  assert.equal(run(t.repo, { images: [t.image], brief: 'b' }).status, 1);
  const second = run(t.repo, { images: [t.image], brief: 'b' });
  assert.equal(second.status, 5, second.stderr);
  assert.match(second.stdout, /^stop: the ceiling: 2 of 2 rounds run$/m);
  const round2 = join(t.seen, 'round-02');
  assert.match(readFileSync(join(round2, 'prompt.txt'), 'utf8'), /This is round 2\. Round 1 gave the lowest grades/);
  assert.match(readFileSync(join(round2, 'prompt.txt'), 'utf8'), /Round 1's images, to compare with; do not mark them:\n- .*round-01\/home\.desktop\.png/);
  assert.deepEqual(readFileSync(join(round2, 'images.txt'), 'utf8').trim().split(',').map((path) => path.split('/').slice(-2).join('/')), ['round-02/home.desktop.png', 'round-01/home.desktop.png']);
  assert.doesNotMatch(readFileSync(join(round2, 'images.txt'), 'utf8'), /\/\.git\//);
  assert.ok(readFileSync(join(round2, 'images.txt'), 'utf8').startsWith(`${readFileSync(join(round2, 'dir.txt'), 'utf8').trim()}/`));
  const third = run(t.repo, { images: [t.image], brief: 'b' });
  assert.equal(third.status, 5);
  assert.match(third.stdout, /^weftwork design: stopped$/m);
  assert.equal(existsSync(join(t.common, 'main', 'app', 'round-03')), false);
});

test('a WEFTWORK_DIFF from the caller does not reach a design reviewer, which would open its folder', () => {
  const t = setup();
  t.answer(reply(5));
  assert.equal(run(t.repo, { images: [t.image], brief: 'b' }, { WEFTWORK_DIFF: '/elsewhere/change.diff' }).status, 0);
  assert.equal(readFileSync(join(t.seen, 'round-01', 'diff.txt'), 'utf8').trim(), 'unset');
});

test('a design round runs every reviewer by default; with design.panel 1, one that fails is replaced by the next', () => {
  const dir = makeTempDir();
  const answer = join(dir, 'answer.txt');
  writeFileSync(answer, reply(5));
  const image = join(dir, 'home.desktop.png');
  writeFileSync(image, encodePng({ width: 20, height: 10, rgba: Buffer.alloc(20 * 10 * 4, 255) }));
  const fake = (name: string, works: boolean) => `touch ${dir}/${name}; ${works ? `cat ${JSON.stringify(answer)}` : 'exit 7'}`;
  const list = (panel: string) => `---\ndesign:\n  reviewers: [${[fake('a', false), fake('b', true), fake('c', true)].map((c) => JSON.stringify(c)).join(', ')}]\n${panel}`;
  const ran = () => ['a', 'b', 'c'].filter((name) => existsSync(join(dir, name)));

  const all = makeTestRepo({ 'weftwork.yaml': list('') });
  assert.equal(run(all, { images: [image], brief: 'b' }).status, 0);
  assert.deepEqual(ran(), ['a', 'b', 'c']);

  for (const name of ['a', 'b', 'c']) rmSync(join(dir, name));
  const one = makeTestRepo({ 'weftwork.yaml': list('  panel: 1\n') });
  const out = run(one, { images: [image], brief: 'b' });
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.deepEqual(ran(), ['a', 'b']);
  assert.match(out.stdout, /^reviewer 1, touch: failed, exit 7$/m);
});

test('a design round goes on with the reviewers that have usage, says which to ask again, and does not ask that one in the next round', () => {
  const dir = makeTempDir();
  const answer = join(dir, 'answer.txt');
  writeFileSync(answer, reply(5));
  const image = join(dir, 'home.desktop.png');
  writeFileSync(image, encodePng({ width: 20, height: 10, rgba: Buffer.alloc(20 * 10 * 4, 255) }));
  const out = `touch ${dir}/ran; echo 'RESOURCE_EXHAUSTED: quota exceeded' >&2; exit 1`;
  const works = `cat ${JSON.stringify(answer)}`;
  const repo = makeTestRepo({ 'weftwork.yaml': `---\ndesign:\n  reviewers: [${[out, works, works].map((c) => JSON.stringify(c)).join(', ')}]\n` });
  const one = run(repo, { images: [image], brief: 'b' });
  assert.equal(one.status, 0, one.stdout + one.stderr);
  assert.match(one.stdout, /^reviewer 1, touch: failed, out of usage: RESOURCE_EXHAUSTED: quota exceeded$/m);
  assert.match(one.stdout, /^review again: 2 of 3 reviewers answered; touch did not \(out of usage: RESOURCE_EXHAUSTED: quota exceeded\)\. Go on with this round; list it in the pull request and the backlog$/m);

  rmSync(join(dir, 'ran'));
  const two = run(repo, { images: [image], brief: 'b' });
  assert.equal(two.status, 0, two.stdout + two.stderr);
  assert.equal(existsSync(join(dir, 'ran')), false);
  assert.match(two.stdout, /^reviewer 3, touch: not asked, resting until \S+ \(out of usage: RESOURCE_EXHAUSTED: quota exceeded\)$/m);
});

test('a lesson is kept in the clone and reaches the next round', () => {
  const t = setup();
  const kept = run(t.repo, { lesson: 'Primary buttons are 44px tall.', from: 'main/app round 1' });
  assert.equal(kept.status, 0, kept.stderr);
  assert.match(readFileSync(join(t.common, 'LESSONS.md'), 'utf8'), /^- Primary buttons are 44px tall\. \(from main\/app round 1, \d{4}-\d\d-\d\d\)$/m);
  t.answer(reply(5));
  run(t.repo, { images: [t.image], brief: 'b' });
  assert.match(readFileSync(join(t.seen, 'round-01', 'prompt.txt'), 'utf8'), /Primary buttons are 44px tall/);
});

test('a reply that grades nothing: no verdict, exit 3', () => {
  const t = setup();
  t.answer('Looks great!');
  const out = run(t.repo, { images: [t.image], brief: 'b' });
  assert.equal(out.status, 3, out.stderr);
  assert.match(out.stdout, /^reviewer 1, cat: failed, the reply does not grade purpose/m);
});

test('a round with no verdict uses up a round: a second one reaches a ceiling of 2, still no verdict, exit 5', () => {
  const t = setup(2);
  t.answer('Looks great!');
  assert.equal(run(t.repo, { images: [t.image], brief: 'b' }).status, 3);
  const second = run(t.repo, { images: [t.image], brief: 'b' });
  assert.equal(second.status, 5, second.stderr);
  assert.match(second.stdout, /^weftwork design: no-verdict$/m);
  assert.match(second.stdout, /^stop: the ceiling: 2 of 2 rounds run$/m);
});

test('bad input: exit 2 with the reason on stderr and nothing run', () => {
  const t = setup();
  writeFileSync(join(t.repo, 'not.png'), 'text');
  assert.equal(run(t.repo, { images: ['not.png'], brief: 'b' }).status, 2);
  assert.equal(run(t.repo, { images: [], brief: 'b' }).status, 2);
  assert.equal(run(t.repo, { images: [t.image] }).status, 2);
  assert.equal(existsSync(join(t.common, 'main')), false);
});

test('status: the loop rounds and where the record is', () => {
  const t = setup();
  t.answer(reply(3));
  run(t.repo, { images: [t.image], brief: 'b' });
  const out = run(t.repo, { status: true });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork design: 1 round on main\/app, last: changes, mean/m);
  assert.match(out.stdout, /^record: .*design\/main\/app\/loop\.md$/m);
});

test('a stall below the ceiling stops the loop, and the next call runs no reviewer', () => {
  const t = setup(9);
  const outs = [3, 3, 3].map((grade) => {
    t.answer(reply(grade));
    return run(t.repo, { images: [t.image], brief: 'b' });
  });
  assert.deepEqual(outs.map((out) => out.status), [1, 1, 5], 'the round that stalls says so itself');
  assert.match(outs[2]?.stdout ?? '', /^stop: stalled: 2 rounds in a row did not beat the best mean grade/m);
  const loop = readFileSync(join(t.common, 'main', 'app', 'loop.md'), 'utf8');
  assert.match(loop, /The loop stopped: stalled: 2 rounds in a row did not beat the best mean grade/);
  const next = run(t.repo, { images: [t.image], brief: 'b' });
  assert.equal(next.status, 5);
  assert.match(next.stdout, /^why: stalled/m);
  assert.equal(existsSync(join(t.common, 'main', 'app', 'round-04')), false);
});

test('branch names that make the same folder name keep separate records', async () => {
  const { designRoot, loopDir } = await import('./design-store.ts');
  const t = setup();
  const root = (await designRoot(t.repo)) as string;
  assert.notEqual(loopDir(root, 'feature/login', 'app'), loopDir(root, 'feature-login', 'app'));
  const encoded = loopDir(root, 'feature/login', 'app').split('/').at(-2) ?? '';
  assert.match(encoded, /^feature-login~[0-9a-f]{8}$/, 'an encoded name has a ~, which no name kept as it is can have');
  assert.notEqual(loopDir(root, encoded, 'app'), loopDir(root, 'feature/login', 'app'));
  assert.equal(loopDir(root, 'feature-login', 'app'), join(root, 'feature-login', 'app'));
});

test('an image whose name does not end in .png is refused', () => {
  const t = setup();
  const bare = join(t.repo, '..', 'marked');
  writeFileSync(bare, readFileSync(t.image));
  const out = run(t.repo, { images: [bare], brief: 'b' });
  assert.equal(out.status, 2);
  assert.match(out.stderr, /must end in \.png/);
});

test('an image name with a space is refused, since a mark names its image by one word', () => {
  const t = setup();
  const spaced = join(t.repo, '..', 'home page.png');
  writeFileSync(spaced, readFileSync(t.image));
  const out = run(t.repo, { images: [spaced], brief: 'b' });
  assert.equal(out.status, 2);
  assert.match(out.stderr, /has a space/);
});

/** `count` copies of the test image, named home.<n>.png, beside it. */
function copies(image: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const path = join(image, '..', `home.${i + 1}.png`);
    writeFileSync(path, readFileSync(image));
    return path;
  });
}

test('the default allows 50 images a round, and design.max_images changes it', () => {
  const t = setup();
  t.answer(reply(4));
  const fifty = run(t.repo, { images: copies(t.image, 50), brief: 'b' });
  assert.equal(fifty.status, 0, fifty.stderr);
  const many = run(t.repo, { images: copies(t.image, 51), brief: 'b' });
  assert.equal(many.status, 2);
  assert.match(many.stderr, /"images" must be a list of 1 to 50 PNG file paths \(design\.max_images\)/);
  const raised = setup(5, '  max_images: 60\n');
  raised.answer(reply(4));
  assert.equal(run(raised.repo, { images: copies(raised.image, 60), brief: 'b' }).status, 0);
});
