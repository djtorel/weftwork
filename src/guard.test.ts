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
    `echo x > ${join(f.engine, 'BACKLOG.md.bak')}`,
    'echo x > .git/weftwork/BACKLOG.md2',
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
    'cat .claude/skills/weft-ready/SKILL.md',
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

// e10s01: the built-in protected-paths list beyond the engine's own files, and
// the owner's own additions (docs/GUARD.md, Protected paths).

test('AC-e10s01-01 a file tool that writes a built-in protected path is blocked', () => {
  const f = fixture();
  const targets = [
    '.git/config',
    '.git/hooks/pre-commit',
    '.git',
    '.claude/hooks/check.sh',
    '.mcp.json',
    '.codex/config.toml',
    '.gemini/settings.json',
    '.opencode/plugins/x.ts',
    'opencode.json',
    '.pi/extensions/x.ts',
    '.kiro/hooks/x.json',
    '.env',
    'web/.env.local',
    'certs/server.pem',
    'tls.key',
    'id_rsa',
    '.npmrc',
    '.netrc',
    '.aws/credentials',
  ].map((path) => join(f.project, path));
  targets.push(join(f.home, '.ssh', 'id_ed25519'), join(f.home, '.bashrc'));
  for (const target of targets) {
    const answer = guardCall(edit('Write', target), f.paths);
    assert.equal(answer.block, true, target);
    assert.ok(answer.block && answer.reason.includes(target), target);
  }
});

test('AC-e10s01-02 skill and agent folders, example env files and look-alike names stay writable', () => {
  const f = fixture();
  const targets = [
    '.claude/skills/weft-ready/SKILL.md',
    '.claude/agents/x.md',
    '.claude/commands/x.md',
    '.agents/skills/x/SKILL.md',
    '.env.example',
    '.env.sample',
    '.github/workflows/ci.yml',
    '.gitignore',
    'src/env.ts',
    'src/keys.ts',
    'docs/x.key.md',
    '.git/weftwork/BACKLOG.md',
  ];
  for (const target of targets) {
    assert.deepEqual(guardCall(edit('Edit', join(f.project, target)), f.paths), { block: false }, target);
  }
});

test('AC-e10s01-03 the built-in list matches inside the project only by the path from its root', () => {
  const parent = join(makeTempDir(), '.codex', 'worktrees');
  const project = join(parent, 'p');
  mkdirSync(project, { recursive: true });
  const paths = guardPaths(project, null, { HOME: makeTempDir() });
  assert.deepEqual(guardCall(edit('Write', join(project, 'src', 'a.ts')), paths), { block: false });
  assert.equal(guardCall(edit('Write', join(project, '.codex', 'config.toml')), paths).block, true);
});

test('AC-e10s01-04 the owner adds paths, and a path the owner adds is blocked like a built-in one', () => {
  const project = makeTempDir();
  const paths = guardPaths(project, null, { HOME: makeTempDir() }, ['.claude/skills/', 'docs/security/*.md']);
  assert.equal(guardCall(edit('Edit', join(project, '.claude/skills/weft-ready/SKILL.md')), paths).block, true);
  assert.equal(guardCall(edit('Edit', join(project, 'docs/security/REVIEW.md')), paths).block, true);
  assert.equal(guardCall(edit('Edit', join(project, '.env')), paths).block, true, 'the built-in list stays');
  assert.equal(guardCall(bash('sed -i s/a/b/ .claude/skills/weft-ready/SKILL.md'), paths).block, true);
  assert.deepEqual(guardCall(edit('Edit', join(project, 'docs/README.md')), paths), { block: false });
});

test('AC-e10s01-11 an exception holds only for its own built-in entry (review r1m1, r1m2)', () => {
  const project = makeTempDir();
  const paths = guardPaths(project, null, { HOME: makeTempDir() }, ['docs/security/', '.env.example']);
  const blockedTargets = ['.git/hooks/.env.example', 'docs/security/.env.example', '.env.example', '.codex/config.toml'];
  for (const target of blockedTargets) {
    assert.equal(guardCall(edit('Write', join(project, target)), paths).block, true, target);
  }
  for (const command of ['cp x .git/hooks/.env.example', 'cp x docs/security/.env.example']) {
    assert.equal(guardCall(bash(command), paths).block, true, command);
  }
  const plain = guardPaths(project, null, { HOME: makeTempDir() });
  for (const target of ['.codex/skills/x/SKILL.md', '.codex/agents/x.toml', '.env.example']) {
    assert.deepEqual(guardCall(edit('Write', join(project, target)), plain), { block: false }, target);
  }
});

test('AC-e10s01-08 a Bash command that names a built-in protected path is blocked, by its text', () => {
  const f = fixture();
  const commands = [
    'rm -rf .git',
    'echo x > .git/hooks/pre-commit',
    'git config --file .git/config core.hooksPath /tmp',
    'cat .env',
    'cp .env.example "$HOME/.env"',
    'cp a ~/.aws/credentials',
    'echo t > .npmrc',
    'chmod 600 certs/server.pem',
    'ssh-keygen -f ~/.ssh/id_rsa',
    `echo {} > ${join(f.project, '.codex', 'config.toml')}`,
    'echo x >> ~/.bashrc',
  ];
  for (const command of commands) {
    const answer = guardCall(bash(command), f.paths);
    assert.equal(answer.block, true, command);
    assert.ok(answer.block && /by its text/.test(answer.reason), command);
  }
});

test('AC-e10s01-09 a Bash command that names no protected path is allowed, look-alike text too', () => {
  const f = fixture();
  const commands = [
    "node -e 'console.log(process.env.HOME)'",
    'git rev-parse --git-common-dir',
    'cat .gitignore',
    'ls .github/workflows',
    'cp .env.example .env.sample',
    'cat .git/weftwork/BACKLOG.md',
    `cat ${join(f.engine, 'BACKLOG.md')}`,
    'sed -i s/a/b/ .claude/skills/weft-ready/SKILL.md',
    'npm run typecheck',
  ];
  for (const command of commands) {
    assert.deepEqual(guardCall(bash(command), f.paths), { block: false }, command);
  }
});
