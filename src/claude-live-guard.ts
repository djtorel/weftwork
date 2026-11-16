// story: e11s01
// The live check for the guard (guard-cli.ts): is its PreToolUse entry in the
// project settings, as the install writes it, with its adapter present, and
// did Claude Code run it? The guard writes no call record when it lets a call
// through, and this check does not change the guard. So the evidence is the
// session transcripts Claude Code keeps: a call the guard blocked (exit 2,
// its message in the tool result) shows that it ran, and a non-blocking hook
// error with the guard's command shows that it did not, and that the call
// went ahead. The newest of these wins.
//
// guardReport is pure; claude-live-cli.ts reads the files. The transcripts are
// read as data: the agent's own tool calls put text in them, so they are
// evidence, not proof, and every reason is escaped before it is printed.
import { join } from 'node:path';
import { guardCliOf, guardMatcher, isGuardAsInstalled } from './claude-guard-install.ts';
import { parseSettings, weftworkOnPath } from './claude-install.ts';
import { installHint, resolvedAdapter, shown, type SettingsSource } from './claude-live.ts';
import { isRecord } from './json.ts';
import { missingPrefix } from './launcher.ts';

/** `ran`: it blocked a call; `failing`: it could not run; `not-seen`: no trace. */
export type GuardAnswer = 'ran' | 'failing' | 'not-seen' | 'not-registered';
/** The one step that can change the answer: the install, a hand fix of the
 * settings file, or a fix of what stops the guard command from starting. */
export type GuardNext = 'run-install' | 'fix-settings' | 'fix-guard';
export type GuardReport = { answer: GuardAnswer; reason: string; next: GuardNext | null };
/** The newest session transcripts of the project, as text, or the error. */
export type Transcripts = { ok: true; texts: string[] } | { ok: false; error: string };

export type GuardInput = {
  project: SettingsSource;
  projectDir: string;
  /** As in LiveInput: a file exists, or `weftwork` is on PATH. */
  exists: (path: string) => boolean;
  transcripts: Transcripts;
};

/** A guard entry: the command Claude Code runs, the adapter it resolves to,
 * and whether the entry and its group are exactly what the install writes. */
type Entry = { command: string; runs: string; asInstalled: boolean };
type Event = { at: string; kind: 'blocked' | 'failed' | 'missing' };

/** The start of the message the resolver prints when weftwork is missing
 * (launcher.ts): a block, but not by the guard. */
const missingMessage = missingPrefix;

/** The guard entries in the PreToolUse list of `text`, or the error. */
function guardEntries(text: string | null): { ok: true; entries: Entry[]; others: number } | { ok: false; error: string } {
  const parsed = parseSettings(text);
  if (!parsed.ok) return parsed;
  const list = parsed.hooks.PreToolUse ?? [];
  if (!Array.isArray(list)) return { ok: false, error: '"hooks.PreToolUse" in the settings is not a list' };
  const entries: Entry[] = [];
  let others = 0;
  for (const group of list) {
    const hooks = isRecord(group) && Array.isArray(group.hooks) ? group.hooks : [];
    for (const hook of hooks) {
      const command = isRecord(hook) && typeof hook.command === 'string' ? hook.command : '';
      const cliPath = guardCliOf(command);
      if (cliPath === null) { others += 1; continue; }
      const asInstalled = isRecord(group) && group.matcher === guardMatcher && isGuardAsInstalled(hook, cliPath);
      entries.push({ command, runs: cliPath, asInstalled });
    }
  }
  return { ok: true, entries, others };
}

/** The guard event one transcript line holds for one of `commands`, or null. */
function eventOf(line: string, commands: string[]): Event | null {
  if (!line.includes('PreToolUse')) return null;
  let value: unknown;
  try { value = JSON.parse(line); } catch { return null; }
  if (!isRecord(value) || typeof value.timestamp !== 'string') return null;
  const at = value.timestamp;
  const hook = value.attachment;
  if (isRecord(hook) && hook.hookEvent === 'PreToolUse' && commands.includes(String(hook.command))) {
    if (hook.type === 'hook_non_blocking_error') return { at, kind: 'failed' };
    if (hook.type === 'hook_blocking_error') return { at, kind: String(hook.stderr).startsWith(missingMessage) ? 'missing' : 'blocked' };
  }
  const result = value.toolUseResult;
  if (typeof result !== 'string') return null;
  for (const command of commands) {
    const marker = ` hook error: [${command}]: `;
    const start = result.indexOf(marker);
    if (start < 0 || !result.slice(0, start).includes('PreToolUse:')) continue;
    const message = result.slice(start + marker.length);
    return { at, kind: message.startsWith(missingMessage) ? 'missing' : 'blocked' };
  }
  return null;
}

/** The newest guard event in the transcripts, or null when there is none. */
function newestEvent(texts: string[], commands: string[]): Event | null {
  let newest: Event | null = null;
  for (const text of texts) {
    for (const line of text.split('\n')) {
      const event = eventOf(line, commands);
      if (event !== null && (newest === null || Date.parse(event.at) >= Date.parse(newest.at))) newest = event;
    }
  }
  return newest;
}

function notRegistered(reason: string, next: GuardNext = 'run-install'): GuardReport {
  return { answer: 'not-registered', reason, next };
}

/** The report before its reason is escaped: the settings first, then the
 * transcripts. */
function rawReport(input: GuardInput): GuardReport {
  const read = input.project.read;
  const found = read.ok ? guardEntries(read.text) : read;
  if (!found.ok) return notRegistered(`${input.project.name}: ${found.error}`, 'fix-settings');
  const entries = found.entries.map((entry) => ({ ...entry, runs: resolvedAdapter(entry.runs, input.projectDir) }));
  if (entries.length === 0) {
    return notRegistered(`no weftwork guard in hooks.PreToolUse of ${input.project.name} (${found.others} other PreToolUse hook(s))`);
  }
  const present = entries.filter((entry) => input.exists(entry.runs));
  if (present.length === 0) {
    return entries.every((entry) => entry.runs === weftworkOnPath)
      ? notRegistered(`the guard entry runs the weftwork command, which is not installed for this project: ${installHint}`)
      : notRegistered(`the guard entry names ${entries.map((entry) => entry.runs).join(', ')}, which does not exist on this machine`);
  }
  const usable = present.filter((entry) => entry.asInstalled);
  if (usable.length === 0) {
    return notRegistered('the guard entry was changed by hand (matcher, timeout or another field), so it may not check every call');
  }
  return fromTranscripts(usable.map((entry) => entry.command), input.transcripts);
}

/** The answer from the transcripts, for a guard that is registered. */
function fromTranscripts(commands: string[], transcripts: Transcripts): GuardReport {
  if (!transcripts.ok) {
    return { answer: 'not-seen', reason: `the session transcripts cannot be read: ${transcripts.error}`, next: null };
  }
  const event = newestEvent(transcripts.texts, commands);
  if (event === null) {
    const reason = 'no guard call in the newest session transcripts: it leaves a trace only when it blocks a call or fails';
    return { answer: 'not-seen', reason, next: null };
  }
  if (event.kind === 'blocked') return { answer: 'ran', reason: `the guard last blocked a call at ${event.at}`, next: null };
  const reason = event.kind === 'missing'
    ? `at ${event.at} the weftwork command was not installed, so the hook blocked the call without running the guard`
    : `at ${event.at} the guard could not run (a non-blocking hook error), so the call went ahead unchecked`;
  return { answer: 'failing', reason, next: 'fix-guard' };
}

/** The folder where Claude Code keeps the session transcripts of the project
 * in `dir`: `<config dir>/projects/<dir>`, with each character that is not a
 * letter or a digit written as `-`. */
export function transcriptFolder(configDir: string, dir: string): string {
  return join(configDir, 'projects', dir.replace(/[^a-zA-Z0-9]/g, '-'));
}

/** Whether the guard is registered in the project settings and runs. */
export function guardReport(input: GuardInput): GuardReport {
  const report = rawReport(input);
  return { ...report, reason: shown(report.reason) };
}
