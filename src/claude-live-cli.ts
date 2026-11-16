// story: e07s04, e11s01
// Thin shell for the live check: run in the root of a project, it says whether
// Claude Code runs weftwork's Stop hook and the guard there, and exits 0 only
// when the Stop hook is live and the guard is registered and not failing.
// The guard is checked against the project's newest session transcripts.
// It reads .claude/settings.local.json, .claude/settings.json, the user
// settings ($CLAUDE_CONFIG_DIR/settings.json, else ~/.claude/settings.json)
// and the call record, following symlinks as Claude Code does. Logic lives in
// claude-live.ts and claude-live-guard.ts. It writes nothing.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { weftworkOnPath } from './claude-install.ts';
import { guardReport, transcriptFolder, type GuardAnswer, type GuardNext, type GuardReport, type Transcripts } from './claude-live-guard.ts';
import { liveReport, type LiveAnswer, type LiveReport, type NextStep, type SettingsSource } from './claude-live.ts';
import { isGitRoot, readSettings, userSettingsPath } from './claude-settings-file.ts';
import { isMissing, messageOf } from './errors.ts';
import { lastCallPath, readLastCall, type LastCallRead } from './last-call.ts';

const usage = 'usage: weftwork claude-live (no arguments; run it in the project root)';

const labels: Record<LiveAnswer, string> = {
  live: 'live',
  'not-seen': 'registered, not seen',
  'not-registered': 'not registered',
};

const nextStep: Record<NextStep, string> = {
  'run-install': "Next: run the install here: weftwork claude-install -- '<declared command>'\n" +
    '(npm install -g weftwork first if the weftwork command is missing).\n',
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

const guardLabels: Record<GuardAnswer, string> = {
  ran: 'ran',
  failing: 'failing',
  'not-seen': 'registered, not seen',
  'not-registered': 'not registered',
};

const guardNext: Record<GuardNext, string> = {
  'run-install': 'Next: run the install here; it adds the guard with the Stop hook.\n',
  'fix-settings': 'Next: fix the settings file named above by hand.\n',
  'fix-guard':
    'Next: fix what stops the guard command in the project settings from starting\n' +
    '(a missing weftwork command or node_modules), then start a new session.\n',
};

/** How many of the newest transcripts the guard check reads. */
const transcriptCount = 3;

/** The newest session transcripts Claude Code keeps for `dir`. No folder is
 * no transcripts yet. */
function transcriptsOf(dir: string): Transcripts {
  const settings = userSettingsPath(process.env);
  if (settings === null) return { ok: false, error: 'neither CLAUDE_CONFIG_DIR nor HOME is set' };
  const folder = transcriptFolder(dirname(settings), dir);
  try {
    const files = readdirSync(folder).filter((name) => name.endsWith('.jsonl')).map((name) => join(folder, name));
    const newest = files.map((path) => ({ path, at: statSync(path).mtimeMs })).sort((a, b) => b.at - a.at);
    return { ok: true, texts: newest.slice(0, transcriptCount).map((file) => readFileSync(file.path, 'utf8')) };
  } catch (error) {
    return isMissing(error) ? { ok: true, texts: [] } : { ok: false, error: messageOf(error) };
  }
}

/** True for a file at `path`, or, for an entry that runs weftwork from PATH,
 * when this shell finds the command. */
function exists(path: string): boolean {
  if (path !== weftworkOnPath) return existsSync(path);
  return spawnSync('/bin/sh', ['-c', 'command -v weftwork'], { stdio: 'ignore', timeout: 10000 }).status === 0;
}

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

/** The reports for the project in `dir`, from the files there and in the
 * environment's user settings: the Stop hook's, then the guard's. */
async function reportFor(dir: string): Promise<[LiveReport, GuardReport]> {
  const project = source(join(dir, '.claude', 'settings.json'));
  const guard = guardReport({ project, projectDir: dir, exists, transcripts: transcriptsOf(dir) });
  const stop = liveReport({
    local: source(join(dir, '.claude', 'settings.local.json')),
    project,
    user: source(userSettingsPath(process.env)),
    projectDir: dir,
    exists,
    lastCall: await lastCallOf(dir),
    now: new Date(),
  });
  return [stop, guard];
}

function print(report: LiveReport, guard: GuardReport): void {
  const notes = report.notes.map((note) => `- ${note}\n`).join('');
  const lines = `weftwork live check: ${labels[report.answer]}\n${report.reason}\n\n`;
  const next = report.next === null ? '' : nextStep[report.next];
  const guardLines = `\nguard: ${guardLabels[guard.answer]}\n${guard.reason}\n${guard.next === null ? '' : guardNext[guard.next]}`;
  process.stdout.write(`${lines}${next}${guardLines}\nNotes:\n${notes}`);
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
  const [report, guard] = await reportFor(dir);
  print(report, guard);
  return report.answer === 'live' && (guard.answer === 'ran' || guard.answer === 'not-seen') ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
