// story: e08s03
// The handoff block of specs/state.yaml, written by the engine for a session
// that remembers nothing (R12). The caller gives what only it knows: the next
// skill, the note, the branch to start on and the files the note names. The
// engine adds what it can measure itself, when it wrote the block and which
// paths were uncommitted then, so e08s04 can check the block at resume and the
// agent cannot get those facts wrong. No commit hash is kept: PRs are
// squash-merged, so a branch hash does not exist on main (owner decision 3).
import { lstatSync } from 'node:fs';
import type { Failure } from './errors.ts';
import { isRecord } from './json.ts';
import { stateFile } from './state-fields.ts';
import { insideRoot, writeStateMapping, type WriteField } from './state-file.ts';
import { uncommittedPaths } from './tree.ts';

/** The longest note, in code points (owner decision 2). */
export const maxNoteLength = 4000;

/** The longest one-line field, in code points, as for the state fields. */
const maxLineLength = 200;

/** The part of the block the caller gives. */
export type HandoffInput = {
  next_skill: string;
  next_epic: string | null;
  next_story: string | null;
  branch: string;
  files: string[];
  note: string;
};

/** Keys the caller may send. written_at and uncommitted are taken and ignored:
 * the engine fills them. */
const callerKeys = new Set(['next_skill', 'next_epic', 'next_story', 'branch', 'files', 'note']);
const engineKeys = new Set(['written_at', 'uncommitted']);

/** Why `value` cannot be the one-line field `key`, or null. */
function lineProblem(key: string, value: unknown, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string') return `${key} must be text${nullable ? ' or null' : ''}`;
  if (value === '') return `${key} must not be empty`;
  if (/[\n\r]/.test(value)) return `${key} must be one line`;
  if ([...value].length > maxLineLength) return `${key} must be ${maxLineLength} characters or fewer`;
  return null;
}

/** Why the path `file` cannot be named in the handoff, or null: it must be a
 * relative path of one line inside the repository at `root`, and exist. */
function fileProblem(root: string, file: unknown): string | null {
  if (typeof file !== 'string' || file === '') return 'files must hold only non-empty text';
  if (/[\n\r]/.test(file)) return `files: ${JSON.stringify(file)} must be one line`;
  const inside = insideRoot(root, file);
  if (!inside.ok) return `files: ${inside.error}`;
  try {
    lstatSync(inside.path);
  } catch {
    return `files: ${file} does not exist in the repository`;
  }
  return null;
}

/** The caller's part of the handoff, or a failure that names the field. */
export function checkHandoff(root: string, input: unknown): { ok: true; handoff: HandoffInput } | Failure {
  if (!isRecord(input)) return { ok: false, error: 'the handoff must be a JSON object' };
  const unknown = Object.keys(input).filter((key) => !callerKeys.has(key) && !engineKeys.has(key));
  if (unknown.length > 0) return { ok: false, error: `the handoff has no key ${unknown.join(', ')}` };
  const { next_skill, branch, note } = input;
  const next_epic = input['next_epic'] ?? null;
  const next_story = input['next_story'] ?? null;
  const files = input['files'] ?? [];
  const problem =
    lineProblem('next_skill', next_skill, false) ??
    lineProblem('branch', branch, false) ??
    lineProblem('next_epic', next_epic, true) ??
    lineProblem('next_story', next_story, true);
  if (problem !== null) return { ok: false, error: problem };
  if (typeof note !== 'string' || note === '') return { ok: false, error: 'note must be non-empty text' };
  if ([...note].length > maxNoteLength) return { ok: false, error: `note must be ${maxNoteLength} characters or fewer` };
  if (!Array.isArray(files)) return { ok: false, error: 'files must be a list of paths' };
  for (const file of files) {
    const refused = fileProblem(root, file);
    if (refused !== null) return { ok: false, error: refused };
  }
  // Each field was checked above; the casts only narrow what the checks proved.
  return {
    ok: true,
    handoff: {
      next_skill: next_skill as string,
      next_epic: next_epic as string | null,
      next_story: next_story as string | null,
      branch: branch as string,
      files: files as string[],
      note,
    },
  };
}

/** Write the handoff block of specs/state.yaml under the repository `root`:
 * the caller's checked fields, written_at from `now` (UTC, to the second) and
 * uncommitted from git status, sorted, without the state file itself. A refused
 * input, or a repository git cannot read, writes nothing. */
export async function writeHandoff(root: string, input: unknown, now: Date = new Date()): Promise<WriteField> {
  const checked = checkHandoff(root, input);
  if (!checked.ok) return checked;
  const status = await uncommittedPaths(root);
  if (!status.ok) return { ok: false, error: `git status failed: ${status.error}` };
  const { next_skill, next_story, next_epic, branch, files, note } = checked.handoff;
  return writeStateMapping(root, stateFile, 'handoff', {
    next_skill,
    next_story,
    next_epic,
    branch,
    written_at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    files,
    // Sorted, so the same tree gives the same block whatever order git uses.
    uncommitted: status.paths.filter((path) => path !== stateFile).sort(),
    note,
  });
}
