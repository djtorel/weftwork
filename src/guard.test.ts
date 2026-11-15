// story: e11s01
// The guard's decision, as a pure function over a PreToolUse input: Edit,
// Write, MultiEdit and NotebookEdit by resolved path, Bash by path text.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { guardCall, guardPaths, type GuardPaths } from './guard.ts';
import { cleanupTempDirs, makeTempDir } from './test-helpers.ts';

after(cleanupTempDirs);

type Fixture = { project: string; engine: string; home: string; xdg: string; paths: GuardPaths };

/** A project folder, its engine folder in a fake git dir, and a fake home. */
function fixture(): Fixture {
  const project = makeTempDir();
  const engine = join(project, '.git', 'weftwork');
  mkdirSync(engine, { recursive: true });
  const home = makeTempDir();
  const xdg = makeTempDir();
  const paths = guardPaths(project, engine, { HOME: home, XDG_CONFIG_HOME: xdg });
  return { project, engine, home, xdg, paths };
}

function edit(tool: string, filePath: string, cwd = '/'): unknown {
  const key = tool === 'NotebookEdit' ? 'notebook_path' : 'file_path';
  return { hook_event_name: 'PreToolUse', cwd, tool_name: tool, tool_input: { [key]: filePath } };
}

function bash(command: string): unknown {
  return { hook_event_name: 'PreToolUse', cwd: '/', tool_name: 'Bash', tool_input: { command } };
}

test('AC-e11s01-01 Edit, Write, MultiEdit and NotebookEdit of a protected file are blocked', () => {
  const f = fixture();
  const targets = [
    join(f.project, 'weftwork.yaml'),
    join(f.project, '.claude', 'settings.json'),
    join(f.project, '.claude', 'settings.local.json'),
    join(f.xdg, 'weftwork', 'config.yaml'),
    join(f.home, '.claude', 'settings.json'),
    join(f.engine, 'ledger.jsonl'),
    join(f.engine, 'state.yaml'),
    join(f.engine, 'override.json'),
  ];
  for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) {
    for (const target of targets) {
      const answer = guardCall(edit(tool, target), f.paths);
      assert.equal(answer.block, true, `${tool} ${target}`);
      assert.ok(answer.block && answer.reason.includes(target), answer.block ? answer.reason : '');
    }
  }
});

test('AC-e11s01-02 a path relative to the tool cwd or through a symlink is resolved first', () => {
  const f = fixture();
  assert.equal(guardCall(edit('Write', 'weftwork.yaml', f.project), f.paths).block, true);
  assert.equal(guardCall(edit('Edit', '../.git/weftwork/ledger.jsonl', join(f.project, 'src')), f.paths).block, true);
  const link = join(f.project, 'notes.md');
  writeFileSync(join(f.project, 'weftwork.yaml'), '---\n');
  symlinkSync(join(f.project, 'weftwork.yaml'), link);
  assert.equal(guardCall(edit('Write', link), f.paths).block, true);
  const linkedDir = join(f.project, 'eng');
  symlinkSync(f.engine, linkedDir);
  assert.equal(guardCall(edit('Write', join(linkedDir, 'new.json')), f.paths).block, true);
});

test('AC-e11s01-03 other files, and the local backlog in the engine folder, are allowed', () => {
  const f = fixture();
  for (const target of [join(f.project, 'src', 'a.ts'), join(f.project, 'weftwork.yaml.bak'), join(f.engine, 'BACKLOG.md')]) {
    assert.deepEqual(guardCall(edit('Edit', target), f.paths), { block: false }, target);
  }
});

test('AC-e11s01-04 a Bash command that names a protected path is blocked, and the reason says the match is by text', () => {
  const f = fixture();
  const commands = [
    'echo "budget: {}" > weftwork.yaml',
    `sed -i s/5/50/ ${join(f.project, 'weftwork.yaml')}`,
    'rm .claude/settings.json',
    'cp x .claude/settings.local.json',
    'echo {} > ~/.claude/settings.json',
    ': > "$(git rev-parse --absolute-git-dir)/weftwork/ledger.jsonl"',
    'rm -rf .git/weftwork',
    'echo {} > override.json',
    'cat ~/.config/weftwork/config.yaml',
    `rm -r ${f.engine}`,
    "node src/claude-install-cli.ts -- 'true'",
  ];
  for (const command of commands) {
    const answer = guardCall(bash(command), f.paths);
    assert.equal(answer.block, true, command);
    assert.ok(answer.block && /by its text/.test(answer.reason), command);
  }
});

test('AC-e11s01-05 a Bash command that names no protected path, or only the backlog, is allowed', () => {
  const f = fixture();
  const commands = [
    'npm test',
    'node src/handoff-cli.ts',
    'echo \'{"op":"get"}\' | node src/state-cli.ts',
    'cat "$(git rev-parse --git-common-dir)/weftwork/BACKLOG.md"',
    `sed -i s/a/b/ ${join(f.engine, 'BACKLOG.md')}`,
    'cat .claude/skills/full-stop/SKILL.md',
  ];
  for (const command of commands) {
    assert.deepEqual(guardCall(bash(command), f.paths), { block: false }, command);
  }
});

test('AC-e11s01-06 a tool the guard does not watch is allowed; an input it cannot read is blocked', () => {
  const f = fixture();
  assert.deepEqual(guardCall({ tool_name: 'Read', tool_input: { file_path: join(f.project, 'weftwork.yaml') } }, f.paths), { block: false });
  for (const bad of [null, 'x', { tool_name: 'Edit' }, { tool_name: 'Edit', tool_input: { file_path: 3 } }, { tool_name: 'Bash', tool_input: {} }]) {
    assert.equal(guardCall(bad, f.paths).block, true, JSON.stringify(bad));
  }
});

test('AC-e11s01-07 with no git dir the setting and settings files are still protected', () => {
  const project = makeTempDir();
  const paths = guardPaths(project, null, { HOME: makeTempDir() });
  assert.equal(guardCall(edit('Write', join(project, 'weftwork.yaml')), paths).block, true);
  assert.equal(guardCall(edit('Write', join(project, 'src.ts')), paths).block, false);
});
