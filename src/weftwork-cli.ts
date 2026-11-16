// story: e12s02
// The `weftwork` command: `weftwork <command> [args]` runs <command>-cli
// (and `weftwork engine` runs cli) next to this file, with the same stdin and
// arguments, so a project's skills name the command, not a checkout.
// `weftwork path` prints the folder weftwork runs from, where the docs and
// skills are; `--help` and `--version` do what they say. In a checkout the
// files are src/*.ts; in the npm package they are dist/*.js (bin/weftwork.js
// picks one). docs/GETTING-STARTED.md.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const ext = extname(import.meta.filename);

/** What each command does, for --help. A new *-cli file needs a line here
 * (weftwork-cli.test.ts checks it). */
const about: Record<string, string> = {
  init: 'Set up weftwork in a project (default: the current folder)',
  convert: 'Convert a bigpowers, GSD, spec-kit or BMAD project (JSON on stdin)',
  setup: 'Set up a project, or undo a setup (JSON on stdin; what agents call)',
  detect: "Report a project's stack, commands, CI and agent files",
  engine: 'Run a command through the done gate and record it in the ledger',
  'pr-proof': "Print a pull request's Proof block from the ledger",
  review: 'Run one review round with the review council',
  'review-outcome': 'Record what became of a review finding, or report them',
  'base-check': 'Run the tests a change adds or edits against the base commit',
  ui: 'Take before or after screenshots of a UI change',
  resume: 'Check the handoff note at the start of a session',
  handoff: 'Write the handoff note for the next session',
  state: "Get or set a field of the engine's state file",
  decision: 'Log a decision made without the owner, or list them',
  overlap: 'Check that planned parallel tasks change no file in common',
  'claude-install': 'Register the Claude Code Stop hook and guard in this project',
  'claude-live': 'Check that Claude Code runs the Stop hook in this project',
  'claude-hook': 'The Claude Code Stop hook (Claude Code runs it)',
  guard: 'The Claude Code PreToolUse guard (Claude Code runs it)',
  path: 'Print the folder weftwork runs from (its docs and skills)',
  help: 'Show this help',
  version: 'Print the version',
};

/** Each command and the file it runs. */
function commands(): Map<string, string> {
  const found = new Map([['engine', `cli${ext}`]]);
  const pattern = new RegExp(`^([a-z][a-z0-9-]*)-cli\\${ext}$`);
  for (const name of readdirSync(import.meta.dirname)) {
    const command = pattern.exec(name)?.[1];
    if (command !== undefined && command !== 'weftwork') found.set(command, name);
  }
  return found;
}

function usage(known: Map<string, string>): string {
  const names = [...known.keys(), 'path', 'help', 'version'].sort();
  const width = Math.max(...names.map((name) => name.length)) + 2;
  const lines = names.map((name) => `  ${name.padEnd(width)}${about[name] ?? ''}`.trimEnd());
  return [
    'Usage: weftwork <command> [args]',
    '',
    'Commands:',
    ...lines,
    '',
    'Run weftwork init --help for setup options. Most other commands read JSON on',
    'stdin; docs/ in weftwork path says what each takes.',
    '',
  ].join('\n');
}

function version(): string {
  const { version: v } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  return v;
}

const [command] = process.argv.splice(2, 1);
const known = commands();
if (command === 'path') {
  process.stdout.write(`${root}\n`);
} else if (command === '--version' || command === '-v' || command === 'version') {
  process.stdout.write(`${version()}\n`);
} else if (command === '--help' || command === '-h' || command === 'help') {
  process.stdout.write(usage(known));
} else if (command === undefined || !known.has(command)) {
  const why = command === undefined ? 'name a command' : `no command ${JSON.stringify(command)}`;
  process.stderr.write(`weftwork: ${why}\n\n${usage(known)}`);
  process.exitCode = 2;
} else {
  await import(pathToFileURL(join(import.meta.dirname, known.get(command) ?? '')).href);
}
