// story: e08s01, e08s03
// The file half of the state writer: it reads a state file under the
// repository root, applies one edit of its text (setField or setMapping) and
// writes the result atomically, only when the text changed. Refusals are
// returned as values; a file that cannot be read, checked or kept is never
// written.
import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isMissing, messageOf, type Failure } from './errors.ts';
import { maxStateBytes, setField, type FieldValue, type SetField, type WriteField } from './state-file.ts';
import { readRegularFile, writeAtomic } from './regular-file.ts';

/** Why insideRoot could not resolve a path: a folder on it does not exist, or
 * another error (a symlink loop, a file used as a folder, no permission). A
 * caller reports these without the OS text, which holds absolute paths
 * (request-review round 3, A3, B5; round 4, A14). `outside` is a path that
 * resolves outside the root; its message holds the root (round 5, A3, B4). */
export type Unresolved = Failure & { cause: 'missing' | 'unresolvable' | 'outside' };

/** The failure for a path that realpath cannot resolve. */
function unresolvedFailure(file: string, error: unknown): Unresolved {
  const cause = isMissing(error) ? 'missing' : 'unresolvable';
  return { ok: false, error: `${file} cannot be resolved: ${messageOf(error)}`, cause };
}

/** The real path `file` names, when it lies inside `root` and outside `.git`:
 * `file` is resolved against `root`, and its directory after resolving
 * symlinks must be `root` or below it. The file name itself is not resolved:
 * readRegularFile refuses a symlink there. */
export function insideRoot(root: string, file: string): { ok: true; path: string } | Failure | Unresolved {
  try {
    const realRoot = realpathSync(root);
    const target = resolve(realRoot, file);
    if (target === realRoot) return { ok: false, error: `${file} names the repository root, not a file` };
    const parent = realpathSync(dirname(target));
    const rel = relative(realRoot, parent);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      return { ok: false, error: `${file} is outside the repository root ${realRoot}`, cause: 'outside' };
    }
    const path = join(parent, basename(target));
    // A case-insensitive disk (macOS by default) reads .GIT as .git (review 4, A2).
    if (relative(realRoot, path).split(sep).some((segment) => segment.toLowerCase() === '.git')) {
      return { ok: false, error: `${file} is inside .git, which the engine does not edit` };
    }
    return { ok: true, path };
  } catch (error) {
    return unresolvedFailure(file, error);
  }
}

/** Set the scalar at `path` in the state file `file` (named from `root`) to
 * `value`, keeping every other byte. The file must be a regular file inside
 * the repository root and outside `.git`, not a symlink, of at most
 * maxStateBytes. It is written through a temp file and a rename with its old
 * mode, and only when the text changes. A file that cannot be read, parsed or
 * checked is never written. */
export function writeStateField(root: string, file: string, path: readonly string[], value: FieldValue): WriteField {
  return writeStateEdit(root, file, (text) => setField(text, path, value));
}

/** Read the state file `file` under `root`, apply `edit`, and write the result
 * when the text changes; the shared body of writeStateField and
 * writeStateMapping. */
export function writeStateEdit(root: string, file: string, edit: (text: string) => SetField): WriteField {
  const inside = insideRoot(root, file);
  if (!inside.ok) return inside;
  const read = readRegularFile(inside.path, { follow: false, maxBytes: maxStateBytes });
  if (!read.ok) return read;
  if (read.file === null) return { ok: false, error: `${file} does not exist` };
  const result = edit(read.file.text);
  if (!result.ok) return { ok: false, error: `${file}: ${result.error}` };
  // A lone surrogate is written to disk as U+FFFD, so the file would not hold
  // the text that was checked (review round 1). Defence in depth only:
  // setField and setMapping already refuse or skip such text, so no input
  // reaches this today.
  if (!result.text.isWellFormed()) return { ok: false, error: `${file}: the new text holds a lone surrogate, which UTF-8 cannot store` };
  if (result.text === read.file.text) return { ok: true, action: 'unchanged', file };
  if (Buffer.byteLength(result.text) > maxStateBytes) {
    return { ok: false, error: `${file}: the new text would be larger than ${maxStateBytes} bytes, which the writer could not read again` };
  }
  const failed = writeAtomic(inside.path, result.text, read.file.mode);
  return failed ?? { ok: true, action: 'written', file };
}
