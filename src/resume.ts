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
import { isRecord } from './json.ts';

/** What the repository says now. `uncommitted` leaves out specs/state.yaml. */
export type ResumeFacts = {
  /** The branch HEAD points to, or null for a detached HEAD. */
  branch: string | null;
  uncommitted: readonly string[];
  /** True when the path, relative to the root, exists (not followed). */
  exists: (path: string) => boolean;
};

export type ResumeAnswer = 'ready' | 'stale' | 'unverifiable' | 'missing';
export type ResumeReport = { answer: ResumeAnswer; reasons: string[]; notes: string[]; next_skill: string | null };

/** The parts of a block the check reads, once their types are known. */
type Checkable = { branch: string; files: string[]; uncommitted: string[] };

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** The block's branch and lists, or why they cannot be checked. A missing
 * list is empty: a block without `uncommitted` errs toward stale. */
function checkable(handoff: Record<string, unknown>): Checkable | string {
  const { branch } = handoff;
  const files = handoff['files'] ?? [];
  const uncommitted = handoff['uncommitted'] ?? [];
  if (typeof branch !== 'string') return 'the handoff has no branch to check';
  if (!isTextList(files)) return 'the handoff files is not a list of paths';
  if (!isTextList(uncommitted)) return 'the handoff uncommitted is not a list of paths';
  return { branch, files, uncommitted };
}

/** Every way the block and the facts differ, in a fixed order: the branch,
 * then each missing file, then each unexpected uncommitted path, each list
 * sorted. */
function staleReasons(block: Checkable, facts: ResumeFacts): string[] {
  const reasons: string[] = [];
  if (facts.branch === null) {
    reasons.push(`HEAD is detached; the handoff starts on branch ${block.branch}`);
  } else if (facts.branch !== block.branch) {
    reasons.push(`the current branch is ${facts.branch}; the handoff starts on branch ${block.branch}`);
  }
  for (const file of [...block.files].sort()) {
    if (!facts.exists(file)) reasons.push(`${file} is named in the handoff and does not exist`);
  }
  const then = new Set(block.uncommitted);
  for (const path of [...facts.uncommitted].sort()) {
    if (!then.has(path)) reasons.push(`${path} is uncommitted now and was not when the handoff was written`);
  }
  return reasons;
}

/** Paths that were uncommitted when the block was written and are clean now. */
function cleanNotes(block: Checkable, facts: ResumeFacts): string[] {
  const now = new Set(facts.uncommitted);
  return [...block.uncommitted]
    .sort()
    .filter((path) => !now.has(path))
    .map((path) => `${path} was uncommitted when the handoff was written and is clean now`);
}

/** Whether the handoff block (the value of the `handoff` key, undefined when
 * the key is absent) can be trusted against the repository `facts`. Only
 * `ready` means it can. */
export function resumeReport(handoff: unknown, facts: ResumeFacts): ResumeReport {
  if (handoff === undefined || handoff === null) {
    return { answer: 'missing', reasons: ['the state file has no handoff block'], notes: [], next_skill: null };
  }
  if (!isRecord(handoff)) {
    return { answer: 'unverifiable', reasons: ['the handoff is not a mapping'], notes: [], next_skill: null };
  }
  const next_skill = typeof handoff['next_skill'] === 'string' ? handoff['next_skill'] : null;
  const block = checkable(handoff);
  if (typeof block === 'string') return { answer: 'unverifiable', reasons: [block], notes: [], next_skill };
  const reasons = staleReasons(block, facts);
  return { answer: reasons.length === 0 ? 'ready' : 'stale', reasons, notes: cleanNotes(block, facts), next_skill };
}
