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
// check cannot tell (not seen); no entry is exactly as the install writes it,
// so a hand edit may stop it blocking (not seen); no usable call record (not
// seen); the record is of the same adapter and command as such an entry
// (live); otherwise not seen.
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

export type SettingsRead = { ok: true; text: string | null } | { ok: false; error: string };
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
export type LiveReport = { answer: LiveAnswer; reason: string; notes: string[] };

/** A weftwork entry, and whether it is exactly what the install writes. */
type Entry = StopHookEntry & { asInstalled: boolean };
type Registered = { ok: true; entries: Entry[]; others: number } | { ok: false; reason: string };

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
];

/** The weftwork entries in the project's Stop list, and how many other Stop
 * hooks it holds. */
function weftworkEntries(project: SettingsSource): Registered {
  if (!project.read.ok) {
    return { ok: false, reason: `${project.name}: ${project.read.error}` };
  }
  const parsed = parseSettings(project.read.text);
  const stop = parsed.ok ? stopListOf(parsed.hooks) : parsed;
  if (!stop.ok) {
    return { ok: false, reason: `${project.name}: ${stop.error}` };
  }
  const hooks = stop.groups.flatMap((group) => group.hooks);
  const entries = hooks.flatMap((hook) => {
    const ours = parseStopHook(hook);
    return ours === null ? [] : [{ ...ours, asInstalled: isAsInstalled(hook, ours) }];
  });
  return { ok: true, entries, others: hooks.length - entries.length };
}

/** Why hooks do not run, or null when they do, from the first file in
 * precedence order that sets disableAllHooks. A file that cannot be read means
 * the check cannot tell. */
function hooksOff(sources: SettingsSource[]): string | null {
  for (const source of sources) {
    const parsed = source.read.ok ? parseSettings(source.read.text) : source.read;
    if (!parsed.ok) {
      return `cannot tell whether hooks are on: ${source.name}: ${parsed.error}`;
    }
    const value = parsed.settings.disableAllHooks;
    if (value === true) {
      return `disableAllHooks is true in ${source.name}, so Claude Code runs no hook from settings`;
    }
    if (value !== undefined && value !== false) {
      return `cannot tell whether hooks are on: disableAllHooks in ${source.name} is not true or false`;
    }
    if (value === false) {
      return null;
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

function notesFor(entries: Entry[]): string[] {
  const many = entries.length > 1
    ? [`${entries.length} weftwork Stop hooks are registered, so ${entries.length} run on each stop.`]
    : [];
  return [...many, ...standingNotes];
}

/** The answer for a registered hook whose adapter exists. */
function answerFromRecord(present: Entry[], lastCall: LastCallRead, now: Date): Omit<LiveReport, 'notes'> {
  if (!lastCall.ok) {
    return { answer: 'not-seen', reason: `the call record cannot be read: ${lastCall.error}` };
  }
  const call: LastCall | null = lastCall.call;
  if (call === null) {
    return { answer: 'not-seen', reason: 'no call recorded yet: let a Claude Code session stop once' };
  }
  const when = `${call.at} (${ageOf(call.at, now)})`;
  if (present.some((entry) => entry.cliPath === call.cliPath && entry.command === call.command)) {
    return { answer: 'live', reason: `Claude Code last called this hook for '${call.command}' at ${when}` };
  }
  return { answer: 'not-seen', reason: `the last call, at ${when}, ran another command or adapter` };
}

/** The reason with every control character written as `\uXXXX`: C0, DEL and
 * C1, the direction marks and overrides, and the line and paragraph
 * separators. The record, the settings and the error texts are the agent's to
 * write, and such characters printed raw could draw a fake answer line or
 * reorder the text on the owner's screen (security review F2; review round 2,
 * A-F4 and B-1). */
const unsafeCharacters = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/g;

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
function whyNotRegistered(entries: Entry[], others: number, input: LiveInput): string | null {
  if (entries.length === 0) {
    return `no weftwork Stop hook in ${input.project.name} (${others} other Stop hook(s))`;
  }
  if (!entries.some((entry) => input.exists(entry.cliPath))) {
    const paths = entries.map((entry) => entry.cliPath).join(', ');
    return `the entry names ${paths}, which does not exist on this machine: run the install again`;
  }
  return null;
}

/** The report before its reason is escaped, in the order the header gives. */
function rawReport(input: LiveInput): LiveReport {
  const found = weftworkEntries(input.project);
  if (!found.ok) {
    return { answer: 'not-registered', reason: found.reason, notes: [...standingNotes] };
  }
  const notes = notesFor(found.entries);
  const missing = whyNotRegistered(found.entries, found.others, input);
  if (missing !== null) {
    return { answer: 'not-registered', reason: missing, notes };
  }
  const off = hooksOff([input.local, input.project, input.user]);
  if (off !== null) {
    return { answer: 'not-seen', reason: off, notes };
  }
  return { ...answerFor(found.entries, input), notes };
}

/** The answer once an entry is registered and hooks are on. Only an entry as
 * the install writes it, with its adapter file present, can block a stop, so
 * only a record of one of those is live. */
function answerFor(entries: Entry[], input: LiveInput): Omit<LiveReport, 'notes'> {
  const usable = entries.filter((entry) => entry.asInstalled && input.exists(entry.cliPath));
  if (usable.length === 0) {
    const reason = 'the weftwork entry was changed by hand (async, if, timeout or another field), ' +
      'so it may not block a stop: run the install again';
    return { answer: 'not-seen', reason };
  }
  return answerFromRecord(usable, input.lastCall, input.now);
}
