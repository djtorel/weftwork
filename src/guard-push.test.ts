// story: e11s04
// A push to main is one of the mechanical ask triggers: the guard blocks a
// Bash command that would push to main or master, by the text of the command.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushToMain, type PushContext } from './guard-push.ts';

test('AC-e11s04-01 a push whose refspec names main or master is found', () => {
  const blocked = [
    'git push origin main',
    'git push origin master',
    'git push origin HEAD:main',
    'git push origin +feat/x:main',
    'git push origin feat/x:refs/heads/main',
    'git push --force origin main',
    'git push -u origin main',
    'git -C /repo push origin main',
    'git -c push.default=current push origin main',
    'npm test && git push origin "main"',
    "git push --repo origin 'HEAD:main'",
    'git push origin --delete main',
    'git push --all origin',
    'git push --mirror origin',
  ];
  for (const command of blocked) assert.notEqual(pushToMain(command, 'feat/x'), null, command);
});

test('AC-e11s04-02 a push of a feature branch is not a push to main', () => {
  const allowed = [
    'git push origin feat/x',
    'git push -u origin feat/x',
    'git push --force-with-lease origin feat/x',
    'git push origin HEAD',
    'git push origin HEAD:feat/main-fix',
    'git push',
    'git status && git log main..HEAD',
    'echo git push origin main is banned > note.txt',
    'git push -o ci.skip origin feat/x',
  ];
  for (const command of allowed) assert.equal(pushToMain(command, 'feat/x'), null, command);
});

test('AC-e11s04-03 a push with no refspec, or of HEAD, from main is a push to main', () => {
  for (const command of ['git push', 'git push origin', 'git push -u origin HEAD', 'git push origin HEAD']) {
    assert.notEqual(pushToMain(command, 'main'), null, command);
    assert.notEqual(pushToMain(command, 'master'), null, command);
  }
  assert.equal(pushToMain('git push origin HEAD', null), null);
});

test('AC-e11s04-04 each command of a chain is checked', () => {
  assert.notEqual(pushToMain('git checkout main; git push', 'feat/x'), null);
  assert.notEqual(pushToMain('git commit -m x && git push origin main || true', 'feat/x'), null);
  assert.notEqual(pushToMain('true\ngit push origin main', 'feat/x'), null);
});

test('AC-e11s04-17 a checkout that restores files does not change the branch', () => {
  assert.notEqual(pushToMain('git checkout -- src/guard.ts && git push', 'main'), null);
  assert.notEqual(pushToMain('git checkout src/guard.ts && git push', 'main'), null);
  assert.equal(pushToMain('git checkout -b feat/y && git push -u origin HEAD', 'main'), null);
  assert.equal(pushToMain('git switch -c feat/y && git push', 'main'), null);
  assert.notEqual(pushToMain('git switch main && git push', 'feat/x'), null);
});

test('AC-e11s04-18 a matching or wildcard refspec may update main', () => {
  assert.notEqual(pushToMain('git push origin :', 'feat/x'), null);
  assert.notEqual(pushToMain("git push origin 'refs/heads/*:refs/heads/*'", 'feat/x'), null);
});

/** A repository with local branches `local`, remote-tracking branches
 * `remote` (as `origin/feat/r`) and paths `paths` in the Bash cwd. */
function repo(local: string[], remote: string[] = [], paths: string[] = [], protect = ['main', 'master']): PushContext {
  return { protected: new Set(protect), local: new Set(local), remote, isPath: (name) => paths.includes(name) };
}

test('AC-e11s04-20 git switch -- main switches, git checkout -- main restores a file (as real git does)', () => {
  const r = repo(['feat/x']);
  assert.notEqual(pushToMain('git switch -- main && git push', 'feat/x', r), null);
  assert.notEqual(pushToMain('git switch --discard-changes -- main && git push', 'feat/x', r), null);
  assert.notEqual(pushToMain('git checkout main -- && git push', 'feat/x', r), null);
  assert.equal(pushToMain('git checkout -- main && git push', 'feat/x', r), null);
  assert.equal(pushToMain('git checkout main -- src/a.ts && git push', 'feat/x', r), null);
});

test("AC-e11s04-21 the remote's default branch is protected, and main and master still are", () => {
  const r = repo(['feat/x', 'trunk'], ['origin/trunk'], [], ['main', 'master', 'trunk']);
  for (const command of [
    'git push origin trunk',
    'git push origin HEAD:refs/heads/trunk',
    'git switch trunk && git push',
    'git checkout trunk && git push',
    'git push origin main',
    'git push origin master',
  ]) {
    assert.notEqual(pushToMain(command, 'feat/x', r), null, command);
  }
  assert.notEqual(pushToMain('git push', 'trunk', r), null);
  assert.equal(pushToMain('git push origin feat/x', 'feat/x', r), null);
});

test('AC-e11s04-22 a checkout of an existing branch that is not a path moves off main', () => {
  const r = repo(['feat/x'], ['origin/main', 'origin/feat/r', 'origin/both', 'up/both'], ['notes']);
  for (const command of [
    'git checkout feat/x && git push',
    'git switch feat/x && git push -u origin HEAD',
    'git checkout -q feat/x && git status && git push',
    'git checkout feat/r && git push',
    'git switch feat/r && git push',
    'git checkout -b feat/y && git push -u origin HEAD',
  ]) {
    assert.equal(pushToMain(command, 'main', r), null, command);
  }
});

test('AC-e11s04-23 a checkout that may not move off main keeps the push blocked', () => {
  const r = repo(['feat/x', 'notes'], ['origin/main', 'origin/feat/r', 'origin/both', 'up/both'], ['notes']);
  for (const command of [
    'git checkout notes && git push',
    'git checkout nobranch && git push',
    'git checkout both && git push',
    'git checkout --no-guess feat/r && git push',
    'git checkout feat/x; git push',
    'git checkout -b feat/y; git push',
    'git checkout feat/x || git push',
    'true || git checkout feat/x && git push',
    'git checkout feat/x & git push',
    'git -C ../other checkout feat/x && git push',
    'git --git-dir=../o/.git checkout feat/x && git push',
    'cd ../other && git checkout feat/x && git push',
    'git checkout feat/x && npm test && git push',
    'git checkout feat/x && git -C ../other push',
    'git checkout feat/x && git --git-dir=../o/.git push',
    'GIT_DIR=../other/.git git checkout feat/x && git push',
    'git checkout feat/x && GIT_DIR=../other/.git git push',
    'export GIT_DIR=../other/.git && git checkout feat/x && git push',
    'git checkout -p feat/x && git push',
    'git checkout --detach feat/x && git push',
    'git checkout feat/x src/a.ts && git push',
    'git checkout feat/x -- src/a.ts && git push',
  ]) {
    assert.notEqual(pushToMain(command, 'main', r), null, command);
  }
  assert.notEqual(pushToMain('git checkout feat/x && git push', 'main'), null, 'with no repository facts');
});

test('AC-e11s04-24 with no repository facts every push is blocked', () => {
  const answer = pushToMain('git push origin feat/x', 'feat/x', null);
  assert.ok(answer !== null && answer.includes('could not read'), answer ?? '');
  assert.equal(pushToMain('git status', 'feat/x', null), null);
});
