// story: e06s05
// How the file readers read an error: the text of it, and whether it means
// "no such file". Shared by ledger.ts and override.ts, so each reads a missing
// file the same way and neither copies the other.

/** The message of an error, or the text of anything else that was thrown. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True when the error is "no such file" (ENOENT). */
export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
