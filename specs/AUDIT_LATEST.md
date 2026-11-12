# Audit (latest)

Story: e07s02
Branch: e07s02-fail-closed-faults
Diff: git diff main -- src specs, plus the uncommitted changes below (the eight
  story commits are on the branch; the audit fixes, the review fixes of rounds
  1 to 3 and the BUG-007 fix are uncommitted until their commits)
Mode: default (full checklist), re-run after review rounds 1 to 3
Churn: bp-churn-rank.sh ranked spec and state files first (state.yaml and
  execution-status.yaml, 43 commits each). The adapter files date from e07s01
  and have almost no churn; every changed file was read in full.
Result: PASS (no deviation; items left as "consider" are listed at the end)

VERDICT: PASS

## What the audit found and fixed

The first pass (before review) failed these items. Each is fixed.

1. **Function length (limit 20).** Five functions were over the limit; `main`
   has none. The stdin reader (48 lines) is now `collect`, `deadlineAfter`
   and `readHookInput`; the failed-reason lines are a `Record<Reason,
   string>` table (a missing reason is a type error); the CLI's `run` moved
   its input check to `refusedInput`; a test helper and a test body were
   split. Measured by indentation, with a script I checked on `main`'s
   `hookAnswer` first (see Red flags).
2. **One behaviour change, on purpose.** A stream closed before it ended
   now reads "input could not be read: Premature close" (Node's own text)
   instead of a custom line. It still blocks with exit 2. The test asserts
   `could not be read` and that the stream is destroyed.
3. **Duplication (G5).** The error-to-text expression was copied in the
   adapter; it now uses `messageOf` from `src/errors.ts` (found again by
   review round 2, see below).
4. **Law of Demeter.** A test chained `child.stdout.setEncoding().on()`;
   `textOf` takes the stream as its argument.
5. **Names.** The test helper `closed` is now `waitForClose`.

## Review round 1 (2026-11-12)

Dual-blind review, round 1 of 5: Reviewer A 86.7 (no must-fix, four
should-fix), Reviewer B 87.9 (one must-fix, three should-fix). AND-gate FAIL.
Each finding was checked against the code before it was fixed.

- **B1, must-fix, reproduced by me: a FIFO in place of the ledger hangs the
  hook.** The fix is BUG-007 (specs/bugs/BUG-007-ledger-fifo-hangs-the-hook.md):
  `openRegular` in `src/ledger.ts` opens with `O_NONBLOCK` and refuses
  anything but a regular file, at all three open sites (the append site had
  never been probed). The reviewer's suggested fix (a timer that calls
  `process.exit(2)`) does not work: I measured `process.exit` and
  `process.reallyExit` in a process stuck opening a FIFO, and both hang until
  killed. So the root cause had to be fixed, which the owner chose ("1") over
  waiving it or running the engine in a child.
- **A3 and B2, a second SIGTERM exited 143 (fail-open).** The handlers use
  `process.on`. A test sends two signals 5 ms apart.
- **B3 and A4/B5, the hook could outlive the host's timeout.** The CLI has a
  whole-hook deadline (`hookDeadlineMs`, 645 s from the start) and a 2 s grace
  timer after a signal. Both leave with exit 2. The "60 s margin" comment was
  wrong (about 50 s, unenforced) and is rewritten. `WEFTWORK_HOOK_DEADLINE_MS`
  can only shorten the deadline.
- **A6, errors outside the awaited chain exited 1.** `uncaughtException` and
  `unhandledRejection` now block with exit 2 (`faultOutput`).
- **A1, A2/B4, B6, B9, tests that could not fail or did not match their
  name.** Rebuilt.
- **A5/B7, A7/B8, B10.** The header lists a signal before the handlers are
  installed; the `no-ledger` line says the passing run could not be recorded;
  the `timeout` line names the 600 s limit; a comment explains why
  `engineTimeoutMs` repeats `defaultTimeoutMs`.
- **B6 turned out to be right in a way the reviewer did not say.** My
  `stream.on('error', () => {})` line was dead code: Node's async iterator
  already leaves an error listener on the stream. I removed it and kept the
  test, which pins the real behaviour.
- **Declined or left to the owner.** B13 (move `refusedInput` into the
  library): the spec and e07s01 put this sequencing in the CLI. B11 (a
  signal-killed run counts toward the failure ceiling): not verified, an
  engine decision for e06; recorded in BUG-007.

## Review round 2 (2026-11-12)

Round 2 of 5, two fresh reviewers: Reviewer A 78.6 (no must-fix, three
should-fix), Reviewer B 84.2 (no must-fix, three should-fix). AND-gate FAIL.
Both confirmed that the round 1 hang class is closed for the ledger. Each
finding was checked before it was fixed.

- **B1, `tree.ts` `hashFile` can hang the same way after a swap.** Confirmed
  by reading: `lstat` says regular file, then `createReadStream` opens it with
  a blocking open. The race is narrow (the reviewer's 3000 swaps did not hit
  it), but the hang is certain once a FIFO is reached, and the same fix
  applies. `hashFile` opens with `O_RDONLY | O_NONBLOCK | O_NOFOLLOW`, checks
  `fstat`, and a file that is no longer regular makes the fingerprint not ok.
  I widened BUG-007 to cover it and exported `hashFile` for its test. It is a
  second change in an e06 module; the fingerprint of a regular file is
  unchanged (the tree tests pass).
- **A1 and B3, no test raised an uncaught error in the real process.** A
  mutant that dropped `controller.abort()` from `fault` survived all tests.
  AC-e07s02-14 now preloads a module (`NODE_OPTIONS=--import`, no test seam in
  the CLI) that throws, or rejects, 2.5 s in while a command runs, and asserts
  exit 2, "adapter fault" and that the command is gone.
- **A3, the "mutated to prove they fail" claim was too broad.** It was: the
  `isFile` check was covered only for reads (a write open on a FIFO with no
  reader fails with ENXIO first, and a directory fails with EISDIR first). A
  test now holds a reader on the FIFO so the write open succeeds, and only the
  check refuses it. The claim below lists the mutants I actually ran.
- **A2 and B6, stuck `git` processes outlive the hook.** Confirmed by
  reviewer A. The engine's git calls take no abort signal, so a stuck git
  stays after the hook exits 2. Not fail-open, and an agent can already start
  background processes, so I documented it (BUG-007, the security addendum)
  instead of changing the engine's git calls in this story. It is the one
  residual that would deserve an e06 story.
- **B2, `errorMessage` duplicated `messageOf`.** Fixed: the adapter imports
  `messageOf`.
- **B4, timing in "SIGTERM while the CLI waits for input".** The bound is now
  three quarters of the grace period (1.5 s) instead of half. The reviewer's
  readiness signal does not exist: I probed `/proc/<pid>/status`, and Node
  already catches SIGINT and SIGTERM by itself, so that bit says nothing about
  our handler. The 1 s wait stays, and the limit is named below.
- **B5, a line count.** ledger.ts is 289 lines, not 288. Numbers below are
  re-measured.

After the changes: Preflight 346 of 346, exit 0 (2026-11-12 22:53:07Z).
Adversarial gate PASS, completeness critic 0 blockers and 0 warnings, blind
spots 0 HIGH.

## Review round 3 (2026-11-12): the AND-gate passes

Round 3 of 5, two fresh reviewers: Reviewer A 95.2 (0 must-fix, 1 should-fix,
4 consider), Reviewer B 100 (0 must-fix, 0 should-fix, 4 consider). Both are at
or above 94 with no must-fix, so the review is complete. Both ran the full
Preflight (346 of 346, exit 0), checked that fingerprints of regular files are
identical to the old code's (0 bytes to 16 MiB of random binary, and a 70 MB
file), found no other open in `src/` that the agent can point at a FIFO, and
ran mutants of their own that are not in the list above (about a dozen between
them), all caught.

What I did with the findings, after checking each:

- **A1, should-fix, reproduced: a thrown value that cannot be printed.**
  `messageOf` called `String(error)`, which throws for an object with no
  prototype or a throwing `toString`. So `failClosed` could reject out of the
  CLI's top-level await (exit 1) and the fault handler could throw (Node's
  exit 7), against the story's claim that every throw becomes exit 2. I had
  listed this as an unlikely path to leave; the reviewer was right that it
  undercuts the claim. Fixed test-first: a test throws both kinds of value
  through `failClosed` (it failed before the fix), and `messageOf` in
  `src/errors.ts` catches the failure and answers "an error that cannot be
  printed". It is a shared e06 helper; behaviour for real errors is unchanged
  (the ledger, override, tree and adapter tests pass).
- **B1, consider, reproduced in part: git blocks on a FIFO in the tree.** A FIFO
  named `.gitignore` hangs `git ls-files --exclude-standard`, and it needs no
  write under `.git/`. I checked it (git 2.56.1). The reviewer also named
  `.gitattributes`; a FIFO of that name did not hang the command, so I left it
  out. The hook still exits 2 at its 645 s deadline, so it stays fail-closed,
  but each Stop attempt then costs the full deadline and leaves a stuck git. The
  residual text in BUG-007 and the security addendum understated how easy this
  is; both now say so. The fix (an abort signal and a timeout on the engine's
  git calls) is an e06 story.
- **B2, consider: SIGHUP and SIGQUIT are not handled.** True; named in the CLI
  header as part of the residual.
- **B4, consider: a stale comment in `tree.ts`** ("never opened"). Reworded.
- **Left alone:** A2 (the 2.5 s fault delay could flake on a very loaded
  machine), A3 (the "open without blocking, check it is a file" block now
  exists in `ledger.ts`, `override.ts` and `tree.ts`; a shared helper would
  touch `override.ts` for no behaviour change), A4 (`readLedger` has no
  production caller), A5 (`leave` can lose the reason line on EAGAIN), B3
  (`inChild` reports a crash and a hang the same way, so its message can
  mislead; the exit status is still right).

After round 3: Preflight 347 of 347, exit 0 (2026-11-12 23:01:29Z); adversarial
gate PASS, critic 0 and 0, blind spots 0 HIGH; manual steps 2 and 3 re-run
(exit 2 each). **The changes after the round 3 pass were not reviewed:** the
`messageOf` guard and its test, one CLI header sentence, one `tree.ts` comment,
and the documents. The owner can ask for a round 4 over them.

## Checklist

- **Supply chain and security: PASS.** No new dependency (package.json is not
  in the diff). No secret in the diff: grep for `sk-`, `ghp_`, `AKIA` and
  `api.github.com` finds nothing. The source files have no `exec`, `spawn`,
  `shell:` or `eval`; the test files start the real CLI, `node` and `mkfifo`
  with fixed arguments in temporary directories. Security scan:
  specs/security/REVIEW.md, e07s02 addendum, updated after rounds 1 and 2.
- **Provenance and metadata: PASS.** The evidence file has `type:` and
  `context:`; BUG-007 has the bug front matter. Every source and test file
  touched carries `// story: e07s02`. Owner decisions are in the spec
  (section 3b) and the tasks file.
- **Law of Demeter: PASS.**
- **CONVENTIONS.md: PASS.** Output is in `specs/` and `src/`. No `gh issue
  create`, no GitHub REST call. The eight commits are Conventional Commits
  with a `Story: e07s02` trailer and no attribution footer. The BUG-007 fix is
  kept in separate files (`ledger.ts`, `tree.ts`, `ledger.fifo.test.ts`,
  `tree.fifo.test.ts`, the bug file) so it can be its own commit, as
  "A reproducible gate failure needs fix-bug, in a separate commit" requires.
- **Scope: PASS with a note.** The story's own files, plus `src/ledger.ts` and
  `src/tree.ts` for BUG-007. Those modules are e06's. The owner chose the
  ledger fix ("1"); the `tree.ts` fix is the same class, found in round 2, and
  I extended BUG-007 to it without a separate question, so the owner can drop
  or split it. Nothing else in the engine changed.
- **Boy Scout: PASS.** No dead code (the redundant error listener and the copy
  of `messageOf` were removed), no commented-out code.
- **Types and safety: PASS.** No explicit `any`, no `@ts-ignore`, no
  `as unknown as`. The one place that meets the library's own `any` (the
  `for await` chunk) goes straight to `Buffer.from` with a comment.
- **Test coverage: PASS.** New functions are tested through their public
  interface (including a value that cannot be printed, thrown through
  `failClosed`): `readHookInput`, `failClosed`, `faultOutput`, `hookDeadline`, the
  constants, the request timeout, a line per reason, the ledger's three entry
  points and `hashFile` (in child processes killed after 8 s, so a regression
  fails instead of hanging the runner). The CLI is tested as a real process:
  both signals, a stdin that never closes, a stub `git` that hangs, a FIFO
  ledger, a run that finishes in time, and an error raised outside the awaited
  chain. **Mutants I ran, on temporary copies, and what caught them:**
  `stdin.destroy()` removed (tightened test), grace timer removed, deadline
  timer removed, timer cancel removed, `on` back to `once`, `O_NONBLOCK`
  removed from the ledger (3 tests), `isFile` removed from the ledger (3
  tests, including the write-with-a-reader case), `abort()` removed from
  `fault`, the `uncaughtException` handler removed, the `unhandledRejection`
  handler removed (survived until the test used
  `--unhandled-rejections=warn`), and `O_NONBLOCK`, `O_NOFOLLOW` and the
  `isFile` check removed from `hashFile` (each caught). Not mutation-checked:
  the other test files, and the reason-line wording beyond the cases listed
  by the reviewers.
- **SOLID and heuristics: PASS.** The stream is passed in, not imported. F3
  (flag arguments): none. G31: `deadlineAfter` assigns its timer in the Promise
  executor, which runs at once, so `cancel` is safe.
- **Code style: PASS.** All files are under 300 lines (longest: ledger.ts 289,
  test-helpers.ts 147 after the move, claude-hook.ts 231, the test files 249
  and below). No function in the changed files is over 20 lines (the longest of
  mine is the CLI's `run`, 18; `hashFile` is 16; `parseLines` in ledger.ts is 19
  and is e06s03's). Comments say why. G25: production numbers are named; test
  timing limits are literals, as in other tests.

## Red flags caught

- I nearly accepted a 48-line `readHookInput` because a Promise executor with
  four handlers "reads fine in one place". The limit is 20, and the e07s01
  audit split a 21-line function.
- My first length script used the TypeScript compiler API. This repository has
  TypeScript 7, which has no such API; the script crashed, and the "baseline
  clean" line after it printed anyway. I did not take that as a result. The
  second script reads indentation and was checked on `main`'s `hookAnswer`.
- I took Reviewer B's claim (round 1) that `process.exit` leaves a process stuck
  on a FIFO and built the first fix on it. It was false, and two tests proved
  so. I stopped and told the owner instead of working around it.
- I wrote a no-op error listener "to be safe" and a test that could not tell
  whether it mattered. A probe showed it did nothing.
- I wrote "mutated to prove they fail" in the previous version of this report
  while some guards had no failing mutant. Reviewer A found it; the list above
  is what I actually ran.
- I planned a readiness check from `/proc/<pid>/status` and found it cannot
  work, because Node catches SIGTERM before our handler exists. I changed the
  bound and said why instead of keeping a check that proves nothing.
- My first test for the `unhandledRejection` handler passed with the handler
  deleted, because Node's default turns the rejection into an uncaught
  exception. It now runs with `--unhandled-rejections=warn`.
- I wrote "unlikely, left alone" for an unprintable thrown value in the
  previous version of this report, against a story whose claim is "every throw".
  Reviewer A showed a one-line reproduction; I fixed it.
- Reviewer B named a FIFO `.gitattributes` as a second git trigger. I probed it
  before copying the claim into a document, and it did not hang that command.
- I read an exit code from a shell pipeline in the wrong way once while
  re-running a manual step (a stale `pipestatus`), and re-ran the step without
  a pipe before recording it.
- Changed test expectations: the closed-stream message, the `stdin.destroy()`
  timing bound (tightened, then widened to 1.5 s on review), and the rejection
  test's Node flag.

## Left as "consider"

- **Stuck `git` outlives the hook, and each Stop attempt costs the full
  deadline.** The engine's git calls take no abort signal or timeout. A FIFO
  named `.gitignore` in the tree is enough to trigger it (T6, not fail-open,
  documented). An e06 story could pass the signal.
- **Thread-pool calls blocked in a syscall elsewhere** (a stalled network file
  system): no timer can end them; the ledger and the fingerprint were the ones
  an agent can reach.
- **T9, one slow test.** AC-e07s02-04 takes about 10 s because it runs the real
  CLI against a stdin that never closes; the deadline logic is also unit-tested
  in about 40 ms. The two AC-14 tests take about 2.6 s each.
- **Test timing.** "SIGTERM while the CLI waits for input" sleeps 1 s so the CLI
  can start; on a very slow machine it could fail with a false negative. There
  is no external readiness signal for it (see round 2, B4). The other signal
  tests wait on a pid file.
- **`leave` can lose the reason line.** It swallows a `writeSync` error (EAGAIN
  on a full non-blocking pipe); the exit code stays 2. The unprintable-error
  path that used to share this item is fixed (round 3, A1).
- **From round 3:** the 2.5 s fault delay in AC-14 could flake on a very loaded
  machine; the non-blocking-open guard exists in three modules; `readLedger`
  has no production caller; `inChild` labels a crash and a hang alike; SIGHUP
  and SIGQUIT are not handled (named in the header).
- **Four result types of one shape** (`HookInput`, `HookText`, `ProjectDir`,
  `HookRequest`); a shared type was left as "consider" in e07s01 by decision.
- **N4.** `parseHookInput` returns `HookInput`, `readHookInput` returns
  `HookText`. The first name is from e07s01.
- **F1.** `readHookInput` takes three arguments because the spec's signature
  passes the cap and the deadline, so tests can use short ones.
- **The residual that remains.** A crash before the handlers are installed
  (exit 1), a signal in the first ~100 ms, and SIGKILL stay fail-open. The
  header says so, and the e07s04 live check is the detector.
