// story: e08s04
// The resume check: does the handoff block of specs/state.yaml still match
// the repository? Stored state goes stale (R12), so a session that remembers
// nothing checks the note before it acts on it. resumeReport is pure, like
// liveReport in claude-live.ts; resume-cli.ts reads the file and git and
// prints. Owner decisions (e08s04 spec section 1): four answers; stale lists
// every reason; the check never writes; no commit hash is compared.
//
// `files` and `uncommitted` are never compared with each other. `files` is
// only checked for existence. The two uncommitted lists, then and now, both
// come from uncommittedPaths in tree.ts, so a folder is `dir/` in both and
// they compare as text.
import type { Failure } from './errors.ts';
import { isRecord } from './json.ts';

/** What the repository says now. `uncommitted` leaves out specs/state.yaml. */
export type ResumeFacts = {
  /** The branch HEAD points to, or null when it is on none: detached, or a
   * ref outside refs/heads/. */
  branch: string | null;
  uncommitted: readonly string[];
  /** True when the path, relative to the root, exists (not followed). */
  exists: (path: string) => boolean;
};

export type ResumeAnswer = 'ready' | 'stale' | 'unverifiable' | 'missing';
/** `ok` is true for every answer: the check ran. A fault that stops it is
 * the CLI's `{ ok: false, error }`, so a caller tells them apart by `ok`. */
export type ResumeReport = { ok: true; answer: ResumeAnswer; reasons: string[]; notes: string[]; next_skill: string | null };

/** The parts of a block the check reads, once their types are known. */
type Checkable = { branch: string; files: string[]; uncommitted: string[] };

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** The block's branch and lists, or why they cannot be checked. The engine
 * always writes both lists; a block without one, or with null, was not
 * written by it, and on a clean tree would read as ready with nothing
 * checked (request-review round 1). */
function checkable(handoff: Record<string, unknown>): { ok: true; block: Checkable } | Failure {
  const { branch, files, uncommitted } = handoff;
  if (typeof branch !== 'string') return { ok: false, error: 'the handoff has no branch to check' };
  if (!isTextList(files)) return { ok: false, error: 'the handoff files is missing or not a list of paths' };
  if (!isTextList(uncommitted)) return { ok: false, error: 'the handoff uncommitted is missing or not a list of paths' };
  return { ok: true, block: { branch, files, uncommitted } };
}

/** Every way the block and the facts differ, in a fixed order: the branch,
 * then each missing file, then each unexpected uncommitted path, each list
 * sorted. */
function staleReasons(block: Checkable, facts: ResumeFacts): string[] {
  const reasons: string[] = [];
  if (facts.branch === null) {
    reasons.push(`HEAD is not on a branch (detached, or a ref outside refs/heads/); the handoff starts on branch ${block.branch}`);
  } else if (facts.branch !== block.branch) {
    reasons.push(`the current branch is ${facts.branch}; the handoff starts on branch ${block.branch}`);
  }
  for (const file of [...block.files].sort()) {
    if (!facts.exists(file)) reasons.push(`${file} is named in the handoff and was not found inside the repository`);
  }
  const then = new Set(block.uncommitted);
  for (const path of [...facts.uncommitted].sort()) {
    if (!then.has(path)) reasons.push(`${path} is uncommitted now and was not when the handoff was written`);
  }
  return reasons;
}

/** Paths that were uncommitted when the block was written and that git
 * status no longer lists. Not "clean": after a rename or a partial add the
 * old name is gone or the folder is listed by its files (review round 1). */
function cleanNotes(block: Checkable, facts: ResumeFacts): string[] {
  const now = new Set(facts.uncommitted);
  return [...block.uncommitted]
    .sort()
    .filter((path) => !now.has(path))
    .map((path) => `${path} was uncommitted when the handoff was written and is no longer listed by git status`);
}

/** A report; the defaults fit the answers that check nothing. */
function report(answer: ResumeAnswer, reasons: string[], notes: string[] = [], next_skill: string | null = null): ResumeReport {
  return { ok: true, answer, reasons, notes, next_skill };
}

/** Whether the handoff block (the value of the `handoff` key, undefined when
 * the key is absent) can be trusted against the repository `facts`. Only
 * `ready` means it can. */
export function resumeReport(handoff: unknown, facts: ResumeFacts): ResumeReport {
  if (handoff === undefined || handoff === null) return report('missing', ['the state file has no handoff block']);
  if (!isRecord(handoff)) return report('unverifiable', ['the handoff is not a mapping']);
  const next_skill = typeof handoff['next_skill'] === 'string' ? handoff['next_skill'] : null;
  const checked = checkable(handoff);
  if (!checked.ok) return report('unverifiable', [checked.error], [], next_skill);
  const reasons = staleReasons(checked.block, facts);
  return report(reasons.length === 0 ? 'ready' : 'stale', reasons, cleanNotes(checked.block, facts), next_skill);
}
