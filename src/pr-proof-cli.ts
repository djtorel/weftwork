// story: e11s02
// Thin shell for the PR proof: JSON `{"command": "...", "transcript": "..."}`
// on stdin, the proof block on stdout. It reads the ledger, fingerprints the
// tree and sums the tokens in the optional session transcript; it never runs
// the command and never writes. Logic lives in pr-proof.ts.
//
// Exit 0 ready (open the PR for review), 1 draft (write the handoff and open
// a draft), 2 when it cannot run (bad input, no git working tree, a ledger
// it cannot read), with the reason on stderr and nothing on stdout.
import { terminalSafe, readJsonObject } from './cli-io.ts';
import { ledgerPath, ledgerReadCap, readLedgerTail } from './ledger.ts';
import { prProof } from './pr-proof.ts';
import { readTranscriptUsage, type TokenRead } from './transcript-usage.ts';
import { fingerprintTree } from './tree.ts';

function fail(error: string): void {
  process.stderr.write(`pr-proof: ${terminalSafe(error)}\n`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const read = await readJsonObject();
  if (read.kind === 'refused') return fail(read.error);
  const command = read.input['command'];
  if (typeof command !== 'string' || command.trim() === '') return fail('"command" must be a non-empty string');
  const transcript = read.input['transcript'];
  if (transcript !== undefined && typeof transcript !== 'string') return fail('"transcript" must be a string');
  const tree = await fingerprintTree(process.cwd());
  if (!tree.ok) return fail(`no git working tree: ${tree.error}`);
  const path = await ledgerPath(process.cwd());
  if (path === null) return fail('no git dir for the ledger');
  const ledger = await readLedgerTail(path, ledgerReadCap);
  if (!ledger.ok) return fail(`the ledger cannot be read: ${ledger.error}`);
  // A report, as in the Stop hook: a transcript that cannot be read gives a
  // reason on the budget line, never a different verdict or exit. "" is what
  // the weft-ready skill passes when it finds no transcript.
  const tokens: TokenRead =
    transcript === undefined || transcript === ''
      ? { ok: false, error: 'no transcript given' }
      : readTranscriptUsage(transcript);
  const proof = prProof({ entries: ledger.entries, states: ledger.states, command, fingerprint: tree.fingerprint, tokens });
  process.stdout.write(proof.text);
  process.exitCode = proof.ready ? 0 : 1;
}

await main();
