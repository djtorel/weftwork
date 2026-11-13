// story: e07s04
// Thin shell for the live check: run in the root of a project, it says whether
// Claude Code runs weftwork's Stop hook there, and exits 0 only when it does.
// It reads .claude/settings.local.json, .claude/settings.json, the user
// settings ($CLAUDE_CONFIG_DIR/settings.json, else ~/.claude/settings.json)
// and the call record, following symlinks as Claude Code does. Logic lives in
// claude-live.ts. It writes nothing.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { liveReport, type LiveAnswer, type LiveReport, type NextStep, type SettingsSource } from './claude-live.ts';
import { isGitRoot, readSettings, userSettingsPath } from './claude-settings-file.ts';
import { lastCallPath, readLastCall, type LastCallRead } from './last-call.ts';

const usage = 'usage: node claude-live-cli.ts (no arguments; run it in the project root)';
const installCli = join(import.meta.dirname, 'claude-install-cli.ts');

const labels: Record<LiveAnswer, string> = {
  live: 'live',
  'not-seen': 'registered, not seen',
  'not-registered': 'not registered',
};

const nextStep: Record<NextStep, string> = {
  'run-install': `Next: run the install here: node ${installCli} -- '<declared command>'\n`,
  'fix-settings':
    'Next: fix the settings file named above by hand so it is valid JSON of the right\n' +
    'shape. The install does not edit a file it cannot read.\n',
  'remove-copy':
    'Next: remove the changed copy in the file named above, or make it match the entry\n' +
    'in .claude/settings.json. The install edits only .claude/settings.json.\n',
  'turn-hooks-on': 'Next: set disableAllHooks to false, or remove it, in the file named above.\n',
  'stop-once':
    'Next: start Claude Code in this directory, accept the workspace trust dialog if it\n' +
    'appears, and let a session stop once.\n',
};

/** One settings file as the report names it: by its path. */
function source(path: string | null): SettingsSource {
  if (path === null) {
    return { name: 'user settings', read: { ok: false, error: 'neither CLAUDE_CONFIG_DIR nor HOME is set' } };
  }
  const read = readSettings(path, true);
  if (!read.ok) return { name: path, read };
  return { name: path, read: { ok: true, text: read.file?.text ?? null, changedAt: read.file?.mtime } };
}

async function lastCallOf(dir: string): Promise<LastCallRead> {
  const path = await lastCallPath(dir);
  return path === null ? { ok: false, error: 'no git dir found' } : readLastCall(path);
}

/** The report for the project in `dir`, from the files there and in the
 * environment's user settings. */
async function reportFor(dir: string): Promise<LiveReport> {
  return liveReport({
    local: source(join(dir, '.claude', 'settings.local.json')),
    project: source(join(dir, '.claude', 'settings.json')),
    user: source(userSettingsPath(process.env)),
    exists: existsSync,
    lastCall: await lastCallOf(dir),
    now: new Date(),
  });
}

function print(report: LiveReport): void {
  const notes = report.notes.map((note) => `- ${note}\n`).join('');
  const lines = `weftwork live check: ${labels[report.answer]}\n${report.reason}\n\n`;
  const next = report.next === null ? '' : nextStep[report.next];
  process.stdout.write(`${lines}${next}\nNotes:\n${notes}`);
}

async function main(args: string[]): Promise<number> {
  const dir = process.cwd();
  if (args.length !== 0) {
    process.stderr.write(`${usage}\n`);
    return 1;
  }
  if (!isGitRoot(dir)) {
    process.stderr.write(`weftwork live check: ${dir} is not the root of a git repository\n`);
    return 1;
  }
  const report = await reportFor(dir);
  print(report);
  return report.answer === 'live' ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
