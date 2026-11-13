// story: e07s04
// Thin shell for the live check: run in the root of a project, it says whether
// Claude Code runs weftwork's Stop hook there, and exits 0 only when it does.
// It reads .claude/settings.local.json, .claude/settings.json, the user
// settings ($CLAUDE_CONFIG_DIR/settings.json, else ~/.claude/settings.json)
// and the call record, following symlinks as Claude Code does. Logic lives in
// claude-live.ts. It writes nothing.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { liveReport, type LiveAnswer, type LiveReport, type SettingsSource } from './claude-live.ts';
import { isGitRoot, readSettings } from './claude-settings-file.ts';
import { lastCallPath, readLastCall, type LastCallRead } from './last-call.ts';

const usage = 'usage: node claude-live-cli.ts (no arguments; run it in the project root)';
const installCli = join(import.meta.dirname, 'claude-install-cli.ts');

const labels: Record<LiveAnswer, string> = {
  live: 'live',
  'not-seen': 'registered, not seen',
  'not-registered': 'not registered',
};

const nextStep: Record<LiveAnswer, string> = {
  live: '',
  'not-seen':
    'Next: start Claude Code in this directory, accept the workspace trust dialog if it\n' +
    'appears, and let a session stop once. If disableAllHooks is true, set it to false.\n',
  'not-registered': `Next: run the install here: node ${installCli} -- '<declared command>'\n`,
};

/** One settings file as the report names it: by its path. */
function source(path: string | null): SettingsSource {
  if (path === null) {
    return { name: 'user settings', read: { ok: false, error: 'neither CLAUDE_CONFIG_DIR nor HOME is set' } };
  }
  const read = readSettings(path, true);
  return { name: path, read: read.ok ? { ok: true, text: read.file?.text ?? null } : read };
}

/** The user settings file Claude Code reads, from the environment. An empty
 * variable counts as unset: join('', ...) would name a file in the project. */
function userSettingsPath(env: NodeJS.ProcessEnv): string | null {
  const configDir = env.CLAUDE_CONFIG_DIR === '' ? undefined : env.CLAUDE_CONFIG_DIR;
  const home = env.HOME === '' ? undefined : env.HOME;
  const dir = configDir ?? (home === undefined ? undefined : join(home, '.claude'));
  return dir === undefined ? null : join(dir, 'settings.json');
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
  process.stdout.write(`${lines}${nextStep[report.answer]}\nNotes:\n${notes}`);
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
