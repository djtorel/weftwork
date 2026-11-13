// story: e07s04
// The live check: is the Stop hook that e07s03 registers actually run by
// Claude Code? A Stop hook that never starts blocks nothing, and no host option
// makes the host block a stop because a hook failed to start (R13 [S25]). So
// this check reads the settings and the call record (last-call.ts) and answers
// one of three things. It spends no model tokens and starts no session.
//
// liveReport is pure; claude-live-cli.ts reads the files and prints. Order,
// first match wins: the project settings hold no usable weftwork entry (not
// registered); its adapter file is gone (not registered); hooks are off, or the
// check cannot tell (not seen); no entry is exactly as the install writes it
// with no changed copy of the same handler in the local, project or user file,
// so a hand edit may stop it blocking (not seen); no usable call record (not
// seen); the record is of the same adapter and command as such an entry, and
// no settings file changed after it (live); otherwise not seen. Each answer
// carries the one step that can change it.
//
// disableAllHooks takes the value left after precedence: local, then project,
// then user settings (Claude Code docs, "Disable or remove hooks", read
// 2026-11-12). Managed settings and the --settings flag sit above all three
// and cannot be read from here, so the notes say so.
import {
  isAsInstalled,
  parseSettings,
  parseStopHook,
  stopListOf,
  type StopHookEntry,
} from './claude-install.ts';
import type { LastCall, LastCallRead } from './last-call.ts';

/** What reading one settings file gave: its text (null for no file) and when
 * it last changed, or the error. */
export type SettingsRead = { ok: true; text: string | null; changedAt?: Date } | { ok: false; error: string };
/** One settings file: its name for the report, and what reading it gave. */
export type SettingsSource = { name: string; read: SettingsRead };

export type LiveInput = {
  local: SettingsSource;
  project: SettingsSource;
  user: SettingsSource;
  /** True when a file exists at the absolute path. */
  exists: (path: string) => boolean;
  lastCall: LastCallRead;
  now: Date;
};

export type LiveAnswer = 'live' | 'not-seen' | 'not-registered';
/** The one step that can change the answer (review round 5). */
export type NextStep = 'run-install' | 'fix-settings' | 'remove-copy' | 'turn-hooks-on' | 'stop-once';
export type LiveReport = { answer: LiveAnswer; reason: string; next: NextStep | null; notes: string[] };
/** An answer before its notes are added. */
type Verdict = Omit<LiveReport, 'notes'>;

/** A weftwork entry: the file it is in, whether it is exactly what the install
 * writes, and whether its adapter file exists. */
type Entry = StopHookEntry & { file: string; asInstalled: boolean; present: boolean };
type Registered = { ok: true; entries: Entry[]; others: number } | { ok: false; reason: string };
type Copies = { ok: true; entries: Entry[] } | { ok: false; reason: string };

/** What the check cannot see, printed with every answer. */
const standingNotes = [
  'Managed settings and the --settings flag were not read. disableAllHooks or ' +
    'allowManagedHooksOnly there would stop the hook.',
  'The call record is evidence, not proof: the agent can write it too.',
  'The hook runs in CLAUDE_PROJECT_DIR. A session that works in a git worktree ' +
    "is gated on that directory's tree, not the worktree's.",
  'GIT_DIR, GIT_WORK_TREE or GIT_INDEX_FILE in the hook environment would move ' +
    'the fingerprint the gate takes.',
  'A crash or SIGKILL after the record is written still reads as seen; one ' +
    'before it reads as not seen.',
  'Running the hook by hand with CLAUDE_PROJECT_DIR set also writes a matching ' +
    'record, so live means the hook was called, not that Claude Code called it.',
  'The record does not name the project folder: a session started in a ' +
    'subdirectory that has its own copy of the same entry also leaves it.',
  'The user settings were read from this shell\'s CLAUDE_CONFIG_DIR or HOME, ' +
    'which can differ from the ones the Claude Code session runs with.',
  'An entry that names the adapter through a symlinked path runs and blocks, ' +
    'but never reads as live: the record holds the resolved path.',
];

/** The weftwork entries in one file's Stop list, and how many other Stop hooks
 * it holds. */
function weftworkEntries(source: SettingsSource, exists: (path: string) => boolean): Registered {
  if (!source.read.ok) {
    return { ok: false, reason: `${source.name}: ${source.read.error}` };
  }
  const parsed = parseSettings(source.read.text);
  const stop = parsed.ok ? stopListOf(parsed.hooks) : parsed;
  if (!stop.ok) {
    return { ok: false, reason: `${source.name}: ${stop.error}` };
  }
  const hooks = stop.groups.flatMap((group) => group.hooks);
  const entries = hooks.flatMap((hook): Entry[] => {
    const ours = parseStopHook(hook);
    if (ours === null) return [];
    return [{ ...ours, file: source.name, asInstalled: isAsInstalled(hook, ours), present: exists(ours.cliPath) }];
  });
  return { ok: true, entries, others: hooks.length - entries.length };
}

/** The weftwork entries in the local and user files. Claude Code runs a handler
 * defined in more than one settings file once (hooks docs, read 2026-11-12),
 * so a changed copy there can be the one that runs (review round 3, A1, B-1). */
function copiesIn(sources: SettingsSource[], exists: (path: string) => boolean): Copies {
  const entries: Entry[] = [];
  for (const source of sources) {
    const found = weftworkEntries(source, exists);
    if (!found.ok) return found;
    entries.push(...found.entries);
  }
  return { ok: true, entries };
}

function notSeen(reason: string, next: NextStep): Verdict {
  return { answer: 'not-seen', reason, next };
}

/** Why hooks do not run, or null when they do, from the first file in
 * precedence order that sets disableAllHooks. A file that cannot be read means
 * the check cannot tell. */
function hooksOff(sources: SettingsSource[]): Verdict | null {
  for (const source of sources) {
    const parsed = source.read.ok ? parseSettings(source.read.text) : source.read;
    if (!parsed.ok) {
      return notSeen(`cannot tell whether hooks are on: ${source.name}: ${parsed.error}`, 'fix-settings');
    }
    const value = parsed.settings.disableAllHooks;
    if (value === true) {
      return notSeen(`disableAllHooks is true in ${source.name}, so Claude Code runs no hook from settings`, 'turn-hooks-on');
    }
    if (value === false) {
      return null;
    }
    if (value !== undefined) {
      return notSeen(`cannot tell whether hooks are on: disableAllHooks in ${source.name} is not true or false`, 'fix-settings');
    }
  }
  return null;
}

/** How long ago `at` was, in the largest whole unit. A time after `now` (a
 * clock skew, or a forged record) is said as such, not as a negative age. */
function ageOf(at: string, now: Date): string {
  const seconds = Math.round((now.getTime() - Date.parse(at)) / 1000);
  if (Number.isNaN(seconds)) return 'age unknown';
  if (seconds < 0) return 'in the future';
  const units: [number, string][] = [[86400, 'd'], [3600, 'h'], [60, 'min']];
  const unit = units.find(([size]) => seconds >= size);
  return unit === undefined ? `${seconds} s ago` : `${Math.floor(seconds / unit[0])} ${unit[1]} ago`;
}

/** One handler: the adapter and the command. Claude Code runs the same handler
 * once, so entries with one key are one hook (review rounds 4 and 5). */
function handlerKey(entry: StopHookEntry): string {
  return `${entry.cliPath}\0${entry.command}`;
}

function sameHandler(a: StopHookEntry, b: StopHookEntry): boolean {
  return handlerKey(a) === handlerKey(b);
}

/** The notes, with a count of distinct handlers in the project settings when
 * there is more than one. Handlers in the local or user file run too, so the
 * count is a floor (review round 5, A-F3). */
function notesFor(entries: Entry[]): string[] {
  const handlers = new Set(entries.map(handlerKey)).size;
  const many = handlers > 1
    ? [`${handlers} weftwork Stop hooks are registered in the project settings, so at least ${handlers} run on each stop.`]
    : [];
  return [...many, ...standingNotes];
}

/** When any of `sources` last changed, in ms, or 0 when none says. */
function newestChange(sources: SettingsSource[]): number {
  const times = sources.map((source) => (source.read.ok ? source.read.changedAt?.getTime() ?? 0 : 0));
  return Math.max(0, ...times);
}

/** The answer from the call record. A record from before the newest settings
 * change may be of an entry that has changed since, so it is not live until the
 * host calls the hook again (review round 5, B-1). */
function answerFromRecord(usable: Entry[], input: LiveInput): Verdict {
  if (!input.lastCall.ok) {
    return notSeen(`the call record cannot be read: ${input.lastCall.error}`, 'stop-once');
  }
  const call: LastCall | null = input.lastCall.call;
  if (call === null) {
    return notSeen('no call recorded yet: let a Claude Code session stop once', 'stop-once');
  }
  const when = `${call.at} (${ageOf(call.at, input.now)})`;
  if (!usable.some((entry) => sameHandler(entry, call))) {
    return notSeen(`the last call, at ${when}, ran another command or adapter`, 'stop-once');
  }
  if (Date.parse(call.at) < newestChange([input.local, input.project, input.user])) {
    return notSeen(`the settings changed after the last call, at ${when}, so that call may have run an older entry`, 'stop-once');
  }
  return { answer: 'live', reason: `Claude Code last called this hook for '${call.command}' at ${when}`, next: null };
}

/** The reason with every control character written as `\uXXXX`: the Unicode
 * control characters (C0, DEL, C1), every Bidi_Control character, and the line
 * and paragraph separators. The record, the settings and the error texts are
 * the agent's to write, and such characters printed raw could draw a fake
 * answer line or reorder the text on the owner's screen (security review F2;
 * review rounds 2 and 3). */
const unsafeCharacters = /[\p{Cc}\p{Bidi_Control}\u2028\u2029]/gu;

function shown(text: string): string {
  return text.replace(unsafeCharacters, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Whether the hook is live. Only a record of the same adapter and command as
 * an entry in the settings now is `live`. */
export function liveReport(input: LiveInput): LiveReport {
  const report = rawReport(input);
  return { ...report, reason: shown(report.reason) };
}

/** Why the project has no usable weftwork entry, or null when it has one whose
 * adapter file exists. */
function whyNotRegistered(entries: Entry[], others: number, file: string): string | null {
  if (entries.length === 0) {
    return `no weftwork Stop hook in ${file} (${others} other Stop hook(s))`;
  }
  if (!entries.some((entry) => entry.present)) {
    const paths = entries.map((entry) => entry.cliPath).join(', ');
    return `the entry names ${paths}, which does not exist on this machine: run the install again`;
  }
  return null;
}

/** The report before its reason is escaped, in the order the header gives. A
 * project file the install cannot read is fixed by hand, not by the install. */
function rawReport(input: LiveInput): LiveReport {
  const found = weftworkEntries(input.project, input.exists);
  if (!found.ok) {
    return { answer: 'not-registered', reason: found.reason, next: 'fix-settings', notes: [...standingNotes] };
  }
  const notes = notesFor(found.entries);
  const missing = whyNotRegistered(found.entries, found.others, input.project.name);
  if (missing !== null) {
    return { answer: 'not-registered', reason: missing, next: 'run-install', notes };
  }
  return { ...answerWhenRegistered(found.entries, input), notes };
}

/** The answer for a registered hook whose adapter exists: hooks must be on,
 * the local and user Stop lists readable, and then the entries decide. */
function answerWhenRegistered(entries: Entry[], input: LiveInput): Verdict {
  const off = hooksOff([input.local, input.project, input.user]);
  if (off !== null) {
    return off;
  }
  const copies = copiesIn([input.local, input.user], input.exists);
  if (!copies.ok) {
    return notSeen(`cannot tell whether a changed copy of the entry exists: ${copies.reason}`, 'fix-settings');
  }
  return answerFor(entries, copies.entries, input);
}

/** The answer once an entry is registered and hooks are on. Only a project
 * entry as the install writes it, with its adapter present and no changed copy
 * of the same handler in any file, can block a stop, so only a record of one of
 * those is live. A copy in the local or user file can rule an entry out, never
 * stand in for it (review round 4, B-1). The install fixes only the project
 * file, so a changed copy elsewhere is removed by hand (review round 5, A-F1). */
function answerFor(project: Entry[], copies: Entry[], input: LiveInput): Verdict {
  const changed = [...project, ...copies].filter((entry) => !entry.asInstalled);
  const usable = project.filter((entry) =>
    entry.asInstalled && entry.present && !changed.some((other) => sameHandler(other, entry)));
  if (usable.length > 0) {
    return answerFromRecord(usable, input);
  }
  const relevant = changed.filter((other) => project.some((entry) => sameHandler(other, entry)));
  const files = [...new Set(relevant.map((entry) => entry.file))];
  const reason = `a weftwork entry in ${files.join(', ')} was changed by hand (async, if, timeout or ` +
    'another field), so the hook may not block a stop';
  return notSeen(reason, files.every((file) => file === input.project.name) ? 'run-install' : 'remove-copy');
}
