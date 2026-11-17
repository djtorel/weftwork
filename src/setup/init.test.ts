// `weftwork init`: set up a project from the terminal, the current folder by
// default. The library parts: the arguments, the questions, the plan text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { askAnswers, parseInitArgs, renderPlan } from './init.ts';
import type { Question } from './setup-text.ts';

test('init with no path sets up the current folder, asks, runs commands and adds no hook', () => {
  assert.deepEqual(parseInitArgs([], '/work/project'), {
    ok: true,
    options: { path: '/work/project', yes: false, stopHook: false, local: false, run: true, overwrite: [] },
  });
});

test('init takes a path, relative to the current folder, and each option', () => {
  const parsed = parseInitArgs(['../other', '--yes', '--stop-hook', '--local', '--no-run', '--overwrite', 'AGENTS.md', '--overwrite', 'CLAUDE.md'], '/work/project');
  assert.deepEqual(parsed, {
    ok: true,
    options: { path: resolve('/work/other'), yes: true, stopHook: true, local: true, run: false, overwrite: ['AGENTS.md', 'CLAUDE.md'] },
  });
  assert.deepEqual(parseInitArgs(['-y'], '/p'), { ok: true, options: { path: '/p', yes: true, stopHook: false, local: false, run: true, overwrite: [] } });
});

test('init refuses an unknown option or a second path, and says so', () => {
  for (const args of [['--nope'], ['a', 'b'], ['--overwrite']]) {
    const parsed = parseInitArgs(args, '/p');
    assert.equal(parsed.ok, false, args.join(' '));
    assert.ok(!parsed.ok && parsed.error.length > 0);
  }
  assert.deepEqual(parseInitArgs(['--help'], '/p'), { ok: true, help: true });
});

const questions: Question[] = [
  { id: 'about', question: 'What is this project?', recommended: 'demo is a project.' },
  { id: 'words', question: 'Which words matter?', recommended: [] },
  { id: 'never', question: 'What must the agent never do?', recommended: ['Never push to main.'] },
  { id: 'rules', question: 'Which code rules?', recommended: [] },
  { id: 'tasks', question: 'Which first tasks?', recommended: [] },
];

/** An ask that replies from a script and records each prompt. */
function scripted(replies: string[]) {
  const prompts: string[] = [];
  const ask = async (prompt: string): Promise<string> => {
    prompts.push(prompt);
    return replies.shift() ?? '';
  };
  return { ask, prompts };
}

test('an empty reply keeps each recommended answer', async () => {
  const { ask, prompts } = scripted([]);
  assert.deepEqual(await askAnswers(questions, ask), { about: 'demo is a project.', words: [], never: ['Never push to main.'], rules: [], tasks: [] });
  assert.ok(prompts.some((prompt) => prompt.includes('What is this project?') && prompt.includes('demo is a project.')), 'the prompt shows the recommendation');
});

test('typed lines replace a recommendation, a list ends at an empty line, and none empties a list', async () => {
  const { ask } = scripted(['A CLI for notes.', 'note: one saved text', 'tag: a label', '', 'none', 'Use tabs.', '', 'Add a README.', '']);
  assert.deepEqual(await askAnswers(questions, ask), {
    about: 'A CLI for notes.',
    words: ['note: one saved text', 'tag: a label'],
    never: [],
    rules: ['Use tabs.'],
    tasks: ['Add a README.'],
  });
});

test('the plan text names the folder, each change with its diff, the conflicts kept, and the notes', () => {
  const text = renderPlan('/work/project', {
    changes: [
      { path: 'AGENTS.md', action: 'create', diff: '+# demo\n+About' },
      { path: '.gitignore', action: 'unchanged' },
      { path: 'CLAUDE.md', action: 'conflict', diff: '-old\n+new' },
    ],
    notes: ['Run npm link.'],
  });
  assert.match(text, /\/work\/project/);
  assert.match(text, /create +AGENTS\.md\n {4}\+# demo\n {4}\+About/);
  assert.doesNotMatch(text, /\.gitignore/, 'an unchanged file is not listed');
  assert.match(text, /conflict +CLAUDE\.md.*--overwrite CLAUDE\.md/s);
  assert.match(text, /Run npm link\./);
});

test('a recommendation from the project, such as a README line, reaches the prompt with its control characters escaped', async () => {
  const { ask, prompts } = scripted([]);
  const hostile: Question[] = [
    { id: 'about', question: 'What is this project?', recommended: 'demo\u001b[2J is \u202eodd' },
    { id: 'never', question: 'Never?', recommended: ['ok\u0007'] },
  ];
  await askAnswers(hostile, ask);
  const text = prompts.join('');
  assert.doesNotMatch(text, /[\u001b\u0007\u202e]/u);
  assert.match(text, /demo\\u001b\[2J is \\u202eodd/);
  assert.match(text, /ok\\u0007/);
});
