// story: e07s01, e09s04
// The Stop hook's reuse of its own pass (backlog follow-up of PR #95): a stop
// on a tree that the hook already saw pass does not run the command again.
// The rule is the PR proof's ready (pr-proof.ts), so the two cannot drift:
// the last run of the exact command string is done, no stop state but done
// follows it, and it saw the tree as it is now. On top of that the pass must
// be one the Stop hook ran in the same directory (`hookDir`). A pass from the
// engine CLI is never reused: the agent chooses its environment and its
// `cwd`, so it could pass where the hook would not. Any doubt (no ledger, a
// read or fingerprint error, a cut tail without the run) gives null, and the
// engine runs the command as before.
//
// SECURITY: this reads the ledger, which the agent can write (T3). A forged
// line with the right fingerprint and `hookDir` allows a stop without a run,
// so the stop is as strong as the guard that protects the ledger
// (docs/GUARD.md), the same as the PR proof (docs/PR-PROOF.md).
import { ledgerReadCap, readLedgerTail, type LedgerEntry } from './ledger.ts';
import { prProof } from './pr-proof.ts';
import { fingerprintTree } from './tree.ts';

/** The Stop hook's pass of `command` in `dir` on the tree as it is now, or
 * null when there is none or anything is in doubt. Never rejects. */
export async function reusablePass(path: string | null, command: string, dir: string): Promise<LedgerEntry | null> {
  if (path === null) return null;
  const tree = await fingerprintTree(dir);
  if (!tree.ok) return null;
  const read = await readLedgerTail(path, ledgerReadCap);
  if (!read.ok) return null;
  const proof = prProof({ entries: read.entries, states: read.states, command, fingerprint: tree.fingerprint });
  const last = read.entries.findLast((entry) => entry.command === command);
  return proof.ready && last?.hookDir === dir ? last : null;
}
