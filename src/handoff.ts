// story: e08s03
// The handoff block of specs/state.yaml, written by the engine for a session
// that remembers nothing (R12). The caller gives what only it knows: the next
// skill, the note, the branch to start on and the files the note names. The
// engine adds what it can measure itself, when it wrote the block and which
// paths were uncommitted then, so e08s04 can check the block at resume and the
// agent cannot get those facts wrong. No commit hash is kept: PRs are
// squash-merged, so a branch hash does not exist on main (owner decision 3).
import { lstatSync } from 'node:fs';
import { isAbsolute, posix } from 'node:path';
import type { Failure } from './errors.ts';
import { isRecord } from './json.ts';
import { stateFile, valueProblem } from './state-fields.ts';
import { writeStateMapping } from './state-mapping.ts';
import type { WriteField } from './state-file.ts';
import { insideRoot, type Unresolved } from './state-write.ts';
import { uncommittedPaths } from './tree.ts';

/** The longest note, in code points (owner decision 2). */
export const maxNoteLength = 4000;

/** The part of the block the caller gives. */
type HandoffInput = {
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

/** Why `value` cannot be the one-line field `key`, or null: the state-field
 * rule (one line, 200 code points), and not empty; null only when `nullable`. */
function lineProblem(key: string, value: unknown, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string') return `${key} must be text${nullable ? ' or null' : ''}`;
  if (value.trim() === '') return `${key} must not be empty or only whitespace`;
  const problem = valueProblem(value);
  return problem === null ? null : `${key} ${problem}`;
}

/** The refusal for a `files` path that insideRoot refused: a missing folder is
 * a missing file, any other resolve error is named without its OS text. */
function insideProblem(file: string, failure: Failure | Unresolved): string {
  if (!('cause' in failure)) return `files: ${failure.error}`;
  if (failure.cause === 'outside') return `files: ${file} is outside the repository`;
  return failure.cause === 'missing' ? `files: ${file} does not exist in the repository` : `files: ${file} cannot be resolved`;
}

/** Why the path `file` cannot be named in the handoff, or null: it must be a
 * relative path of one line, in normal form, inside the repository at `root`,
 * and exist. Normal form (no `.`, `..`, `//` or trailing `/`) keeps one
 * spelling per file, so e08s04 compares names, not spellings (review round 1,
 * A3, A4, B3, B5). A symlink is a name in the repository: lstat sees it and it
 * is never followed, so a dangling one counts as there. */
function fileProblem(root: string, file: unknown): string | null {
  if (typeof file !== 'string' || file === '') return 'files must hold only non-empty text';
  if (/[\n\r]/.test(file)) return `files: ${JSON.stringify(file)} must be one line`;
  if (isAbsolute(file)) return `files: ${file} must be a path relative to the repository root`;
  const normal = posix.normalize(file).replace(/\/$/, '');
  if (normal !== file) return `files: ${file} must be written as ${normal}`;
  const inside = insideRoot(root, file);
  // A missing folder is a missing file to the caller, not a realpath error
  // (request-review round 2, A6; round 3, A3, B5).
  if (!inside.ok) return insideProblem(file, inside);
  try {
    lstatSync(inside.path);
  } catch {
    return `files: ${file} does not exist in the repository`;
  }
  return null;
}

/** The caller's fields with the defaults applied once: a missing next_epic or
 * next_story is null, a missing files is an empty list (request-review round
 * 3, A5). A files that is present stays as sent, so null is refused. */
function withDefaults(input: Record<string, unknown>): Record<keyof HandoffInput, unknown> {
  const { next_skill, branch, note } = input;
  const files = input['files'] === undefined ? [] : input['files'];
  return { next_skill, branch, note, files, next_epic: input['next_epic'] ?? null, next_story: input['next_story'] ?? null };
}

/** The first reason `fields` cannot be a handoff, or null: a bad one-line
 * field, a bad note, or a bad file list. */
function fieldProblem(root: string, fields: Record<keyof HandoffInput, unknown>): string | null {
  return (
    lineProblem('next_skill', fields.next_skill, false) ??
    lineProblem('branch', fields.branch, false) ??
    lineProblem('next_epic', fields.next_epic, true) ??
    lineProblem('next_story', fields.next_story, true) ??
    noteProblem(fields.note) ??
    filesProblem(root, fields.files)
  );
}

/** Why `note` cannot be the note, or null. */
function noteProblem(note: unknown): string | null {
  if (typeof note !== 'string' || note.trim() === '') return 'note must be text that is not empty or only whitespace';
  if ([...note].length > maxNoteLength) return `note must be ${maxNoteLength} characters or fewer`;
  return null;
}

/** Why `files` cannot be the list of paths, or null. */
function filesProblem(root: string, files: unknown): string | null {
  if (!Array.isArray(files)) return 'files must be a list of paths';
  for (const file of files) {
    const refused = fileProblem(root, file);
    if (refused !== null) return refused;
  }
  // After the checks, so `[1, 1]` is a type error (round 5, B5); one pass with
  // a set, as indexOf in a loop is quadratic (round 4, A11, B3).
  const seen = new Set<unknown>();
  const twice = files.find((file) => seen.size === seen.add(file).size);
  return twice === undefined ? null : `files: ${JSON.stringify(twice)} is named more than once`;
}

/** The caller's part of the handoff, or a failure that names the field. */
export function checkHandoff(root: string, input: unknown): { ok: true; handoff: HandoffInput } | Failure {
  if (!isRecord(input)) return { ok: false, error: 'the handoff must be a JSON object' };
  const unknown = Object.keys(input).filter((key) => !callerKeys.has(key) && !engineKeys.has(key));
  if (unknown.length > 0) return { ok: false, error: `the handoff has no key ${unknown.join(', ')}` };
  const fields = withDefaults(input);
  const problem = fieldProblem(root, fields);
  if (problem !== null) return { ok: false, error: problem };
  // fieldProblem checked every field; the cast only narrows what it proved.
  return { ok: true, handoff: fields as HandoffInput };
}

/** Write the handoff block of specs/state.yaml under the repository `root`:
 * the caller's checked fields, written_at from `now` (UTC, to the second) and
 * uncommitted from git status, sorted, without the state file itself. A refused
 * input, or a repository git cannot read, writes nothing. */
export async function writeHandoff(root: string, input: unknown, now: Date = new Date()): Promise<WriteField> {
  const checked = checkHandoff(root, input);
  if (!checked.ok) return checked;
  const status = await uncommittedPaths(root, [stateFile]);
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
    uncommitted: [...status.paths].sort(),
    note,
  });
}
