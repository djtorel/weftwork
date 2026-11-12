---
bug_id: BUG-007
status: fixed
severity: high
scope: src/ledger.ts (the ledger opens) and src/tree.ts (hashFile)
title: a FIFO where the engine opens a file hangs it, so the Stop hook fails open
---

# BUG-007: a FIFO where the engine opens a file hangs the engine and the hook

Found by the dual-blind review of e07s02 (reviewer B, finding B1,
2026-11-12) and reproduced here. Review round 2 found the same class in
`tree.ts` (see "Second site" below). Related: threat model T3 (the agent can
edit `.git/weftwork/`), T6 (hang and orphan processes), T7 (fail-open).
`src/override.ts` already guards the same case for `override.json`.

## Symptom

In a repository whose `.git/weftwork/ledger.jsonl` is a FIFO, the hook
(`node src/claude-hook-cli.ts -- true`) did not answer. It was still alive
12 s after a normal run would have ended, and it stays until something
opens the other end of the FIFO or the host kills it. The host's timeout
cancels the hook and drops its output, so the stop goes ahead.

## Cause

`ledger.ts` opened the ledger path in three places with flags that block on
a FIFO: `readLedgerTail` (`open(path, 'r')`, line 220), `readLedger`
(`readFile`, line 185) and `writeLine` (`appendFile`, line 88). Opening a
FIFO for reading blocks until a writer exists, and for writing until a
reader exists. The call runs in a libuv thread pool thread, which nothing
can abort. A process stuck this way cannot be ended with `process.exit`
either: Node's shutdown waits for the thread (measured: `process.exit(2)`
and `process.reallyExit(2)` both ran until killed, in a probe that
opened a FIFO). Only SIGKILL ends it, and the host reads that as
non-blocking. So no timer in the hook can turn this hang into exit 2.

## Second site: tree.ts hashFile (review round 2)

The fingerprint lists files with git, calls `lstat` on each, and for a regular
file opens it with `createReadStream`, which blocks on a FIFO. Between the
`lstat` and the open, a process the agent left running can swap a listed file
for a FIFO. `hashFile` then hangs in the same thread pool call, and the hook
with it. The race is narrow; a reviewer tried 3000 swaps against 300
fingerprints and did not hit it. The hang itself is certain once a FIFO is
reached (the test below hangs on the old code), so it is fixed, not documented.

## Impact

An agent that can write under `.git/` (T3) replaces the ledger with a FIFO
(`mkfifo .git/weftwork/ledger.jsonl`) and the done gate never answers. The
stop goes ahead after the host's timeout, with no block. The e06 engine
CLI has the same hang, with no host timeout at all.

## Fix

`openRegular` in `src/ledger.ts` opens with `O_NONBLOCK`, so an open on a
FIFO returns at once (or fails with ENXIO for a write with no reader), then
checks `handle.stat().isFile()` and refuses anything else. All three sites
use it. The answer for a ledger that cannot be used is the existing one: the
read or write is not ok, and the engine reports `no-ledger`, which the hook
maps to exit 2 ("could not check"). The pattern is the one `override.ts`
already uses. Symlink behaviour of the ledger is unchanged on purpose
(finding F1 of the e06s03 review is a separate item).

`hashFile` in `src/tree.ts` opens with `O_RDONLY | O_NONBLOCK | O_NOFOLLOW`,
looks again at the open file with `fstat`, and throws if it is no longer a
regular file, so the fingerprint is not ok and the gate answers `no-tree`
(exit 2, "could not check"). Fingerprints of regular files are unchanged
(the existing tree tests pass). `O_NOFOLLOW` is safe here because `lstat` has
already said the entry is not a link: a link at hash time means a swap. The
function is exported so its test can call it on a FIFO directly.

## Not fixed here: stuck git processes outlive the hook

Review found that when the hook leaves at its deadline while a `git` child is
stuck, that child stays alive: the engine's `execFile` calls for git in
`tree.ts` and `ledger.ts` take no abort signal or timeout. Ways to get git
stuck: `.git/index` or `.git/HEAD` replaced by a FIFO (two reviewers), and,
needing no write under `.git/` at all, a FIFO named `.gitignore` in the working
tree (checked: `git ls-files --exclude-standard` hangs on it with git 2.56.1;
a FIFO named `.gitattributes` did not hang that command). The hook still
exits 2 at its 645 s deadline, so this is not fail-open, but every Stop
attempt then costs the full deadline and leaves one stuck process (threat
model T6). An agent that can create files can start background processes of
its own, so the orphan is not a new capability; the 645 s delay per attempt is
the cost to the owner. Passing the abort signal to the git
calls is an e06 change for its own story; the security review records it as a
residual.

## Not part of this bug

The e07s02 review (reviewer B, B11) also says a run ended by a signal
counts toward the failure ceiling. That is not verified, and it changes
engine semantics, so it is the owner's decision (e06). Recorded here so it
is not lost.

## Verify

`node --test src/ledger.fifo.test.ts src/tree.fifo.test.ts` (each FIFO case
runs in a child process that is killed after 8 s, so a regression fails the
test instead of hanging the runner), then the full Preflight. Removing
`O_NONBLOCK`, `O_NOFOLLOW` or the `isFile` check from `hashFile`, or the
`isFile` check from `openRegular`, each fails a test.
