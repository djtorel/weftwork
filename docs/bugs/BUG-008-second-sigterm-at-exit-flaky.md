---
bug_id: BUG-008
status: fixed
severity: medium
scope: src/claude-hook-cli.ts (signal handling at exit), test AC-e07s02-13
title: a second SIGTERM right after the first once ended the hook by signal
fixed_in: fix-bug-008-second-sigterm
---

# BUG-008: a second SIGTERM right after the first once ended the hook by signal

Found by verify-work for e09s01 on 2026-11-14, on branch
e09s01-budget-setting at 9ca599a. Not reproduced since. Logged on the
owner's decision (answer to a verify-work question, recommended option):
record it outside e09s01 and go on.

## Symptom

One full Preflight run (`npm test`, 733 tests, 2026-11-14T18:24Z) failed
one test:

```
test at src/claude-hook-cli.signal.test.ts:121:1
✖ AC-e07s02-13 a second signal right after the first still ends in exit 2
  AssertionError: a second SIGTERM must not fall back to the default action
  null !== 2
```

The test starts the hook with a 60 s sleep as the command, waits until
the command runs, sends SIGTERM, waits 5 ms and sends SIGTERM again.
`status` null means the process ended by a signal, not by an exit code.
The host reads that as "go ahead", so this is a fail-open path (T7).

## More evidence: it failed on main CI twice (2026-11-14)

The first note said "not reproduced". CI has since hit it twice, on
`main`, with the same error (`null !== 2`):

| Run | Commit | Result |
| --- | --- | --- |
| 43623813256 | `docs(specs): slice e09 into four stories (#59)`, 17:56Z | 682 of 683 pass, this test fails |
| 43642367057 | `feat(engine): ... counted ceiling (e09s02) (#61)`, 21:21Z | 817 of 818 pass, this test fails |

Both commits changed only specs or code that the test does not touch, so
the failure comes from the timing of the test, not from the change. The
local runs passed because they were not slow enough to hit it.

## Reproduction attempts (all passed)

| Where | How | Runs | Failed |
| --- | --- | --- | --- |
| branch at 9ca599a | the test alone | 30 | 0 |
| main at 052c656 | the test alone | 30 | 0 |
| branch | 8 copies at once, 6 rounds | 48 | 0 |
| main | 8 copies at once, 6 rounds | 48 | 0 |
| branch | full suite | 4 | 0 |
| main | full suite | 4 | 0 |
| branch | full Preflight, the next single run | 1 | 0 |

## Root cause (confirmed, 2026-11-14)

The answer was written with `process.stdout.write` and
`process.stderr.write`, then `process.exitCode` was set and the event loop
was left to end. When the loop ends Node shuts down, and during that
stretch it takes its signal handlers away. A SIGTERM that arrives then gets
the default action, so the process ends by signal (status null). The host
reads a signal death as "go ahead", so this is a fail-open path (T7).

Reproduction, on the code before the fix, with a throwaway script (the
hook runs a 60 s sleep, gets SIGTERM, then a second SIGTERM):

| Second SIGTERM sent | Hook ended by SIGTERM |
| --- | --- |
| 0 to 5 ms after the first | 0 of 25 at each delay |
| 6 ms | 1 of 25 |
| 8 ms | 20 of 25 |
| 10 ms | 25 of 25 |
| 15 ms or later | 0 of 25 (the process had already ended) |
| when the block text arrives on stderr | 60 of 60 |

So the window is real and about 4 to 5 ms wide on this machine. The old
test sent its second signal after 5 ms, which sits at the edge of the
window: it passed on a fast machine and failed on a slow CI runner.

## Suspected cause (before the probes)

The handlers are installed with `process.on`, so a second signal while the
hook works reaches `terminate`, not the default action. After the first
SIGTERM the engine aborts, `run` returns `terminated()`, and the CLI sets
`process.exitCode` and lets the event loop end. If the second SIGTERM
lands while Node tears the process down, after the signal watchers are
closed, the default action ends the process by signal. That window does
not depend on e09s01: the budget read happens before `runEngine`, and the
signals in this test arrive after the command started.

## Fix

The first idea was right, and it applies to every answer, not only the
signal path. `src/claude-hook-cli.ts` now ends with
`leave(await failClosed(...))`. `leave` writes the answer with `writeSync`
and calls `process.exit` at once, so no signal can arrive while Node shuts
down. The second idea (let the test tolerate a late signal) was refused:
the host would read the signal death as "go ahead", so the hook must not
allow it.

## Verification

- New test `BUG-008 a signal right after the block is written still ends
  in exit 2` (src/claude-hook-cli.signal.test.ts). It sends the second
  SIGTERM when the block text reaches stderr, 5 rounds. Before the fix it
  failed in round 1 (`null !== 2`); after the fix it passes.
- The same probes after the fix: 400 of 400 runs ended in exit 2, across
  delays of 0 to 14 ms and the stderr-event trigger.
- Preflight: 819 of 819 tests. The hook CLI test files, 8 repeats and
  then 24 runs in parallel (8 at a time): 0 failures.
- The old test `AC-e07s02-13 a second signal right after the first ...`
  stays as it was.
