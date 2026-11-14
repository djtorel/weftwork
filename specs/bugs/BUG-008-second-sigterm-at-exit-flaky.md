---
bug_id: BUG-008
status: open
severity: low
scope: src/claude-hook-cli.ts (signal handling at exit), test AC-e07s02-13
title: a second SIGTERM right after the first once ended the hook by signal
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

## Suspected cause (not confirmed)

The handlers are installed with `process.on`, so a second signal while the
hook works reaches `terminate`, not the default action. After the first
SIGTERM the engine aborts, `run` returns `terminated()`, and the CLI sets
`process.exitCode` and lets the event loop end. If the second SIGTERM
lands while Node tears the process down, after the signal watchers are
closed, the default action ends the process by signal. That window does
not depend on e09s01: the budget read happens before `runEngine`, and the
signals in this test arrive after the command started.

## Fix ideas, for investigate-bug

- On the first signal, leave through `leave(terminated())`
  (`process.exit`) once the engine has aborted, instead of letting the
  event loop end, so the exit is one synchronous step.
- Or make the test tolerate a second signal that arrives after the
  output was written, if the host's reading of that case allows it.

Neither is decided. Run investigate-bug first.
