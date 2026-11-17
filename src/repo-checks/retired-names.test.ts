// Names weftwork retired stay retired. Work done in parallel, on a branch cut
// before a rename, can bring an old name back into a doc or a skill, and no
// other test reads that prose. Each rule names where the old name may stay:
// the record of the past (CHANGELOG.md, research, security review, bugs) and
// the code and notes that tell an owner what it became.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');

/** The record of the past, where every old name may stay. */
const history = ['CHANGELOG.md', 'docs/research/', 'docs/security/', 'docs/bugs/', 'src/repo-checks/retired-names.test.ts'];

const budgetKeys = 'maxRuns|maxFailures|stallAfter|reserveRuns';

type Rule = { name: string; now: string; allowed: string[]; found: (path: string, text: string) => boolean };

const rules: Rule[] = [
  {
    name: 'an old skill name',
    now: 'all-ready, all-in, second-opinion, pr-it, retro, bootstrap or migrate',
    // setup.ts notes old skill folders still in a project; SETUP.md says what
    // they became; the skills README credits tstack, where two had these names;
    // the weft- names came between 0.1.0 and 0.2.0;
    // skill-hashes.ts keeps the texts shipped under them, so `weftwork update`
    // can delete an old folder the owner never changed (update.test.ts).
    allowed: ['src/setup/setup.ts', 'src/setup/setup.test.ts', 'docs/SETUP.md', '.claude/skills/README.md', 'src/setup/skill-hashes.ts', 'src/setup/update.test.ts'],
    found: (_path, text) => /\b(full-stop|review-loop|file-pr|setup-project|convert-project|weft-(ready|review|pr|improve|setup|convert))\b/.test(text),
  },
  {
    name: 'the review council',
    now: 'review.reviewers, "the reviewers"',
    allowed: ['src/review/review-setting.ts', 'src/review/review-setting.test.ts'],
    found: (_path, text) => /\bcouncil\b/i.test(text),
  },
  {
    name: 'a camelCase budget key in YAML',
    now: 'max_runs, max_failures, stall_after or reserve_runs (docs/BUDGET.md); the JSON request keeps camelCase',
    // budget.test.ts writes the old keys to check each is refused. An old key
    // anywhere else in a test's budget YAML is refused too, so it fails there.
    allowed: ['src/engine/budget.test.ts'],
    found: (path, text) =>
      path.endsWith('.ts')
        ? new RegExp(`\\\\n[ \\t]+(${budgetKeys}):|budget:[^\\n'"\`]*\\{(${budgetKeys}):`).test(text)
        : /\.(md|ya?ml)$/.test(path) && new RegExp(`^[ \\t]+(${budgetKeys}):`, 'm').test(text),
  },
];

/** The rules `text` at `path` breaks. */
function retired(path: string, text: string): string[] {
  const allowedFor = (rule: Rule) => [...history, ...rule.allowed].some((allowed) => (allowed.endsWith('/') ? path.startsWith(allowed) : path === allowed));
  return rules.filter((rule) => !allowedFor(rule) && rule.found(path, text)).map((rule) => rule.name);
}

test('each rule catches its old name, and lets the new name and a JSON object through', () => {
  assert.deepEqual(retired('docs/ASK.md', 'Use the full-stop skill.'), ['an old skill name']);
  assert.deepEqual(retired('README.md', 'End the task with weft-ready.'), ['an old skill name']);
  assert.deepEqual(retired('README.md', 'The council reviews it.'), ['the review council']);
  assert.deepEqual(retired('docs/X.md', '```yaml\nbudget:\n  maxRuns: 3\n```\n'), ['a camelCase budget key in YAML']);
  assert.deepEqual(retired('src/x.test.ts', "write('budget:\\n  maxFailures: 2\\n')"), ['a camelCase budget key in YAML']);
  assert.deepEqual(retired('src/x.test.ts', "repo('budget: {stallAfter: 2}')"), ['a camelCase budget key in YAML']);
  assert.deepEqual(retired('src/x.test.ts', "repo('budget: !!seq {maxRuns: 2}')"), ['a camelCase budget key in YAML']);
  assert.deepEqual(retired('src/x.test.ts', "runEngine({ command, maxRuns: 3 })\nconst limits = {\n  maxFailures: 5,\n};"), []);
  assert.deepEqual(retired('src/x.test.ts', 'const request = {maxRuns: 3};'), [], 'a JSON object with no space after the brace');
  assert.deepEqual(retired('docs/X.md', 'Use all-ready. budget:\n  max_runs: 3\n'), []);
  assert.deepEqual(retired('CHANGELOG.md', 'full-stop is now all-ready; review.council is review.reviewers'), []);
  assert.deepEqual(retired('docs/research/R18.md', 'a design council'), []);
});

test('no file in the repository brings a retired name back', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((path) => path !== '' && /\.(md|ts|ya?ml|json|sh)$/.test(path));
  assert.ok(files.includes('README.md'), 'the scan sees the tracked files');
  const hits = files.flatMap((path) => {
    let text: string;
    try {
      text = readFileSync(join(root, path), 'utf8');
    } catch {
      return []; // listed by git but deleted in the working tree
    }
    return retired(path, text).map((name) => {
      const rule = rules.find((r) => r.name === name);
      return `${path}: ${name}; use ${rule?.now ?? 'the new name'}`;
    });
  });
  assert.deepEqual(hits, [], 'retired names: rename them, or add the file to the rule in src/repo-checks/retired-names.test.ts with why');
});
