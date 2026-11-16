// story: e12s02
// The texts that setting up a project writes, built from the detect report
// and the owner's answers: the interview questions with their recommended
// answers, the AGENTS.md letter, CONVENTIONS.md, the local backlog and the
// .gitignore lines. Pure: no file is read or written here. docs/SETUP.md.
import type { CheckedCommand } from './detect-check.ts';
import type { PackageReport, ProjectReport } from './detect.ts';
import { isRecord } from './json.ts';
import type { Failure } from './errors.ts';
import { codeSpan } from './markdown-text.ts';

/** One package of a monorepo, with each command checked in its folder. */
export type CheckedPackage = Omit<PackageReport, 'commands'> & { commands: CheckedCommand[] };

/** The report setup reads: detect's, with each command checked (H3). */
export type CheckedReport = Omit<ProjectReport, 'commands' | 'packages'> & { commands: CheckedCommand[]; packages: CheckedPackage[] };

/** The most packages the letter lists, so it stays short. */
const maxLetterPackages = 20;

/** The owner's answers. Every list item is one line. */
export type Answers = { about: string; words: string[]; never: string[]; rules: string[]; tasks: string[] };

export type Question = { id: keyof Answers; question: string; recommended: string | string[] };

const maxItems = 20;
const maxItemLength = 500;

/** The interview: only what detection cannot answer (H2), each question with a
 * recommended answer the owner can take as it is. `description` is what the
 * project says it is (setup-about.ts). */
export function setupQuestions(name: string, report: CheckedReport, description: string | null = null): Question[] {
  const kind = report.languages.length > 0 ? `a ${report.languages.join(' and ')} project` : 'a project';
  const about = description === null ? `${name} is ${kind}.` : `${name} is ${kind}: ${description}`;
  return [
    { id: 'about', question: 'What is this project, and who is it for? One or two sentences.', recommended: about },
    { id: 'words', question: 'Which words matter here, each with what it means? One per line, as "word: meaning".', recommended: [] },
    {
      id: 'never',
      question: 'What must the agent never do? One rule per line.',
      recommended: ['Never push to main or merge without the owner.', 'Never commit secrets such as .env files.'],
    },
    { id: 'rules', question: 'Which code rules does the project have beyond its linters? None means no CONVENTIONS.md.', recommended: [] },
    { id: 'tasks', question: 'Which first tasks go in the backlog? One per line.', recommended: [] },
  ];
}

/** True for a string of one line, no NUL, at most maxItemLength characters. */
function isLine(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxItemLength && !/[\0\r\n]/.test(value);
}

/** `value` checked as the answers, or why it is not. */
export function parseAnswers(value: unknown): { ok: true; answers: Answers } | Failure {
  if (!isRecord(value)) return { ok: false, error: '"answers" must be an object' };
  if (!isLine(value.about)) return { ok: false, error: `"answers.about" must be one line of at most ${maxItemLength} characters` };
  const lists: Record<string, string[]> = {};
  for (const key of ['words', 'never', 'rules', 'tasks']) {
    const list = value[key] ?? [];
    if (!Array.isArray(list) || list.length > maxItems || !list.every(isLine)) {
      return { ok: false, error: `"answers.${key}" must be a list of at most ${maxItems} lines` };
    }
    lists[key] = list;
  }
  const extra = Object.keys(value).find((key) => !['about', 'words', 'never', 'rules', 'tasks'].includes(key));
  if (extra !== undefined) return { ok: false, error: `"answers.${extra}" is not a known answer` };
  return { ok: true, answers: { about: value.about, words: lists.words, never: lists.never, rules: lists.rules, tasks: lists.tasks } };
}

/** The commands whose check ran, so each one resolves today (H3). */
export function resolvedCommands(report: { commands: CheckedCommand[] }): CheckedCommand[] {
  return report.commands.filter((command) => command.check.status === 'passed' || command.check.status === 'failed');
}

const failsToday = (command: CheckedCommand): string => (command.check.status === 'failed' ? ' (fails today)' : '');

/** One line per package with a command that resolves, at most
 * maxLetterPackages, then how many more there are. A path with a line break
 * is left out: it cannot be one line. */
function packageLines(report: CheckedReport): string[] {
  const lines = report.packages
    .filter((found) => !/[\0-\x1f\x7f]/.test(found.path))
    .map((found) => ({ path: found.path, commands: resolvedCommands(found) }))
    .filter((found) => found.commands.length > 0)
    .map((found) => `- ${codeSpan(found.path)}: ${found.commands.map((command) => `${command.kind} ${codeSpan(command.command)}${failsToday(command)}`).join(', ')}`);
  const more = lines.length - maxLetterPackages;
  if (more <= 0) return lines;
  return [...lines.slice(0, maxLetterPackages), `- ${more} more ${more === 1 ? 'package is' : 'packages are'} not listed, to keep this file short.`];
}

/** The Preflight: every test, lint and typecheck command that passed. */
export function preflight(report: CheckedReport): string | null {
  const order = ['lint', 'typecheck', 'test'];
  const passed = report.commands
    .filter((command) => command.check.status === 'passed' && order.includes(command.kind))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return passed.length === 0 ? null : passed.map((command) => command.command).join(' && ');
}

const bullets = (lines: string[]): string => lines.map((line) => `- ${line}`).join('\n');

/** The short AGENTS.md letter: what is not standard about this project. */
export function agentsLetter(name: string, report: CheckedReport, answers: Answers): string {
  const parts = [`# ${name}`, 'This file is the project context for every agent host (Claude Code reads it\nthrough the `CLAUDE.md` symlink).', '## About this project', answers.about];
  if (answers.words.length > 0) parts.push('## Words', bullets(answers.words));
  const commands = resolvedCommands(report);
  if (commands.length > 0) {
    const rows = commands.map((command) => `| ${command.kind}${failsToday(command)} | \`${command.command}\` |`);
    parts.push('## Commands', ['| Action | Command |', '| ------ | ------- |', ...rows].join('\n'));
  }
  const packages = packageLines(report);
  if (packages.length > 0) parts.push('## Packages', "Each command runs in its package's folder.", packages.join('\n'));
  const check = preflight(report);
  parts.push('## Preflight', check === null ? 'None yet: no test, lint or typecheck command passed when this file was written.' : `\`\`\`bash\n${check}\n\`\`\``);
  if (answers.never.length > 0) parts.push('## Rules', bullets(answers.never));
  if (answers.rules.length > 0) parts.push('`CONVENTIONS.md` has the code rules.');
  return `${parts.join('\n\n')}\n`;
}

/** CONVENTIONS.md, or null when the owner has no rules. */
export function conventions(answers: Answers): string | null {
  return answers.rules.length === 0 ? null : `# Conventions\n\n${bullets(answers.rules)}\n`;
}

/** The local backlog, seeded with the first tasks. */
export function backlog(answers: Answers): string {
  const head = '# Backlog\n\nLocal and untracked: shared by every worktree of this clone, never committed.\nOne task = one branch = one PR. Order is top to bottom.\n\n## Next\n';
  return answers.tasks.length === 0 ? head : `${head}\n${answers.tasks.map((task) => `- [ ] ${task}`).join('\n')}\n`;
}

const stackIgnores: Record<string, string[]> = {
  javascript: ['node_modules/'],
  typescript: ['node_modules/'],
  python: ['__pycache__/', '.venv/'],
  rust: ['target/'],
};

/** The .gitignore lines setup wants: secrets, then each stack's folders. */
export function ignoreLines(report: CheckedReport): string[] {
  return [...new Set(['.env', '.env.*', ...report.languages.flatMap((language) => stackIgnores[language] ?? [])])];
}

/** `lines` that `text` (a .gitignore) does not already hold as a line. */
export function missingLines(text: string, lines: string[]): string[] {
  const present = new Set(text.split('\n').map((line) => line.trim()));
  return lines.filter((line) => !present.has(line));
}
