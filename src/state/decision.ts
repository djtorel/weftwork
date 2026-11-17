// story: e11s04
// The decision log (docs/ASK.md): a choice the agent makes without the owner
// is one JSON line in `<git dir>/weftwork/decisions.jsonl`, with the branch it
// was made on, and the PR's Decisions section lists the branch's lines. The
// file is in the engine's folder, so the guard blocks a tool call that writes
// it; decision-cli.ts writes it from its own process. Lines are written and
// read as the ledger's are (ledger.ts): one write per line, a regular file
// only, the last 1 MiB read, a line that is not a decision skipped.
import { constants } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { isMissing, messageOf } from '../shared/errors.ts';
import { terminalSafe } from '../shared/cli-io.ts';
import { isRecord } from '../shared/json.ts';
import { ignoreCloseError, ledgerReadCap, openRegular, tailText, writeLine, type AppendResult } from '../engine/ledger.ts';

/** What the agent says: the question it did not ask, its choice and why. */
export type Decision = { question: string; choice: string; reason: string };

/** One logged decision. */
export type DecisionEntry = Decision & { at: string; branch: string };

/** The longest text a field may hold, so a line stays a line in a PR body. */
export const maxDecisionChars = 500;

const fields = ['question', 'choice', 'reason'] as const;

/** The decision in `input`, or why it is not one. */
export function toDecision(input: Record<string, unknown>): { ok: true; decision: Decision } | { ok: false; error: string } {
  for (const key of fields) {
    const value = input[key];
    if (typeof value !== 'string' || value.trim() === '') return { ok: false, error: `"${key}" must be a non-empty string` };
    if (value.length > maxDecisionChars) return { ok: false, error: `"${key}" must be at most ${maxDecisionChars} characters` };
  }
  return { ok: true, decision: { question: input.question as string, choice: input.choice as string, reason: input.reason as string } };
}

function toEntry(data: unknown): DecisionEntry | null {
  if (!isRecord(data) || typeof data.at !== 'string' || typeof data.branch !== 'string') return null;
  const decision = toDecision(data);
  return decision.ok ? { at: data.at, branch: data.branch, ...decision.decision } : null;
}

/** Append one decision. Never throws. */
export async function appendDecision(path: string, entry: Decision & { branch: string }, at: Date): Promise<AppendResult> {
  return writeLine(path, { at: at.toISOString(), ...entry });
}

/** Every decision in the last 1 MiB of the file, oldest first. A missing file
 * has none. Never throws. */
export async function readDecisions(
  path: string,
): Promise<{ ok: true; decisions: DecisionEntry[]; truncated: boolean } | { ok: false; error: string }> {
  let handle: FileHandle | undefined;
  try {
    handle = await openRegular(path, constants.O_RDONLY);
    const { text, truncated } = await tailText(handle, ledgerReadCap);
    const decisions = text.split('\n').flatMap((line) => {
      try {
        const entry = toEntry(JSON.parse(line));
        return entry === null ? [] : [entry];
      } catch {
        return [];
      }
    });
    return { ok: true, decisions, truncated };
  } catch (error) {
    return isMissing(error) ? { ok: true, decisions: [], truncated: false } : { ok: false, error: messageOf(error) };
  } finally {
    await handle?.close().catch(ignoreCloseError);
  }
}

const oneLine = (text: string) => terminalSafe(text.trim().replace(/\s+/g, ' '));

/** The PR's Decisions section: one line per decision, or None, and a note
 * when the log was cut to its last 1 MiB (review round 1). */
export function decisionsText(decisions: DecisionEntry[], truncated = false): string {
  const line = (d: DecisionEntry) =>
    `- ${oneLine(d.question)} Choice: ${oneLine(d.choice).replace(/\.$/, '')}. Reason: ${oneLine(d.reason)}`;
  const body = decisions.length === 0 ? 'None\n' : `${decisions.map(line).join('\n')}\n`;
  return truncated ? `${body}(older decisions were left out: the log is over 1 MiB)\n` : body;
}
