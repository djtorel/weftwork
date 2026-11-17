// story: e07s01, e09s04
// The Stop hook's reuse of its own pass (backlog follow-up of PR #95): a stop
// on a tree that the hook already saw pass does not run the command again.
// The rule is the PR proof's ready (pr-proof.ts), so the two cannot drift:
// the last run of the exact command string is done, no stop state but done
// follows it, and it saw the tree as it is now. On top of that the pass must
// carry the same run key: a hash of the directory and the whole environment
// the hook ran it in. A pass from the engine CLI has no key and is never
// reused. The agent can also start the hook CLI itself, with a PATH that puts
// a fake check first (review round 1, r1m1); its environment then differs,
// so its key does too. Any doubt (no ledger, a read or fingerprint error, a
// cut tail without the run) gives null, and the engine runs the command.
//
// SECURITY: this reads the ledger, which the agent can write (T3). A forged
// line with the right fingerprint and key, or a hook call with the host's
// exact environment rebuilt on purpose, allows a stop without a run, so the
// stop is as strong as the guard that protects the ledger (docs/GUARD.md),
// the same as the PR proof (docs/PR-PROOF.md). The key is a SHA-256, so the
// ledger does not store the environment's values (T8).
import { createHash } from 'node:crypto';
import type { GateRequest } from './gate.ts';
import { ledgerReadCap, readLedgerTail, type LedgerEntry } from './ledger.ts';
import { prProof } from '../proof/pr-proof.ts';
import { fingerprintTree } from './tree.ts';

/** The key of a Stop hook run: `dir` and every variable of `env`, in order. */
export function runKey(dir: string, env: NodeJS.ProcessEnv): string {
  const vars = Object.entries(env)
    .filter((pair): pair is [string, string] => pair[1] !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return createHash('sha256').update(JSON.stringify([dir, vars])).digest('hex');
}

/** The Stop hook's pass of the request's command, with run key `key`, on the
 * tree as it is now, or null when there is none or anything is in doubt.
 * Never rejects. */
export async function reusablePass(path: string | null, request: GateRequest, key: string): Promise<LedgerEntry | null> {
  if (path === null) return null;
  const tree = await fingerprintTree(request.cwd);
  if (!tree.ok) return null;
  const read = await readLedgerTail(path, ledgerReadCap);
  if (!read.ok) return null;
  const { command } = request;
  const proof = prProof({ entries: read.entries, states: read.states, command, fingerprint: tree.fingerprint });
  const last = read.entries.findLast((entry) => entry.command === command);
  return proof.ready && last?.hookKey === key ? last : null;
}
