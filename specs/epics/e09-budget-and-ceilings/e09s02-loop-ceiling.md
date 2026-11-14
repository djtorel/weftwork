# e09s02 — The engine stops the whole loop at a counted ceiling

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 5
**epic:** e09 (Budget and ceilings, B5)
**research story:** none (R15: a ceiling the engine counts over the
whole loop, not a host cap or the model's judgment [S3][S5][S18];
SYNTHESIS budget setting: stopping a run on a budget is off by default)
**branch:** e09s02-loop-ceiling

## 1. Purpose

The only ceiling today is `maxFailures`: failed runs in a row of one
exact command string. An agent that changes the command, or passes
once on another command, starts again from zero, so nothing bounds
the whole loop.

This story adds `maxRuns`, an optional loop ceiling. It counts every
gate run, for any command, since the last `done`, and answers
`exhausted` when it is reached, so changing the command no longer
starts the count again. A `done` of any command does start a new loop
(decision 1); on the CLI, where the agent writes the request, a command
that always passes can do that (T1, docs/BUDGET.md). It is off unless
the owner (or the request) sets it. It also closes residual F5 for the
case where the owner turned the ceiling on: a loop that cannot be
counted fails closed.

Decisions recorded at plan-work (2026-11-14). The owner took all three
recommendations of slice-tasks:

1. A loop starts after the last `done` run in the ledger, of any
   command, or at the start of the ledger tail when there is none.
   Each `done` opens a new loop.
2. The key is `maxRuns`, an integer from 1 to 1000, in the `budget`
   mapping of the e09s01 setting files. Absent means off.
3. F5: when `maxRuns` is set and the ledger cannot be read, the engine
   answers `exhausted` and does not run, because the ceiling cannot be
   counted. Without `maxRuns` the behaviour stays as it is (AC-28 of
   e06s04: the stop rules are off for that call).

Planner's choice, same rule as the other limits (e09s01 decision 2 and
4): `maxRuns` is also a request key. A request value is used only when
it is lower than the value from the files. With the ceiling off in the
files, any request value is lower, so the request can turn it on but
never raise or turn off the owner's value.

## 2. Zoom-out

- `src/breaker.ts`. Purpose: the stop rules as pure functions over
  ledger entries. Callers: `src/engine.ts` only. Contract:
  `checkCeiling` and `checkStall` return a `Trip` or null. This story
  adds `checkLoopCeiling(entries, maxRuns)` next to `checkCeiling`.
- `src/engine.ts`. Purpose: the order of the checks and the state
  lines. Callers: `src/cli.ts`, `src/claude-hook-cli.ts`. Contract:
  exhausted is checked before the run (no later pass undoes it), then
  blocked, then the run; after the run: done, killed, exhausted,
  stalled, failed. `done` comes only from `runGate` (C4). `readEntries`
  turns an unreadable ledger into no entries and a note. This story
  makes `readEntries` say whether the read failed, adds the loop
  ceiling before and after the run, and applies F5.
- `src/gate.ts`. Purpose: parse the request. Contract: `limitKeys`,
  `isLimit` and `limitRule` are the one range rule for the request and
  the setting files. This story adds `maxRuns` (minimum 1) to them.
- `src/budget.ts`. Purpose: merge built-in, user file, repository file
  and request. Contract: `Limits` holds every limit with a built-in
  default. `maxRuns` has none, so it stays unset when no source sets
  it.
- `src/ledger.ts`. `readLedgerTail` gives the run entries of the tail
  (state lines are separate); a missing file is an empty ledger, not a
  read failure. Unchanged.

## 3. Requirements

- **ADDED R1.** With `maxRuns` set, the run count is the number of run
  entries in the ledger tail after the last `done` entry of any
  command. Before a run, a count of `maxRuns` or more answers
  `exhausted` (exit 5) without running. After a run that is not
  `done` and not `killed`, a count of `maxRuns` or more answers
  `exhausted`. The state line has threshold `maxRuns` and a detail
  that names the loop ceiling.
- **ADDED R2.** With `maxRuns` absent, every answer is the same as
  before this story.
- **ADDED R3.** `maxRuns` is a key of the `budget` mapping and of the
  request: an integer from 1 to 1000. The e09s01 precedence applies;
  a request value is used only when it is lower, and with no file value
  any request value applies.
- **ADDED R4 (F5).** With `maxRuns` set, a ledger that cannot be read
  (not a missing file) answers `exhausted` before the run and does not
  run. If the read after a run fails, a run that is not `done` and not
  `killed` answers `exhausted`; a `done` run stays `done`. Without
  `maxRuns`, an unreadable ledger keeps the AC-28 behaviour.
- **ADDED R4a (review round 1, owner decision 2026-11-14).** With
  `maxRuns` set, two more cases mean the loop cannot be counted and
  answer `exhausted`: the run's ledger line could not be written (after
  a run that is not `done` and not `killed`), and the 1 MiB tail was cut
  and holds no `done` while the runs in it are fewer than `maxRuns`
  (before and after a run). Without `maxRuns` neither changes anything.
- **ADDED R5.** The failure ceiling is checked before the loop
  ceiling; both answer `exhausted`. The Claude Code hook gets the same
  answer through `applyBudget`, with no hook change.

## 17. Acceptance criteria (Gherkin)

```gherkin
AC-e09s02-01  Given entries with no done and maxRuns 3
              When checkLoopCeiling counts 2 runs of different commands
              Then it does not trip
              And with 3 runs it trips with threshold 3 and count 3 (R1)

AC-e09s02-02  Given 5 failed runs, then a done run, then 1 failed run
              When checkLoopCeiling counts with maxRuns 3
              Then the count is 1 and it does not trip (R1)

AC-e09s02-03  Given maxRuns absent
              Then the loop ceiling never trips, at any count (R2)

AC-e09s02-04  Given weftwork.yaml with budget.maxRuns 3
              When the CLI runs exit 1, exit 2, then exit 3 (a new
              command each time, so maxFailures never trips)
              Then the third answer is exhausted (exit 5)
              And a fourth call with a new command is refused without
              running (R1)

AC-e09s02-05  Given weftwork.yaml with budget.maxRuns 2
              When the CLI runs a failing command, then a passing one,
              then a failing one
              Then the answers are failed, done, failed (a done opens
              a new loop) (R1)

AC-e09s02-06  Given weftwork.yaml with budget.maxRuns 0 or 1001
              Then the CLI exits 2 and names weftwork.yaml and maxRuns
              And a request with maxRuns 0 exits 2 (R3)

AC-e09s02-07  Given weftwork.yaml with budget.maxRuns 4
              When the request sets maxRuns 2, the limit is 2
              When the request sets maxRuns 9, the limit is 4
              And with no file value, a request maxRuns 2 is used (R3)

AC-e09s02-08  Given maxRuns 5 and the ledger made a directory
              When the CLI runs a failing command
              Then the answer is exhausted (exit 5) and the command did
              not run (R4)

AC-e09s02-09  Given maxRuns absent and the ledger made a directory
              Then the answer is as AC-e06s04-28: the rules are off for
              the call (R4, R2)

AC-e09s02-10  Given weftwork.yaml with budget.maxRuns 2
              When the Claude Code hook runs two different failing
              commands
              Then the second answer is the exhausted one (R5)

AC-e09s02-11  Given maxRuns 5 and a read-only ledger
              When a failing command runs
              Then the answer is exhausted, the run did happen, and the
              detail says the run could not be written (R4a)
              And without maxRuns the answer stays failed

AC-e09s02-12  Given maxRuns set and a ledger whose 1 MiB tail is cut and
              holds no done (long commands or junk lines)
              Then the call answers exhausted and does not run (R4a)
              And a cut tail with a done in it is counted as usual
              And without maxRuns nothing changes

AC-e09s02-13  A run killed at the ceiling answers killed; at the ceiling
              exhausted comes before blocked; a blocked answer and an
              overridden run add no extra run (R1, R5)
```

## Steps

1. RED, then GREEN (AC-01 to 03). Write the tests in
   `src/breaker.test.ts` first and record the failure. Add
   `checkLoopCeiling(entries, maxRuns)` to `src/breaker.ts` next to
   `checkCeiling`: the run entries after the last `done`, any command;
   null when `maxRuns` is undefined.
   → verify: `node --test src/breaker.test.ts && npm run typecheck`
2. RED, then GREEN (AC-06, 07; R3). Add `maxRuns` (1 to 1000) to
   `limitKeys` in `src/gate.ts` and to the optional request keys; in
   `src/budget.ts`, `maxRuns` has no built-in value and stays unset
   when no source sets it. Tests in `src/budget.test.ts` and
   `src/gate.request.test.ts`.
   → verify: `node --test src/budget.test.ts src/budget.files.test.ts src/gate.request.test.ts && npm run typecheck`
3. RED, then GREEN (AC-04, 05, 08, 09; R1, R4, R5). In
   `src/engine.ts`, `readEntries` reports a failed read; check the loop
   ceiling before the run (after the failure ceiling) and after the
   run, and apply F5. Log the exhausted state line with threshold
   `maxRuns`. Engine tests in `src/engine.test.ts`; CLI tests in
   `src/cli.budget.test.ts` and `src/cli.ledger.test.ts`, with
   `XDG_CONFIG_HOME` isolated.
   → verify: `node --test src/breaker.test.ts src/engine.test.ts src/cli.budget.test.ts src/cli.ledger.test.ts && npm run typecheck`
4. RED, then GREEN (AC-10). A hook test in
   `src/claude-hook-cli.budget.test.ts`; no hook code change is
   expected.
   → verify: `node --test src/claude-hook-cli.budget.test.ts src/claude-hook-cli.test.ts && npm run typecheck`
5. Document `maxRuns`, the loop start and the F5 rule in
   `docs/BUDGET.md`. Record F5's new status in
   `specs/security/REVIEW.md` and the choice in
   `specs/security/epics/e06/THREAT_MODEL.md`. Run the Preflight line.
   → verify: `grep -q 'maxRuns' docs/BUDGET.md && grep -q 'maxRuns' specs/security/REVIEW.md && yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test`

## Verification Script (Step-by-Step)

Run in a scratch clone so the ledger lines do not matter:

1. `git clone /home/domtorr/Dev/personal_projects/weftwork /tmp/wf-uat && cd /tmp/wf-uat && git checkout e09s02-loop-ceiling && npm ci`
2. `printf 'budget:\n  maxRuns: 3\n' > weftwork.yaml`
3. Run `echo '{"command":"exit 1"}' | node src/cli.ts; echo $?`, then
   the same with `exit 2` and `exit 3`. The first two exit 1
   (`failed`); the third exits 5 (`exhausted`).
4. `echo '{"command":"exit 4"}' | node src/cli.ts; echo $?` exits 5
   and the detail names the loop ceiling.
5. `rm -rf /tmp/wf-uat`

## 4. Dependencies (slopcheck)

- No new package. `yaml` 2.9.1 [OK] is already pinned (e08s01).

## 5. Out of scope

- The handover reserve (`reserveRuns`, e09s03) and the always-on
  report of the counts (e09s04).
- Ceilings on wall-clock time, turns or tokens; a dollar spend cap.
- Stopping the agent from editing the ledger or `weftwork.yaml` (T3;
  protected paths are e10). A forged `done` line opens a new loop, the
  same class as erasing failures.

## 6. Risks

- The count reads the 1 MiB ledger tail. Review round 1 showed that
  commands of about 120 KB, which the request allows, leave only about 8
  runs in the tail. Fixed in R4a: a cut tail with no `done` fails closed
  when `maxRuns` is set (AC-e09s02-12).
- A ledger that can be read but not written hid failed runs from the
  count (review round 1). Fixed in R4a (AC-e09s02-11).
- F5 fails closed only with `maxRuns` set. A default repository keeps
  the old residual; `docs/BUDGET.md` says so.
- `Limits` gains a key with no built-in value, which touches the type
  that e09s01 made total. Detect: the typecheck and the e09s01 budget
  tests stay green.
