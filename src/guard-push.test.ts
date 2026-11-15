// story: e11s04
// A push to main is one of the mechanical ask triggers: the guard blocks a
// Bash command that would push to main or master, by the text of the command.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushToMain } from './guard-push.ts';

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
