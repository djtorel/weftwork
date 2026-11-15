# e09s03 — The engine keeps a reserve so a hard stop leaves a handoff

**type:** feat
**risk:** P2
**context:** engine
**bcps:** 3
**epic:** e09 (Budget and ceilings, B5)
**research story:** none (R15: count the ceilings in the engine and keep a
reserve so a hard stop leaves a written handoff [S3]; Bounded Loops
partitions a reserve out of the budget for the same reason)
**branch:** e09s03-engine-reserve

## 1. Purpose

At the loop ceiling (`maxRuns`, e09s02) the engine answers `exhausted`.
The Claude Code hook then lets the stop go ahead with only a
`systemMessage`. The agent has no turn left in which to write a handoff,
so the next session starts with no note.

This story adds a reserve. When a run fails and the runs left under the
loop ceiling are within the reserve, the `failed` answer carries a
detail that tells the agent to write the handoff now, and the hook adds
that detail to the reason with which it blocks the stop. At the ceiling the
answer is still `exhausted`, as in e09s02.

Decisions recorded at plan-work (2026-11-14). The owner took all four
recommendations:

1. Scope: the reserve applies to the loop ceiling only. The failure
   ceiling (`maxFailures`) and the stall rule still end the loop with
   no warning; they stay out of scope.
2. Setting: `reserveRuns` is a key of the `budget` mapping in the
   setting files only. It is not a request key, so the agent cannot turn
   it off through the request. Range 0 to 1000; 0 turns it off. When
   `maxRuns` is set and no file sets `reserveRuns`, it is 1. The engine
   uses `min(reserveRuns, maxRuns - 1)`, so `maxRuns` 1 has no reserve
   and no mix of files is an error.
3. Telling: a `detail` on the `failed` answer, and the hook appends it to
   its stderr block reason. No new state and no new exit code.
4. `exhausted` does not check that a handoff was written. The engine
   reports; it does not gate on the handoff.

## 2. Zoom-out

- `src/breaker.ts`. Purpose: the stop rules as pure functions over
  ledger entries. Callers: `src/engine.ts` only. Contract:
  `checkCeiling`, `checkLoopCeiling`, `checkStall` return a `Trip` or
  null. This story adds `checkReserve(entries, maxRuns, reserveRuns)`
  next to `checkLoopCeiling`. Reason for depth: the reserve is one more
  rule over the same entries, and as a pure function it is tested
  without a repository, like the other rules.
- `src/budget.ts`. Purpose: merge built-in, user file, repository file
  and request. Callers: `src/cli.ts`, `src/claude-hook-cli.ts`.
  Contract: `Limits` and `checkLimits` know the `budget` keys; a request
  value is used only when it is lower. This story adds `reserveRuns` as a
  file-only key: `checkLimits` accepts it, the request lowering loop
  (`limitKeys`) does not touch it.
- `src/gate.ts`. Purpose: parse the request. Contract: `GateRequest`
  carries the limits to the engine; `pickOptional` keeps only known
  request keys, so a `reserveRuns` in the request JSON is ignored. This
  story adds `reserveRuns?: number` to `GateRequest` (set only by
  `applyBudget`) and does not add it to `limitKeys`.
- `src/engine.ts`. Purpose: the order of the checks and the state lines.
  Callers: `src/cli.ts`, `src/claude-hook-cli.ts`. Contract: after a run,
  done, killed, exhausted, stalled, failed; a `failed` answer is not
  logged as a state line. This story adds the reserve detail to a
  `failed` answer only.
- `src/claude-hook.ts`. Purpose: map an engine answer to the hook
  output. Callers: `src/claude-hook-cli.ts`. Contract: `failed` blocks
  the stop with a reason on stderr (exit 2); every other not-done state
  warns and allows the stop. This story appends the answer's detail to
  the `failed` block reason when there is one.

## 3. Requirements

- **ADDED R1.** With `maxRuns` set, after a run that answers `failed`,
  let `count` be the runs since the last `done` (as `checkLoopCeiling`
  counts them, this run included), `left` be `maxRuns - count`, and
  `reserve` be `min(reserveRuns, maxRuns - 1)`. When `0 < left <=
  reserve`, the answer carries a detail that names `count`, `left`, the
  ceiling, and the command that writes the handoff: `node
  <absolute path of src/handoff-cli.ts>`. Every other answer is as
  before.
- **ADDED R2.** `reserveRuns` is a key of the `budget` mapping: an
  integer from 0 to 1000. A user file value is overridden by a
  repository file value. With `maxRuns` set and no file value, it is 1.
  It is not a request key: a request `reserveRuns` changes nothing.
- **ADDED R3.** With `maxRuns` absent, or the effective reserve 0, every
  answer is the same as before this story.
- **ADDED R4.** The Claude Code hook appends the detail of a `failed`
  answer to its block reason on stderr, after the existing line. The
  exit code stays 2.
- **ADDED R5.** `exhausted`, `stalled`, `blocked`, `killed`, `done` and
  `overridden` answers do not change. In particular, a run whose failure
  ceiling or stall rule trips answers as before, with its own detail.

## 17. Acceptance criteria (Gherkin)

```gherkin
AC-e09s03-01  Given entries with no done, maxRuns 4 and reserveRuns 1
              When checkReserve counts 3 runs
              Then it gives count 3 and left 1
              And with 2 runs, or 4, it gives null (R1)

AC-e09s03-02  Given maxRuns 4 and reserveRuns undefined
              Then the reserve is 1
              And given maxRuns 1 it never gives a reserve
              And given maxRuns 4 and reserveRuns 9, with 1 run, it gives
              left 3 (the reserve is clamped to 3) (R1, R2)

AC-e09s03-03  Given maxRuns undefined, or reserveRuns 0
              Then checkReserve gives null at every count (R3)

AC-e09s03-04  Given weftwork.yaml with budget.reserveRuns 0, or 1000
              Then the limits hold that value
              And given -1, 1001 or 2.5 the CLI exits 2 and names
              weftwork.yaml and reserveRuns
              And an unknown key's error lists reserveRuns as known (R2)

AC-e09s03-05  Given a user file with reserveRuns 2 and a repository file
              with reserveRuns 1
              Then the reserve is 1 (R2)

AC-e09s03-06  Given weftwork.yaml with budget.maxRuns 4
              When the CLI runs exit 1, exit 2, then exit 3
              Then the first two answer failed with no detail
              And the third answers failed (exit 1) with a detail that
              says 3 runs, 1 left, the ceiling 4, and names handoff-cli.ts
              And a fourth call answers exhausted (exit 5) (R1)

AC-e09s03-07  Given weftwork.yaml with budget.maxRuns 4
              When a request sets reserveRuns 0
              Then the third failed answer still has the detail (R2)

AC-e09s03-08  Given maxRuns absent, or reserveRuns 0
              Then no failed answer has a detail (R3)

AC-e09s03-09  Given maxRuns 4, maxFailures 3 and one command failing
              Then the third run answers exhausted with the failure
              ceiling's detail, not the reserve detail (R5)
              And a run in the reserve window that passes answers done
              with no detail (R5)

AC-e09s03-10  Given weftwork.yaml with budget.maxRuns 3
              When the Claude Code hook runs a failing command twice
              Then the first block reason has no reserve line
              And the second block reason (exit 2) ends with the reserve
              detail that names handoff-cli.ts
              And a third call allows the stop with the exhausted
              systemMessage (R4)
```

## Steps

1. RED, then GREEN (AC-01 to 03). Write the tests in
   `src/breaker.reserve.test.ts` first and record the failure. Add
   `checkReserve(entries, maxRuns, reserveRuns)` to `src/breaker.ts`:
   null when `maxRuns` is undefined; the reserve is
   `min(reserveRuns ?? 1, maxRuns - 1)`; it gives `{ count, left }` when
   `0 < left <= reserve`.
   → verify: `node --test src/breaker.test.ts src/breaker.loop.test.ts src/breaker.reserve.test.ts && npm run typecheck`
2. RED, then GREEN (AC-04, 05; R2). Add `reserveRuns` (0 to 1000) as a
   file-only key in `src/budget.ts` (`Limits`, `checkLimits`, the
   known-key list in the error) and `reserveRuns?: number` to
   `GateRequest`, not to `limitKeys`. Tests in `src/budget.test.ts` and
   `src/budget.files.test.ts`.
   → verify: `node --test src/budget.test.ts src/budget.files.test.ts src/gate.request.test.ts && npm run typecheck`
3. RED, then GREEN (AC-06 to 09; R1, R3, R5). In `src/engine.ts`, after
   `classify` gives `failed`, add the reserve detail from `checkReserve`
   with the handoff CLI's absolute path
   (`join(import.meta.dirname, 'handoff-cli.ts')`). Engine tests in
   `src/engine.loop.test.ts`; CLI tests in `src/cli.loop.test.ts`, with
   `XDG_CONFIG_HOME` isolated.
   → verify: `node --test src/breaker.loop.test.ts src/engine.test.ts src/engine.loop.test.ts src/cli.loop.test.ts src/cli.budget.test.ts && npm run typecheck`
4. RED, then GREEN (AC-10; R4). In `src/claude-hook.ts`, `blockFailed`
   appends `answer.detail` on a new line when it is set. A unit test in
   `src/claude-hook.test.ts` and a hook CLI test in
   `src/claude-hook-cli.budget.test.ts`.
   → verify: `node --test src/claude-hook.test.ts src/claude-hook-cli.test.ts src/claude-hook-cli.budget.test.ts && npm run typecheck`
5. Document `reserveRuns` in `docs/BUDGET.md` (the key table, a section
   on the reserve, the file-only rule) and update the `detail` comment
   at the top of `src/cli.ts`. Run the Preflight line.
   → verify: `grep -q 'reserveRuns' docs/BUDGET.md && yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test`

## Verification Script (Step-by-Step)

Run in a scratch clone so the ledger lines do not matter:

1. `git clone /home/domtorr/Dev/personal_projects/weftwork /tmp/wf-uat && cd /tmp/wf-uat && git checkout e09s03-engine-reserve && npm ci`
2. `printf -- '---\nbudget:\n  maxRuns: 4\n' > weftwork.yaml`
3. Run `echo '{"command":"exit 1"}' | XDG_CONFIG_HOME=/tmp/wf-uat-xdg node src/cli.ts; echo $?`,
   then the same with `exit 2`. Both exit 1 and have no `detail`.
4. The same with `exit 3`: exit 1, and the `detail` says 3 runs, 1 left,
   the ceiling 4, and `node /tmp/wf-uat/src/handoff-cli.ts`.
5. The same with `exit 4`: exit 5 (`exhausted`).
6. `rm -rf /tmp/wf-uat /tmp/wf-uat-xdg`

## 4. Dependencies (slopcheck)

- No new package. `yaml` 2.9.1 [OK] is already pinned (e08s01).

## 5. Out of scope

- A reserve before the failure ceiling or the stall rule (decision 1).
- Checking at `exhausted` that a handoff was written (decision 4).
- The always-on report of the counts (e09s04).
- Stopping the agent from editing `weftwork.yaml` or the ledger (T3;
  protected paths are e10). An agent that edits the file can set
  `reserveRuns` to 0, as it can raise `maxRuns`.

## 6. Risks

- A `failed` answer gains a `detail` field. Tests or readers that expect
  no `detail` on `failed` would break. Detect: the full suite in step 5;
  `src/cli.states.test.ts` covers the answer shape.
- The detail names an absolute path inside the weftwork checkout. If the
  checkout moves, the path in an old answer is stale; each new answer
  computes it again.
- The default reserve of 1 changes the hook's block reason for every
  repository that sets `maxRuns`. That is the intent (R1); without
  `maxRuns` nothing changes (R3).
