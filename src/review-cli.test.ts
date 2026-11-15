// story: e11s03
// The review CLI as a real process in a temporary repository: the engine CLI
// passes the done gate, then the review CLI runs the council from
// weftwork.yaml and counts the round in the ledger. Exit 0 pass, 1 block,
// 3 no verdict, 4 the done gate has not passed, 5 the round ceiling, 2 when
// it cannot run.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempDirs, isolatedEnv, makeTempDir, makeTestRepo, writePng } from './test-helpers.ts';
import { ledgerPath } from './ledger.ts';

after(cleanupTempDirs);

const engineCli = join(import.meta.dirname, 'cli.ts');
const reviewCli = join(import.meta.dirname, 'review-cli.ts');
const verify = 'true';

function node(script: string, cwd: string, input: object) {
  const out = spawnSync(process.execPath, [script], { cwd, input: JSON.stringify(input), env: isolatedEnv(), encoding: 'utf8', timeout: 30000 });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

/** A repository whose weftwork.yaml holds `review`, with the done gate passed. */
function readyRepo(review: string): string {
  const repo = makeTestRepo();
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${review}`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  return repo;
}

const council = (...commands: string[]) => `  council:\n${commands.map((c) => `    - ${JSON.stringify(c)}\n`).join('')}`;
const review = (repo: string, extra: object = {}) => node(reviewCli, repo, { command: verify, brief: 'Review the diff.', ...extra });

test('the done gate has not passed: exit 4, and no reviewer runs', () => {
  const marker = join(makeTempDir(), 'ran');
  const repo = makeTestRepo();
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${council(`touch ${marker}; echo 'VERDICT: APPROVE'`)}`);
  const out = review(repo);
  assert.equal(out.status, 4, out.stderr);
  assert.match(out.stdout, /^weftwork review: not run$/m);
  assert.match(out.stdout, /^why: the done gate has not passed: the ledger has no run of this command$/m);
  assert.equal(existsSync(marker), false);
});

test('a reviewer reads the brief and the reply format on stdin; an approval passes: exit 0', () => {
  const repo = readyRepo(council("grep -c -e 'Review the diff' -e 'VERDICT: APPROVE or CHANGES' | grep -qx 2 && echo 'VERDICT: APPROVE'"));
  const out = review(repo);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^weftwork review: pass$/m);
  assert.match(out.stdout, /^round: 1 of 3$/m);
  assert.match(out.stdout, /^reviewer 1, grep: 0 must-fix, 0 should-fix$/m);
});

test('a must-fix blocks: exit 1, and the round is counted in the ledger', async () => {
  const repo = readyRepo(council("printf 'VERDICT: CHANGES\\nMUST-FIX a.ts:1 bad\\nSHOULD-FIX b.ts:2 meh\\n'"));
  const out = review(repo);
  assert.equal(out.status, 1, out.stderr);
  assert.match(out.stdout, /^weftwork review: block$/m);
  assert.match(out.stdout, /^must-fix \(printf\): a\.ts:1 bad$/m);
  const ledger = readFileSync((await ledgerPath(repo)) as string, 'utf8');
  assert.match(ledger, /"review":"block","branch":"main","round":1,"maxRounds":3/);
});

test('at the round ceiling: exit 5, the last round\'s findings again, and no reviewer runs', () => {
  const log = join(makeTempDir(), 'runs');
  const repo = readyRepo(`${council(`echo run >> ${log}; printf 'VERDICT: CHANGES\\nMUST-FIX a.ts:1 bad\\n'`)}  max_rounds: 1\n`);
  assert.equal(review(repo).status, 1);
  const out = review(repo);
  assert.equal(out.status, 5, out.stderr);
  assert.match(out.stdout, /^weftwork review: exhausted$/m);
  assert.match(out.stdout, /^why: 1 round on this branch, the ceiling is 1$/m);
  assert.match(out.stdout, /^unresolved must-fix \(echo\): a\.ts:1 bad$/m);
  assert.equal(readFileSync(log, 'utf8'), 'run\n');
});

test('a sensitive change gets max_rounds_sensitive', () => {
  const repo = readyRepo(`${council("echo 'VERDICT: APPROVE'")}  max_rounds: 1\n  max_rounds_sensitive: 2\n`);
  assert.equal(review(repo, { sensitive: true }).status, 0);
  const second = review(repo, { sensitive: true });
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /^round: 2 of 2$/m);
  assert.equal(review(repo, { sensitive: true }).status, 5);
});

test('a reviewer that fails counts as neither pass nor block', () => {
  const one = readyRepo(council('exit 3', "echo 'VERDICT: APPROVE'"));
  const out = review(one);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^reviewer 1, exit: failed, exit 3$/m);

  const big = readyRepo(council("echo 'VERDICT: APPROVE'; head -c 1100000 /dev/zero | tr '\\0' x"));
  const cut = review(big);
  assert.equal(cut.status, 3, cut.stderr);
  assert.match(cut.stdout, /^reviewer 1, echo: failed, the reply is larger than 1048576 bytes$/m);

  const none = readyRepo(`${council('sleep 5', 'echo no verdict here')}  timeout_seconds: 1\n`);
  const all = review(none);
  assert.equal(all.status, 3, all.stderr);
  assert.match(all.stdout, /^weftwork review: no verdict$/m);
  assert.match(all.stdout, /^reviewer 1, sleep: failed, timed out after 1 s$/m);
  assert.match(all.stdout, /^reviewer 2, echo: failed, the reply has no VERDICT line$/m);
});

test('a reviewer that changes the tree: no verdict, since the review was not of this tree', () => {
  const repo = readyRepo(council("echo two > tracked.txt; echo 'VERDICT: APPROVE'"));
  const out = review(repo);
  assert.equal(out.status, 3, out.stderr);
  assert.match(out.stdout, /^why: the tree changed during the review; a reviewer must be read-only$/m);
});

test('at most 2 reviewers run at once', () => {
  const log = join(makeTempDir(), 'log');
  const one = `echo s >> ${log}; sleep 0.4; echo e >> ${log}; echo 'VERDICT: APPROVE'`;
  const repo = readyRepo(council(one, one, one));
  assert.equal(review(repo).status, 0);
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
function uiChangedRepo(reviewer: string): string {
  const repo = makeTestRepo();
  mkdirSync(join(repo, 'web'));
  writeFileSync(join(repo, 'web', 'a.html'), '<p>a</p>\n');
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${council(reviewer)}ui:\n  screenshot: ${JSON.stringify(writePng('home.png'))}\n  paths: ['web/**']\n`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  return repo;
}

const uiCli = join(import.meta.dirname, 'ui-cli.ts');

test('a change to ui.paths without after screenshots of this tree: exit 4, and no reviewer runs (e11s05)', () => {
  const marker = join(makeTempDir(), 'ran');
  const repo = uiChangedRepo(`touch ${marker}; echo 'VERDICT: APPROVE'`);
  const out = review(repo);
  assert.equal(out.status, 4, out.stderr);
  assert.match(out.stdout, /^why: the change touches ui\.paths \(web\/a\.html\) and there are no after screenshots of this tree$/m);
  assert.equal(existsSync(marker), false);
});

test('with after screenshots: the council reads their paths, a score is reported, and only a must-fix gates (e11s05)', () => {
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
  writeFileSync(join(repo, 'weftwork.yaml'), `---\nreview:\n${council("echo 'VERDICT: APPROVE'")}ui:\n  screenshot: 'exit 1'\n  paths: ['web/**']\n`);
  assert.equal(node(engineCli, repo, { command: verify }).status, 0);
  assert.equal(review(repo).status, 0);
});
