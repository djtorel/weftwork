// story: e11s03
// The review CLI as a real process in a temporary repository: the engine CLI
// passes the done gate, then the review CLI runs the reviewers from
// weftwork.yaml and counts the round in the ledger. Exit 0 pass, 1 block,
// 3 no verdict, 4 the done gate has not passed, 5 the round ceiling, 2 when
// it cannot run.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, git, isolatedEnv, makeTempDir, makeTestRepo, writePng } from '../test-support/test-helpers.ts';
import { ledgerPath, weftworkDir } from '../engine/ledger.ts';
import { defaultReviewers } from './review-setting.ts';

after(cleanupTempDirs);

const engineCli = join(import.meta.dirname, '..', 'cli.ts');
const reviewCli = join(import.meta.dirname, '..', 'review-cli.ts');
const verify = 'true';

function node(script: string, cwd: string, input: object, env: NodeJS.ProcessEnv = {}) {
  const out = spawnSync(process.execPath, [script], { cwd, input: JSON.stringify(input), env: { ...isolatedEnv(), ...env }, encoding: 'utf8', timeout: 30000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

/** A repository whose weftwork.yaml holds `review`, with the done gate passed. */
function readyRepo(review: string): string {
  const repo = makeTestRepo();
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${review}`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  return repo;
}

const reviewers = (...commands: string[]) => `  reviewers:\n${commands.map((c) => `    - ${JSON.stringify(c)}\n`).join('')}`;
const review = (repo: string, extra: object = {}) => node(reviewCli, repo, { command: verify, brief: 'Review the diff.', ...extra });

test('the done gate has not passed: exit 4, and no reviewer runs', () => {
  const marker = join(makeTempDir(), 'ran');
  const repo = makeTestRepo();
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers(`touch ${marker}; echo 'VERDICT: APPROVE'`)}`);
  const out = review(repo);
  assert.equal(out.status, 4, out.stderr);
  assert.match(out.stdout, /^weftwork review: not run$/m);
  assert.match(out.stdout, /^why: the done gate has not passed: the ledger has no run of this command$/m);
  assert.equal(existsSync(marker), false);
});

test('a reviewer reads the brief and the reply format on stdin; an approval passes: exit 0', () => {
  const repo = readyRepo(reviewers("grep -c -e 'Review the diff' -e 'VERDICT: APPROVE or CHANGES' | grep -qx 2 && echo 'VERDICT: APPROVE'"));
  const out = review(repo);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork review: pass$/m);
  assert.match(out.stdout, /^round: 1 of 3$/m);
  assert.match(out.stdout, /^reviewer 1, grep: 0 must-fix, 0 should-fix$/m);
});

test('the engine writes the change from the base to a file, names it in the brief and in WEFTWORK_DIFF, for a reviewer that cannot run git', () => {
  const dir = makeTempDir();
  const repo = makeTestRepo({ 'tracked.txt': 'one\n' });
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers(`cat > ${dir}/prompt; cp "$WEFTWORK_DIFF" ${dir}/diff; echo 'VERDICT: APPROVE'`)}`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'setting');
  writeFileSync(join(repo, 'tracked.txt'), 'two\n');
  writeFileSync(join(repo, 'new.txt'), 'untracked\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  const out = node(reviewCli, repo, { command: verify, brief: 'Review the diff.' }, { WEFTWORK_DIFF: '/from/the/caller' });
  assert.equal(out.status, 0, out.stdout + out.stderr);
  const diff = readFileSync(join(dir, 'diff'), 'utf8');
  assert.match(diff, /^-one\n\+two$/m);
  assert.match(diff, /^\+\+\+ b\/new\.txt\n@@ -0,0 \+1 @@\n\+untracked$/m);
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  assert.match(readFileSync(join(dir, 'prompt'), 'utf8'), new RegExp(`^The change from the base ${base} to the working tree under review, untracked files included, is the git diff in /.+/change\\.diff\\.`, 'm'));
});

test('the diff file and the diff size cover the whole change from a subfolder, also with diff.relative set', () => {
  const dir = makeTempDir();
  const repo = makeTestRepo({ 'tracked.txt': 'one\n', 'sub/a.txt': 'a\n' });
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers(`cp "$WEFTWORK_DIFF" ${dir}/diff; echo 'VERDICT: APPROVE'`)}`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'setting');
  git(repo, 'config', 'diff.relative', 'true');
  writeFileSync(join(repo, 'tracked.txt'), 'two\n');
  const sub = join(repo, 'sub');
  assert.equal(node(engineCli, sub, { command: verify }).status, 0);
  const out = node(reviewCli, sub, { command: verify, brief: 'Review the diff.' });
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.match(readFileSync(join(dir, 'diff'), 'utf8'), /^\+\+\+ b\/tracked\.txt$/m);
  assert.match(out.stdout, /^diff: 2 lines changed from the base$/m);
});

test('with no base there is no diff file, and a WEFTWORK_DIFF from the caller does not reach a reviewer', () => {
  const dir = makeTempDir();
  const repo = makeTestRepo();
  git(repo, 'branch', '-m', 'trunk');
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers(`cat > ${dir}/prompt; echo "\${WEFTWORK_DIFF-unset}" > ${dir}/diff; echo 'VERDICT: APPROVE'`)}`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  const out = node(reviewCli, repo, { command: verify, brief: 'Review the diff.' }, { WEFTWORK_DIFF: '/from/the/caller' });
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.equal(readFileSync(join(dir, 'diff'), 'utf8').trim(), 'unset');
  assert.doesNotMatch(readFileSync(join(dir, 'prompt'), 'utf8'), /The change from the base/);
});

test('a must-fix blocks: exit 1, and the round is counted in the ledger', async () => {
  const repo = readyRepo(reviewers("printf 'VERDICT: CHANGES\\nMUST-FIX tracked.txt:1 bad\\nSHOULD-FIX b.ts:2 meh\\n'"));
  const out = review(repo);
  assert.equal(out.status, 1, out.stderr);
  assert.match(out.stdout, /^weftwork review: block$/m);
  assert.match(out.stdout, /^must-fix r\d+m\d+ \(printf\): tracked\.txt:1 bad$/m);
  const ledger = readFileSync((await ledgerPath(repo)) as string, 'utf8');
  assert.match(ledger, /"review":"block","branch":"main","round":1,"maxRounds":3/);
});

test('a must-fix whose file or line does not exist does not block: it is reported as a should-fix (e13s02)', () => {
  const repo = readyRepo(reviewers("printf 'VERDICT: CHANGES\\nMUST-FIX nope.ts:1 made up\\nMUST-FIX tracked.txt:9 past the end\\n'"));
  const out = review(repo);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork review: pass$/m);
  assert.match(out.stdout, /^should-fix r\d+s\d+ \(printf\): nope\.ts:1 made up \[not grounded: nope\.ts is not a file in the repository\]$/m);
  assert.match(out.stdout, /^should-fix r\d+s\d+ \(printf\): tracked\.txt:9 past the end \[not grounded: line 9 is past the end of tracked\.txt, 1 line\]$/m);
});

test('a follow-up is reported and stored, and never blocks (e13s02)', async () => {
  const repo = readyRepo(reviewers("printf 'VERDICT: APPROVE\\nFOLLOW-UP tracked.txt:1 an old bug\\n'"));
  const out = review(repo);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^follow-up r\d+f\d+ \(printf\): tracked\.txt:1 an old bug$/m);
  const ledger = readFileSync((await ledgerPath(repo)) as string, 'utf8');
  assert.match(ledger, /"followUp":\["\(printf\): tracked\.txt:1 an old bug"\]/);
  assert.match(ledger, /"tree":"[0-9a-f]{40,64}","diffLines":\d+/);
});

test('the report shows the lines changed from the base, and from round 2 the size at round 1 (e13s02)', () => {
  const repo = readyRepo(reviewers("echo 'VERDICT: APPROVE'"));
  const one = review(repo);
  assert.equal(one.status, 0, one.stderr);
  assert.match(one.stdout, /^diff: \d+ lines changed from the base$/m);
  writeFileSync(join(repo, 'big.txt'), 'x\n'.repeat(400));
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  const two = review(repo);
  assert.equal(two.status, 0, two.stderr);
  assert.match(two.stdout, /^diff: \d+ lines changed from the base, \d+ at round 1$/m);
  assert.match(two.stdout, /^diff growth: past twice round 1 and 200 lines more; cut the diff before the next round$/m);
});

test('round 2 is told the files changed since round 1 and the open must-fix findings; a new must-fix on an unchanged file is marked and still blocks (e13s02)', () => {
  const dir = makeTempDir();
  const count = join(dir, 'count');
  const prompt = join(dir, 'prompt');
  const reviewer = `cat > ${prompt}; n=$(cat ${count} 2>/dev/null || echo 0); echo $((n+1)) > ${count}; if [ $n = 0 ]; then printf 'VERDICT: CHANGES\\nMUST-FIX tracked.txt:1 bad\\n'; else printf 'VERDICT: CHANGES\\nMUST-FIX other.txt:1 new\\n'; fi`;
  const repo = makeTestRepo({ 'tracked.txt': 'one\n', 'other.txt': 'other\n' });
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers(reviewer)}`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(review(repo).status, 1);
  assert.doesNotMatch(readFileSync(prompt, 'utf8'), /This is round/);
  writeFileSync(join(repo, 'tracked.txt'), 'fixed\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  const two = review(repo);
  assert.equal(two.status, 1, two.stderr);
  const text = readFileSync(prompt, 'utf8');
  assert.match(text, /^This is round 2\. Review only what changed since round 1/m);
  assert.match(text, /^Files changed since round 1:\n- tracked\.txt$/m);
  assert.match(text, /^Must-fix findings open after round 1:\n- \(cat\): tracked\.txt:1 bad$/m);
  assert.match(two.stdout, /^must-fix r\d+m\d+ \(cat\): other\.txt:1 new \[new, on a file unchanged since round 1\]$/m);
});

test('review.sensitive_paths: a change to a matching file gets max_rounds_sensitive, and the report says which file (e13s02)', () => {
  const repo = makeTestRepo();
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers("echo 'VERDICT: APPROVE'")}  max_rounds: 1\n  max_rounds_sensitive: 2\n  sensitive_paths: ['auth/**']\n`);
  mkdirSync(join(repo, 'auth'));
  writeFileSync(join(repo, 'auth', 'login.ts'), 'x\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  const one = review(repo);
  assert.equal(one.status, 0, one.stderr);
  assert.match(one.stdout, /^round: 1 of 2$/m);
  assert.match(one.stdout, /^sensitive: yes, auth\/login\.ts matches review\.sensitive_paths$/m);
  assert.equal(review(repo).status, 0);
  assert.equal(review(repo).status, 5);
});

test('a base of HEAD cannot hide a committed change to a sensitive path: the default base decides (e13s02, review round 1)', () => {
  const repo = makeTestRepo();
  git(repo, 'checkout', '-q', '-b', 'feat/x');
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers("echo 'VERDICT: APPROVE'")}  max_rounds: 1\n  max_rounds_sensitive: 2\n  sensitive_paths: ['auth/**']\n`);
  mkdirSync(join(repo, 'auth'));
  writeFileSync(join(repo, 'auth', 'login.ts'), 'x\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'auth');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  const out = review(repo, { base: 'HEAD' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^round: 1 of 2$/m);
});

test('every reviewer gets the audit checklist; a sensitive change also gets the security audit (e13s03)', () => {
  const prompt = join(makeTempDir(), 'prompt');
  const repo = makeTestRepo({ 'tracked.txt': 'one\n', 'AGENTS.md': 'rules\n' });
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers(`cat > ${prompt}; echo 'VERDICT: APPROVE'`)}`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(review(repo).status, 0);
  const plain = readFileSync(prompt, 'utf8');
  assert.match(plain, /^Audit the change for each of these, in this order:$/m);
  assert.match(plain, /^3\. Rules: the project rules in AGENTS\.md;/m);
  assert.doesNotMatch(plain, /^5\. Security:/m);
  assert.ok(plain.indexOf('Audit the change') < plain.indexOf('VERDICT: APPROVE or CHANGES'));
  assert.equal(review(repo, { sensitive: true }).status, 0);
  assert.match(readFileSync(prompt, 'utf8'), /^5\. Security:/m);
});

test('a change the brief marks sensitive says so in the report (e13s02)', () => {
  const repo = readyRepo(reviewers("echo 'VERDICT: APPROVE'"));
  const out = review(repo, { sensitive: true });
  assert.match(out.stdout, /^sensitive: yes, the brief asked$/m);
  assert.doesNotMatch(review(repo).stdout, /^sensitive:/m);
});

test('at the round ceiling: exit 5, the last round\'s findings again, and no reviewer runs', () => {
  const log = join(makeTempDir(), 'runs');
  const repo = readyRepo(`${reviewers(`echo run >> ${log}; printf 'VERDICT: CHANGES\\nMUST-FIX tracked.txt:1 bad\\n'`)}  max_rounds: 1\n`);
  assert.equal(review(repo).status, 1);
  const out = review(repo);
  assert.equal(out.status, 5, out.stderr);
  assert.match(out.stdout, /^weftwork review: exhausted$/m);
  assert.match(out.stdout, /^why: 1 round on this branch, the ceiling is 1$/m);
  assert.match(out.stdout, /^unresolved must-fix r\d+m\d+ \(echo\): tracked\.txt:1 bad$/m);
  assert.equal(readFileSync(log, 'utf8'), 'run\n');
});

test('a detached HEAD: exit 2 every time, the reason on stderr, and no reviewer runs, since rounds are counted per branch', () => {
  const log = join(makeTempDir(), 'runs');
  const repo = readyRepo(`${reviewers(`echo run >> ${log}; echo 'VERDICT: APPROVE'`)}  max_rounds: 1\n`);
  git(repo, 'checkout', '--detach');
  for (let run = 0; run < 2; run++) {
    const out = review(repo);
    assert.equal(out.status, 2, out.stdout);
    assert.equal(out.stdout, '');
    assert.match(out.stderr, /^review: HEAD is detached; review rounds are counted per branch, so check out a branch first$/m);
  }
  assert.equal(existsSync(log), false);
});

test('a sensitive change gets max_rounds_sensitive', () => {
  const repo = readyRepo(`${reviewers("echo 'VERDICT: APPROVE'")}  max_rounds: 1\n  max_rounds_sensitive: 2\n`);
  assert.equal(review(repo, { sensitive: true }).status, 0);
  const second = review(repo, { sensitive: true });
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /^round: 2 of 2$/m);
  assert.equal(review(repo, { sensitive: true }).status, 5);
});

test('a reviewer that fails counts as neither pass nor block', () => {
  const one = readyRepo(reviewers('exit 3', "echo 'VERDICT: APPROVE'"));
  const out = review(one);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^reviewer 1, exit: failed, exit 3$/m);

  // A reviewer whose CLI is not installed fails, and the next stands in (docs/REVIEW.md § The panel).
  const missing = readyRepo(reviewers('weftwork-no-such-reviewer -p', "echo 'VERDICT: APPROVE'"));
  const gone = review(missing);
  assert.equal(gone.status, 0, gone.stderr);
  assert.match(gone.stdout, /^reviewer 1, weftwork-no-such-reviewer: failed, exit 127: .*not found$/m);
  assert.match(gone.stdout, /^reviewer 2, echo: 0 must-fix, 0 should-fix$/m);

  const big = readyRepo(reviewers("echo 'VERDICT: APPROVE'; head -c 1100000 /dev/zero | tr '\\0' x"));
  const cut = review(big);
  assert.equal(cut.status, 3, cut.stderr);
  assert.match(cut.stdout, /^reviewer 1, echo: failed, the reply is larger than 1048576 bytes$/m);

  const none = readyRepo(`${reviewers('sleep 5', 'echo no verdict here')}  timeout_seconds: 1\n`);
  const all = review(none);
  assert.equal(all.status, 3, all.stderr);
  assert.match(all.stdout, /^weftwork review: no verdict$/m);
  assert.match(all.stdout, /^reviewer 1, sleep: failed, timed out after 1 s$/m);
  assert.match(all.stdout, /^reviewer 2, echo: failed, the reply has no VERDICT line$/m);
});

/** Three reviewers named cat, touch and echo (the first word) that each
 * leave a mark in `dir` when they run. Each answers only when `dir/<x>-ok`
 * exists, else exits 7; cat and echo approve, touch blocks. */
function panelReviewers(dir: string): string[] {
  const answer = (x: string, reply: string) => `test -f ${dir}/${x}-ok || exit 7; printf '${reply}'`;
  return [
    `cat > /dev/null; touch ${dir}/a; ${answer('a', 'VERDICT: APPROVE\\n')}`,
    `touch ${dir}/b; ${answer('b', 'VERDICT: CHANGES\\nMUST-FIX tracked.txt:1 bad\\n')}`,
    `echo > /dev/null; touch ${dir}/c; ${answer('c', 'VERDICT: APPROVE\\n')}`,
  ];
}

/** Which of the panelReviewers ran, and make `names` answer. */
const ran = (dir: string) => ['a', 'b', 'c'].filter((name) => existsSync(join(dir, name)));
const ok = (dir: string, ...names: string[]) => names.forEach((name) => writeFileSync(join(dir, `${name}-ok`), ''));

test('a panel of 1 (the built-in): only the first reviewer runs when it answers (docs/REVIEW.md § The panel)', () => {
  const dir = makeTempDir();
  ok(dir, 'a', 'b', 'c');
  const out = review(readyRepo(reviewers(...panelReviewers(dir))));
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(ran(dir), ['a']);
  assert.match(out.stdout, /^panel: 1 of 3 reviewers \(review\.panel\)$/m);
  assert.doesNotMatch(out.stdout, /^reviewer 2/m);
});

test('a reviewer that fails is replaced by the next in order, and the later ones do not run', () => {
  const dir = makeTempDir();
  ok(dir, 'b', 'c');
  const out = review(readyRepo(reviewers(...panelReviewers(dir))));
  assert.equal(out.status, 1, out.stdout + out.stderr);
  assert.deepEqual(ran(dir), ['a', 'b']);
  assert.match(out.stdout, /^reviewer 1, cat: failed, exit 7$/m);
  assert.match(out.stdout, /^reviewer 2, touch: 1 must-fix, 0 should-fix$/m);
});

test('a sensitive change, and a request for "all", run every reviewer; a bad panel is exit 2', () => {
  const dir = makeTempDir();
  ok(dir, 'a', 'b', 'c');
  const sensitive = review(readyRepo(reviewers(...panelReviewers(dir))), { sensitive: true });
  assert.equal(sensitive.status, 1, sensitive.stderr);
  assert.deepEqual(ran(dir), ['a', 'b', 'c']);
  assert.match(sensitive.stdout, /^panel: 3 of 3 reviewers \(a sensitive change\)$/m);

  const all = makeTempDir();
  ok(all, 'a', 'b', 'c');
  const asked = review(readyRepo(reviewers(...panelReviewers(all))), { panel: 'all' });
  assert.deepEqual(ran(all), ['a', 'b', 'c']);
  assert.match(asked.stdout, /^panel: 3 of 3 reviewers \(asked for in the request\)$/m);

  for (const panel of [0, 6, 'some', 1.5]) {
    const bad = review(readyRepo(reviewers("echo 'VERDICT: APPROVE'")), { panel });
    assert.equal(bad.status, 2, `${panel}: ${bad.stdout}`);
    assert.match(bad.stderr, /"panel" must be "all" or an integer from 1 to 5/);
  }
});

test('a later round asks first the reviewer that answered the last one, and the ledger keeps it', async () => {
  const dir = makeTempDir();
  ok(dir, 'b');
  const repo = readyRepo(reviewers(...panelReviewers(dir)));
  const one = review(repo);
  assert.equal(one.status, 1, one.stdout + one.stderr);
  assert.deepEqual(ran(dir), ['a', 'b']);
  assert.match(readFileSync((await ledgerPath(repo)) as string, 'utf8'), /"answered":\["touch"\]/);
  // Now cat would answer too, but touch raised the must-fix, so it goes first.
  ok(dir, 'a');
  rmSync(join(dir, 'a'));
  rmSync(join(dir, 'b'));
  writeFileSync(join(repo, 'tracked.txt'), 'fixed\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  const two = review(repo);
  assert.equal(two.status, 1, two.stdout + two.stderr);
  assert.deepEqual(ran(dir), ['b']);
});

test('a reviewer that changes the tree: no verdict, since the review was not of this tree', () => {
  const repo = readyRepo(reviewers("echo two > tracked.txt; echo 'VERDICT: APPROVE'"));
  const out = review(repo);
  assert.equal(out.status, 3, out.stderr);
  assert.match(out.stdout, /^why: the tree changed during the review; a reviewer must be read-only$/m);
});

test('at most 2 reviewers run at once, also in a panel of all', () => {
  const log = join(makeTempDir(), 'log');
  const one = `echo s >> ${log}; sleep 0.4; echo e >> ${log}; echo 'VERDICT: APPROVE'`;
  const repo = readyRepo(reviewers(one, one, one));
  assert.equal(review(repo, { panel: 'all' }).status, 0);
  assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 6);
  let running = 0;
  let most = 0;
  for (const mark of readFileSync(log, 'utf8').trim().split('\n')) {
    running += mark === 's' ? 1 : -1;
    most = Math.max(most, running);
  }
  assert.equal(most, 2);
});

for (const [name, input, cwd] of [
  ['no command', { brief: 'x' }, () => makeTestRepo()],
  ['no brief', { command: verify }, () => makeTestRepo()],
  ['sensitive is not a boolean', { command: verify, brief: 'x', sensitive: 'yes' }, () => makeTestRepo()],
  ['not a git repository', { command: verify, brief: 'x' }, () => makeTempDir()],
] as [string, object, () => string][]) {
  test(`${name}: exit 2, nothing on stdout, the reason on stderr`, () => {
    const out = node(reviewCli, cwd(), input);
    assert.equal(out.status, 2);
    assert.equal(out.stdout, '');
    assert.notEqual(out.stderr.trim(), '');
  });
}

test('a bad review setting: exit 2, with the file and the key', () => {
  const repo = readyRepo('  max_rounds: 0\n');
  const out = review(repo);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /weftwork\.yaml: review\.max_rounds must be/);
});

/** A repository with UI checks on and web/a.html changed, the done gate passed. */
function uiChangedRepo(reviewer: string, extra = ''): string {
  const repo = makeTestRepo();
  mkdirSync(join(repo, 'web'));
  writeFileSync(join(repo, 'web', 'a.html'), '<p>a</p>\n');
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers(reviewer)}ui:\n  screenshot: ${JSON.stringify(writePng('home.png'))}\n  paths: ['web/**']\n${extra}`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  return repo;
}

const uiCli = join(import.meta.dirname, '..', 'ui-cli.ts');

test('a change to ui.paths without after screenshots of this tree: exit 4, and no reviewer runs (e11s05)', () => {
  const marker = join(makeTempDir(), 'ran');
  const repo = uiChangedRepo(`touch ${marker}; echo 'VERDICT: APPROVE'`);
  const out = review(repo);
  assert.equal(out.status, 4, out.stderr);
  assert.match(out.stdout, /^why: the change touches ui\.paths \(web\/a\.html\) and there are no after screenshots of this tree$/m);
  assert.equal(existsSync(marker), false);
});

test('with after screenshots: the reviewers read their paths, a score is reported, and only a must-fix gates (e11s05)', () => {
  const repo = uiChangedRepo("grep -c -e 'ui/after/home.png' -e 'before: none were taken' | grep -qx 2 && printf 'VERDICT: APPROVE\\nUI-SCORE: 1\\n'");
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  const out = review(repo);
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.match(out.stdout, /^weftwork review: pass$/m);
  assert.match(out.stdout, /^ui score \(grep\): 1 of 10, reported, not a gate$/m);
  assert.match(out.stdout, /^after: .*\/ui\/after\/home\.png 8 bytes sha256:[0-9a-f]{12}$/m);
});

test('after screenshots of an older tree do not count (e11s05)', () => {
  const repo = uiChangedRepo("echo 'VERDICT: APPROVE'");
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  writeFileSync(join(repo, 'web', 'a.html'), '<p>c</p>\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(review(repo).status, 4);
});

test('a change that does not touch ui.paths needs no screenshots (e11s05)', () => {
  const repo = makeTestRepo();
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers("echo 'VERDICT: APPROVE'")}ui:\n  screenshot: 'exit 1'\n  paths: ['web/**']\n`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(review(repo).status, 0);
});

test('before screenshots of another base are not used as the baseline (e11s05, review round 1)', () => {
  const repo = makeTestRepo();
  mkdirSync(join(repo, 'web'));
  writeFileSync(join(repo, 'web', 'a.html'), '<p>a</p>\n');
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers("grep -q 'before: none were taken' && echo 'VERDICT: APPROVE'")}ui:\n  screenshot: ${JSON.stringify(writePng('home.png'))}\n  paths: ['web/**']\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'old base');
  assert.equal(node(uiCli, repo, { phase: 'before' }).status, 0);
  writeFileSync(join(repo, 'web', 'b.html'), '<p>new</p>\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'new base');
  writeFileSync(join(repo, 'web', 'a.html'), '<p>b</p>\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  const out = review(repo);
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.match(out.stdout, /^before: none were taken$/m);
});

test('a UI change is reviewed as a design audit: the checklist and the severity rule are in the brief (e11s06)', () => {
  const brief = join(makeTempDir(), 'brief');
  const repo = uiChangedRepo(`cat > ${brief}; echo 'VERDICT: APPROVE'`);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  assert.equal(review(repo).status, 0);
  const text = readFileSync(brief, 'utf8');
  for (const line of [/^- hierarchy/m, /^- colour and contrast$/m, /^- states \(hover, focus, disabled, error, empty, loading\)/m, /^Severity: MUST-FIX only for an objective break/m, /judgement call is SHOULD-FIX/, /there is no design reference/]) assert.match(text, line);
});

test('a design MUST-FIX names its evidence, and contrast seen only in a screenshot is SHOULD-FIX (e11s07, R18)', () => {
  const brief = join(makeTempDir(), 'brief');
  const repo = uiChangedRepo(`cat > ${brief}; echo 'VERDICT: APPROVE'`);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  assert.equal(review(repo).status, 0);
  const text = readFileSync(brief, 'utf8');
  assert.match(text, /^A design MUST-FIX names its evidence: /m);
  assert.match(text, /^A contrast or exact-colour finding seen only in a screenshot is SHOULD-FIX/m);
});

test('ui.design adds the design reference to the brief (e11s06)', () => {
  const repo = uiChangedRepo("grep -q 'Primary colour is #0055ff' && echo 'VERDICT: APPROVE'", '  design: DESIGN.md\n');
  writeFileSync(join(repo, 'DESIGN.md'), '# Design\nPrimary colour is #0055ff.\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  const out = review(repo);
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

test('a ui.design file that does not exist: exit 2, and no reviewer runs (e11s06)', () => {
  const marker = join(makeTempDir(), 'ran');
  const repo = uiChangedRepo(`touch ${marker}; echo 'VERDICT: APPROVE'`, '  design: DESIGN.md\n');
  // The file is there for the screenshots (ui-cli checks it too) and gone by
  // the review; it is ignored, so the tree the screenshots show is the same.
  writeFileSync(join(repo, '.gitignore'), 'DESIGN.md\n');
  writeFileSync(join(repo, 'DESIGN.md'), '# Design\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  rmSync(join(repo, 'DESIGN.md'));
  const out = review(repo);
  assert.equal(out.status, 2, out.stdout);
  assert.match(out.stderr, /ui\.design: .*DESIGN\.md does not exist/);
  assert.equal(existsSync(marker), false);
});

test('each reviewer gets the screenshots in WEFTWORK_IMAGES, comma-separated, before then after (e11s06)', () => {
  const seen = join(makeTempDir(), 'images');
  const repo = uiChangedRepo(`printf '%s' "$WEFTWORK_IMAGES" > ${seen}; echo 'VERDICT: APPROVE'`);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  assert.equal(review(repo).status, 0);
  assert.match(readFileSync(seen, 'utf8'), /^\/.*\/ui\/after\/home\.png$/);
});

test('the reviewers get copies of the screenshots outside the git dir, which Claude Code will not read, and the copies are gone after the round', async () => {
  const dir = makeTempDir();
  const repo = uiChangedRepo(`printf '%s\\n%s' "$WEFTWORK_IMAGES" "$WEFTWORK_IMAGES_DIR" > ${dir}/seen; cat "$WEFTWORK_IMAGES" > ${dir}/copy.png; cat > ${dir}/prompt; echo 'VERDICT: APPROVE'`);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  assert.equal(review(repo).status, 0);
  const [image = '', folder = ''] = readFileSync(join(dir, 'seen'), 'utf8').split('\n');
  assert.doesNotMatch(image, /\/\.git\//);
  assert.ok(image.startsWith(`${folder}/`), `${folder} does not hold ${image}`);
  assert.deepEqual(readFileSync(join(dir, 'copy.png')), readFileSync(join((await weftworkDir(repo)) as string, 'ui', 'after', 'home.png')));
  assert.ok(readFileSync(join(dir, 'prompt'), 'utf8').includes(`after: ${image} `), 'the brief names the copy');
  assert.equal(existsSync(image), false);
});

test('a change that is not a UI change: WEFTWORK_IMAGES is not set (e11s06)', () => {
  const seen = join(makeTempDir(), 'images');
  const repo = readyRepo(reviewers(`printf '%s' "\${WEFTWORK_IMAGES-unset}" > ${seen}; echo 'VERDICT: APPROVE'`));
  // One the engine's own caller set is not passed on (review round 1).
  assert.equal(node(reviewCli, repo, { command: verify, brief: 'Review the diff.' }, { WEFTWORK_IMAGES: '/stale.png' }).status, 0);
  assert.equal(readFileSync(seen, 'utf8'), 'unset');
});

/** The reviewers entry for `host` that docs/UI.md gives: the line that starts with it. */
function documentedEntry(host: string): string {
  const line = readFileSync(join(import.meta.dirname, '..', '..', 'docs', 'UI.md'), 'utf8')
    .split('\n')
    .find((text) => text.startsWith(`${host} `));
  assert.ok(line !== undefined, `docs/UI.md gives no ${host} reviewers entry`);
  return line;
}

/** A fake `name` on PATH: it checks the brief is on stdin or in its
 * arguments (agy takes it as `-p`), writes its arguments one per line and
 * then WEFTWORK_IMAGES, and approves. */
function fakeHost(name: string): { path: string; seen: string } {
  const bin = makeTempDir();
  const seen = join(makeTempDir(), 'seen');
  writeFileSync(join(bin, name), `#!/bin/sh\n{ printf '%s\\n' "$@" | grep -q 'Review the diff'; } || grep -q 'Review the diff' || exit 9\nprintf '%s\\n' "$@" "imagesdir=\${WEFTWORK_IMAGES_DIR-unset}" "images=\${WEFTWORK_IMAGES-unset}" > ${seen}\necho 'VERDICT: APPROVE'\n`, { mode: 0o755 });
  return { path: `${bin}:${process.env['PATH'] ?? ''}`, seen };
}

test('the claude and agy entries in docs/UI.md are the built-in reviewers', () => {
  for (const host of ['claude', 'agy']) assert.ok(defaultReviewers.includes(documentedEntry(host)), `${host}: ${documentedEntry(host)}`);
});

for (const [host, flag] of [['claude', '--add-dir'], ['agy', '--add-dir'], ['gemini', '--include-directories']] as const) {
  test(`the ${host} reviewers entry in docs/UI.md opens the folder that holds every screenshot for a UI change only (e11s06 follow-up)`, () => {
    const fake = fakeHost(host);
    const repo = uiChangedRepo(documentedEntry(host));
    assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
    const out = node(reviewCli, repo, { command: verify, brief: 'Review the diff.' }, { PATH: fake.path });
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const args = readFileSync(fake.seen, 'utf8').trimEnd().split('\n');
    const images = (args.at(-1) ?? '').replace(/^images=/, '').split(',');
    // agy also opens the diff's folder; the screenshots' folder is the first.
    const folders = (list: string[]) => list.filter((_, index) => list[index - 1] === flag);
    const dir = folders(args)[0] ?? '';
    assert.ok(images.length > 0 && images.every((image) => image.startsWith(`${dir}/`)), `${dir} does not hold ${images.join(', ')}`);

    const plain = fakeHost(host);
    const other = readyRepo(reviewers(documentedEntry(host)));
    assert.equal(node(reviewCli, other, { command: verify, brief: 'Review the diff.' }, { PATH: plain.path, WEFTWORK_IMAGES_DIR: '/from/the/caller' }).status, 0);
    const plainArgs = readFileSync(plain.seen, 'utf8').trimEnd().split('\n');
    assert.ok(plainArgs.includes('imagesdir=unset') && !plainArgs.includes('/from/the/caller'), plainArgs.join(' '));
    assert.equal(folders(plainArgs).some((folder) => folder.endsWith('/ui')), false, plainArgs.join(' '));
    assert.equal(plainArgs.at(-1), 'images=unset');
  });
}

test('a ui.design path through a symlinked folder outside the repository: exit 2 (e11s06, review round 1)', () => {
  const outside = makeTempDir();
  writeFileSync(join(outside, 'DESIGN.md'), 'secret\n');
  const marker = join(makeTempDir(), 'ran');
  const repo = uiChangedRepo(`touch ${marker}; echo 'VERDICT: APPROVE'`, '  design: out/DESIGN.md\n');
  // The link comes after the screenshots (ui-cli refuses it too); it is
  // ignored, so the tree the screenshots show is the same.
  writeFileSync(join(repo, '.gitignore'), 'out\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  mkdirSync(join(repo, 'out'));
  writeFileSync(join(repo, 'out', 'DESIGN.md'), '# Design\n');
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  rmSync(join(repo, 'out'), { recursive: true });
  symlinkSync(outside, join(repo, 'out'));
  const out = review(repo);
  assert.equal(out.status, 2, out.stdout);
  assert.match(out.stderr, /ui\.design: .* is outside the repository/);
  assert.equal(existsSync(marker), false);
});

test('an after screenshot changed since its manifest: exit 4, and no reviewer runs (e11s05 review round 1)', async () => {
  const marker = join(makeTempDir(), 'ran');
  const repo = uiChangedRepo(`touch ${marker}; echo 'VERDICT: APPROVE'`);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  writeFileSync(join((await weftworkDir(repo)) as string, 'ui', 'after', 'home.png'), Buffer.from('89504e470d0a1a0a6368616e676564', 'hex'));
  const out = review(repo);
  assert.equal(out.status, 4, out.stdout + out.stderr);
  assert.match(out.stdout, /^weftwork review: not run$/m);
  assert.match(out.stdout, /^why: the after screenshot home\.png does not match its hash in the manifest$/m);
  assert.match(out.stdout, /^next: echo '\{"phase":"after"\}' \| node src\/ui-cli\.ts$/m);
  assert.equal(existsSync(marker), false);
});

test('a before screenshot gone since its manifest: exit 4, and no reviewer runs (e11s05 review round 1)', async () => {
  const marker = join(makeTempDir(), 'ran');
  const repo = makeTestRepo();
  mkdirSync(join(repo, 'web'));
  writeFileSync(join(repo, 'web', 'a.html'), '<p>a</p>\n');
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${reviewers(`touch ${marker}; echo 'VERDICT: APPROVE'`)}ui:\n  screenshot: ${JSON.stringify(writePng('home.png'))}\n  paths: ['web/**']\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
  assert.equal(node(uiCli, repo, { phase: 'before' }).status, 0);
  writeFileSync(join(repo, 'web', 'a.html'), '<p>b</p>\n');
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(node(uiCli, repo, { phase: 'after' }).status, 0);
  rmSync(join((await weftworkDir(repo)) as string, 'ui', 'before', 'home.png'));
  const out = review(repo);
  assert.equal(out.status, 4, out.stdout + out.stderr);
  assert.match(out.stdout, /^why: the before screenshot home\.png does not match its hash in the manifest$/m);
  assert.equal(existsSync(marker), false);
});
