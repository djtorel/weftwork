# e06s04 — Name the five terminal states and trip a no-progress breaker

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 5
**epic:** e06 (Engine core and done gate, B1)
**research story:** none (B1 rests on R13, R14 and R15 through
docs/research/SYNTHESIS.md)
**branch:** e06s04-terminal-states-breaker

## 1. Purpose

Today the engine answers with a verdict and exit 0 or 1. An agent loop
needs more: it must know when to stop, and why. This story names the five
terminal states, gives each one exit code, and adds the two stop rules the
engine can count for itself, so a loop never ends on the model's own
opinion (R15 [S1][S3][S14]).

- **done**: the declared command passed on an unchanged tree (as today).
- **blocked**: the worker says it cannot go on, and why. The engine logs it.
- **stalled**: N failed runs in a row on the same tree with the same
  failure. Nothing moved, so another run proves nothing.
- **exhausted**: a ceiling on failed runs in a row. At the ceiling the
  engine stops running the command.
- **killed**: the engine got SIGTERM or SIGINT, stopped the command and
  logged it.

A run that failed and tripped nothing is not terminal. It gets the name
`failed` and keeps exit 1, so callers that read 1 as "not done, try again"
stay right. An error or an exhausted budget never gives done.

Owner decisions (2026-11-12, plan-work, "use the recommendations" on four
questions; each followed the recommended option):

1. **The stall key is command, tree, reason and exit code.** The tasks file
   said "same failure output". The engine does not capture output (it goes
   to stderr), and test runners print timings that change on every run
   (`node --test` prints `(22.2ms)` and `duration_ms`), so a hash of raw
   output would differ every time and the breaker would never trip. The
   tree fingerprint is the evidence that moves (R15 [S14]: the production
   breakers key on identical calls and on "no new mutation"). No output is
   captured, so nothing secret is stored and no capture cap is needed (C8).
   This changes the wording of task 2 in the tasks file.
2. **Exit codes:** 0 done, 1 failed, 2 bad input (unchanged), 3 blocked,
   4 stalled, 5 exhausted, 6 killed. 0, 1 and 2 mean what they mean today,
   so the e06s01 and e06s02 tests and any caller keep working. 3 to 6 stay
   clear of the shell's 126 and 127.
3. **Exhausted is enforced before the run.** The ledger has no run id. So
   before each run the engine counts the failed runs in a row from the
   ledger. At or over the ceiling it answers exhausted and does not run the
   command, so a later pass can never undo it. The owner restarts by
   deleting the ledger file. A run id or a proper reset belongs to e08 and
   e09.
4. **A signal kills the process group with SIGKILL**, the way the timeout
   already does. No grace period.

Defaults are tunable, not findings. Three identical runs and five failed
runs are ralph's defaults and the only coding-loop figures found; no study
tests them (R15 [S17]; R10 measures them later, H15).

Reason for Depth, one line per new file:

- `src/states.ts`: one table of state names and exit codes, so the CLI, the
  engine and the ledger agree on both.
- `src/breaker.ts`: the two stop rules as pure functions over ledger
  entries, so tests run them on arrays with no process and no repository.
- `src/engine.ts`: the order of the checks and the logging, so `cli.ts`
  stays a thin shell and tests call the whole flow without a process.

No other new abstraction.

## 2. Zoom-out

The story adds three modules and changes three.

- **Purpose of `src/gate.ts`:** run a declared command and say whether it
  is done (e06s01 to e06s03). It stays that. It gains an optional
  `AbortSignal` and one reason, and still never reads the ledger (C4).
- **Purpose of `src/ledger.ts`:** the plain-file log and its counts
  (e06s03). It gains state lines, a capped tail reader and one helper.
- **Purpose of `src/cli.ts`:** JSON on stdin, one JSON line on stdout, an
  exit code. It now calls `runEngine`, maps the state to the exit code and
  forwards two signals.
- **Callers:** `cli.ts` calls `parseRequest` and `runGate` today. After this
  story it calls `parseRequest` and `runEngine`. `runEngine` calls
  `runGate`. `test-helpers.ts` and the test files call `ledger.ts`.
- **Contracts that must hold:** `runGate` resolves and never rejects.
  `done` is true only with reason `passed`. stdout holds exactly one JSON
  line. The ledger write never changes the fingerprint. `readLedger` keeps
  its result shape, and a state line is neither a run nor a skipped line.
  Exit 0, 1 and 2 keep their meaning. The gate never takes `done` from the
  ledger (C4).
- **What breaks on purpose:** `Reason` gains `killed` and `not-run`; the
  JSON line gains `state` (and `detail` for three states); exit 1 means
  `failed` only, and 3 to 6 are new.

Blast radius (inline, in place of a separate `assess-impact` run): new
files `src/states.ts`, `src/breaker.ts`, `src/engine.ts` and their tests
(`states.test.ts`, `ledger.states.test.ts`, `breaker.test.ts`,
`ceiling.test.ts`, `gate.request.test.ts`, `killed.test.ts`,
`engine.test.ts`, `blocked.test.ts`, `cli.states.test.ts`); changed files
`src/gate.ts` (three input keys, `AbortSignal`, two reasons),
`src/ledger.ts` (state lines, tail reader, `failingRun`),
`src/cli.ts` (engine call, exit table, signals) and `src/test-helpers.ts`
(`isAlive` moves here from `gate.test.ts`, which then imports it). No change
to `package.json`, `tsconfig.json`, CI, `.gitignore` or AGENTS.md. Every
existing test keeps passing unchanged, except that `gate.test.ts` imports
`isAlive`.

## 3. Requirements

#### ADDED: states and exit codes, `src/states.ts`
- `terminalStates`: `['done', 'blocked', 'stalled', 'exhausted', 'killed']`.
  `TerminalState` is the string-literal union of those five. `State` is
  `TerminalState | 'failed'`. No `enum` (erasable syntax).
- `exitCodes: Record<State, number>`: done 0, failed 1, blocked 3,
  stalled 4, exhausted 5, killed 6. `badInputExitCode` is 2.
- Only `done` maps to 0. All seven codes (six states and bad input) are
  distinct. A caller can tell any state from any other by the code.

#### ADDED: ledger helpers in `src/ledger.ts`
- `failingRun(entries, command)`: the not-done entries after the last done
  entry for that exact command, oldest first. `countsFor` takes `failStreak`
  from it, with no change in result (the e06s03 tests stay green).
- `StateEntry`: `{ at, state, command, runs, failStreak, threshold, detail }`.
  `state` is a `State`; `runs` and `failStreak` are integers; `threshold` is
  an integer or null; `detail` is a string or null.
- `appendState(path, entry, at)`: writes one state line by the same single
  write as `appendEntry` (leading newline, `JSON.stringify`, newline; mode
  0700 and 0600). Returns `{ ok: true } | { ok: false; error: string }`.
  Never throws.
- A line with a string `state` key is a state line, not a run. Both readers
  accept it when its fields are valid and skip and count it when they are
  not. A valid state line is never counted in `skipped`, never in `entries`
  and never in `countsFor`.
- `readLedgerTail(path, maxBytes)`: like `readLedger`, but reads at most the
  last `maxBytes` bytes (exported `ledgerReadCap` is 1 MiB, security review
  F3, CWE-400). When the file is larger, the first fragment before the first
  newline is dropped and not counted, and `truncated` is true. The result
  also holds `states`. A missing file is ok with nothing. Never throws.

#### ADDED: the stop rules, `src/breaker.ts`
- `defaultStallAfter` 3 and `defaultMaxFailures` 5 (tunable defaults).
- `checkStall(entries, command, stallAfter)` returns a `Trip` or null, where
  `Trip` is `{ state: 'stalled' | 'exhausted'; threshold: number;
  count: number }`. It looks at the last `stallAfter` entries of
  `failingRun`. It trips only when there are that many, every one has a
  non-null fingerprint, and all share the same fingerprint, reason and exit
  code. A null fingerprint means the tree was not read, so it is never "the
  same tree".
- `checkCeiling(entries, command, maxFailures)` returns a `Trip` with state
  `exhausted` when `failingRun` holds at least `maxFailures` entries, and
  null otherwise. A pass ends the count, as in `countsFor`.
- Both are pure and count only entries for the exact command string.

#### ADDED: input keys in `parseRequest` (`src/gate.ts`)
- `blocked`: a string of 1 to 1000 characters that is not only spaces. `stallAfter`:
  an integer from 2 to 1000. `maxFailures`: an integer from 1 to 1000. Each
  is optional. A bad value is an input error (exit 2), like a bad
  `timeoutMs`. `GateRequest` gains the three optional fields; `runGate`
  ignores them.

#### MODIFIED: `Reason` in `src/gate.ts`
**Before:** `passed`, `exit-nonzero`, `not-started`, `signal`, `timeout`,
`no-tree`, `tree-changed`, `no-ledger`.
**After:** the same, plus `killed` (the engine got SIGTERM or SIGINT and
stopped the command) and `not-run` (the command did not run, because the
engine answered `blocked` or `exhausted` first).

#### MODIFIED: `runGate(request, signal?)` in `src/gate.ts`
**Before:** the command ends by itself, by timeout, or by a signal that
reaches the command.
**After:** an optional `AbortSignal`. When it aborts while the command runs,
the whole process group gets SIGKILL and the verdict is `done` false, reason
`killed`, exit code null. A signal that is already aborted before the spawn
means the command does not run, with the same verdict. If the command has
already ended, the verdict stands. The verdict is logged like any other
(e06s03). `gate.ts` still never reads the ledger: no `readLedger` and no
`countsFor` in it.

#### ADDED: `runEngine(request, signal?)` in `src/engine.ts`
- Returns `Promise<Answer>`, where `Answer` is a `Verdict` plus `state` and
  an optional `detail`. Resolves, never rejects for an expected failure.
- Order of checks, first match wins:
  1. **exhausted (before the run):** read the ledger tail. If
     `checkCeiling` trips for this command, answer `exhausted` and do not
     run. Verdict fields: `done` false, `exitCode` null, `reason` `not-run`,
     `fingerprint` null.
  2. **blocked:** if `request.blocked` is set, answer `blocked` with the
     same verdict fields and `detail` set to the text. Do not run.
  3. **run:** call `runGate(request, signal)`.
     - `done` true: state `done`.
     - reason `killed`: state `killed`.
     - otherwise read the ledger tail again and take, in order, `exhausted`
       (`checkCeiling`), then `stalled` (`checkStall`), then `failed`.
       Exhausted outranks stalled because it ends all runs.
- `done` comes only from `runGate`. The ledger can never turn a not done
  answer into done, and a forged entry can never make it done (C4).
- State lines: every answer whose state is `done`, `blocked`, `stalled`,
  `exhausted` or `killed` writes one state line with `runs` and `failStreak`
  from the ledger as read, `threshold` set for stalled and exhausted (the
  number that tripped) and null otherwise, and `detail` set for blocked
  (the worker's text) and for stalled and exhausted (a short count text).
  `failed` writes none, since it is not terminal. A state line that cannot
  be written is a line on stderr and does not change the answer.
- A ledger that cannot be read turns the stop rules off for that call, with
  a line on stderr. It never produces `done`: a passing run still needs the
  e06s03 write, so it becomes `no-ledger`. A `truncated` tail adds a line on
  stderr.
- Stalled is not sticky. Each call that finds the last `stallAfter` runs
  identical answers `stalled` again. A change to the tree starts a new count.

#### MODIFIED: CLI exit codes and JSON line in `src/cli.ts`
**Before:** exit 0 done, exit 1 not done, exit 2 unreadable input. The JSON
line holds `done`, `exitCode`, `reason`, `command`, `fingerprint`.
**After:** the exit code is `exitCodes[state]` from the table, and 2 for
unreadable input. The JSON line also holds `state`, and `detail` for
blocked, stalled and exhausted. Exit 1 now means `failed`: not done, no stop
rule tripped, a retry is allowed. Exit 3 to 6 mean stop. The CLI installs a
listener for SIGTERM and SIGINT that aborts the signal it passes to
`runEngine`. It then exits by its own exit code, since Node no longer exits
on those signals once a listener is installed (Node 26 docs, `process`
signal events: "If one of these signals has a listener installed, its
default behavior will be removed (Node.js will no longer exit)", ctx7
`/nodejs/node/v26.0.0`, accessed 2026-11-12).

## 17. Acceptance criteria (Gherkin)

These IDs are local to this story. Every scenario that runs a command does
so in a temporary git repository, never in the real one. Files: states in
`src/states.test.ts`; ledger in `src/ledger.states.test.ts`; stall in
`src/breaker.test.ts`; ceiling in `src/ceiling.test.ts`; input keys in
`src/gate.request.test.ts`; abort in `src/killed.test.ts`; the engine in
`src/engine.test.ts` and `src/blocked.test.ts`; the process in
`src/cli.states.test.ts`.

```gherkin
Scenario: AC-e06s04-01 the table
  Then exitCodes is done 0, failed 1, blocked 3, stalled 4, exhausted 5,
    killed 6 and badInputExitCode is 2
  And no state other than done maps to 0
  And the seven codes are all different

Scenario: AC-e06s04-02 the terminal states
  Then terminalStates is exactly done, blocked, stalled, exhausted, killed
  And "failed" is not one of them

Scenario: AC-e06s04-03 a state line is written and read back
  Given a ledger path in a temporary git repository
  When appendState writes a stalled line with runs 3, failStreak 3,
    threshold 3 and a detail
  Then readLedgerTail has one state with those fields and skipped 0
  And the file is mode 0600 in a directory of mode 0700

Scenario: AC-e06s04-04 a state line is not a run
  Given a ledger with two run entries and one state line
  Then readLedger has two entries and skipped 0
  And countsFor gives the same counts as without the state line

Scenario Outline: AC-e06s04-05 a bad state line is skipped
  Given a ledger with one good entry and a line with <bad>
  When readLedgerTail reads it
  Then it has the good entry and skipped is 1

  Examples:
    | bad                                        |
    | a state name that is not a State           |
    | a missing runs field                       |
    | runs as the string "3"                     |
    | threshold as a string                      |

Scenario: AC-e06s04-06 the tail is capped
  Given a ledger larger than the cap, made of whole entries
  When readLedgerTail reads it with a small maxBytes
  Then truncated is true
  And only entries from the end of the file are returned, each whole
  And the dropped first fragment is not counted in skipped
  And with a cap larger than the file the result equals readLedger's
    entries and truncated is false

Scenario Outline: AC-e06s04-07 reading the tail when the file is odd
  When readLedgerTail reads <path>
  Then the result is <result>

  Examples:
    | path                          | result                              |
    | a path that does not exist    | ok, no entries, no states, skipped 0 |
    | a path that is a directory    | not ok, no throw                    |

Scenario: AC-e06s04-08 failingRun
  Given entries for "a" and "b": a fail, b fail, a pass, a fail, a fail
  Then failingRun for "a" has the last two "a" entries
  And failingRun for "b" has its one entry
  And failingRun for "c" is empty

Scenario: AC-e06s04-09 the stall rule trips on a stuck run
  Given three failed runs of "a" with one fingerprint, reason and exit code
  When checkStall reads them with stallAfter 3
  Then the trip is stalled with threshold 3 and count 3

Scenario Outline: AC-e06s04-10 the stall rule stays quiet
  Given <entries> for "a"
  When checkStall reads them with stallAfter 3
  Then the result is null

  Examples:
    | entries                                                              |
    | only two failed runs on one tree                                     |
    | three failed runs, the fingerprint of the last differs               |
    | three failed runs, the fingerprint of the first differs              |
    | three failed runs, one has another reason                            |
    | three failed runs, one has another exit code                         |
    | three failed runs, all with a null fingerprint                       |
    | two failed runs, a pass, one failed run on the same tree             |
    | three failed runs, but a run of "b" between them (still quiet for b) |

Scenario: AC-e06s04-11 the stall rule follows the tree
  Given failed runs on trees A, A, B, B
  Then checkStall with stallAfter 3 is null
  When another failed run on tree B is added
  Then checkStall trips with count 3

Scenario: AC-e06s04-12 the stall threshold is an input
  Given two identical failed runs
  Then checkStall with stallAfter 2 trips and with stallAfter 3 does not

Scenario: AC-e06s04-13 the ceiling trips at the limit
  Given 4 failed runs of "a"
  Then checkCeiling with maxFailures 5 is null
  When a fifth failed run is added
  Then it is exhausted with threshold 5 and count 5
  And with maxFailures 2 four failed runs are exhausted

Scenario: AC-e06s04-14 a pass ends the count
  Given 4 failed runs, a pass, then 4 failed runs
  Then checkCeiling with maxFailures 5 is null

Scenario Outline: AC-e06s04-15 the input keys
  When parseRequest reads {"command":"true", <field>}
  Then the result is <result>

  Examples:
    | field                      | result                          |
    | "blocked":"need a key"     | ok, request has blocked         |
    | "stallAfter":2             | ok                              |
    | "maxFailures":1            | ok                              |
    | "blocked":""               | not ok                          |
    | "blocked":"  "             | not ok                          |
    | "blocked":5                | not ok                          |
    | "blocked" of 1001 chars    | not ok                          |
    | "stallAfter":1             | not ok                          |
    | "stallAfter":"3"           | not ok                          |
    | "stallAfter":1001          | not ok                          |
    | "maxFailures":0            | not ok                          |
    | "maxFailures":2.5          | not ok                          |

Scenario: AC-e06s04-16 an abort stops the command and its children
  Given a command that starts a background "sleep 30" and waits
  When the signal aborts while it runs
  Then runGate resolves with done false, reason "killed", exit code null
  And no process of that group is alive afterwards
  And the ledger holds a run entry whose reason is "killed"

Scenario: AC-e06s04-17 an aborted signal means no run
  Given a signal that is already aborted
  When runGate runs a command that writes a marker file
  Then the verdict is killed and the marker does not exist

Scenario: AC-e06s04-18 the engine answers done
  When runEngine runs "true"
  Then the state is "done" and done is true
  And the ledger holds one run entry and one done state line with runs 1,
    failStreak 0 and threshold null

Scenario: AC-e06s04-19 a plain failure is failed, not terminal
  When runEngine runs "exit 7" once
  Then the state is "failed", done false, reason "exit-nonzero", exit code 7
  And the ledger holds no state line

Scenario: AC-e06s04-20 the engine answers stalled
  When runEngine runs "exit 7" three times on an unchanged tree
  Then the first two answers are "failed" and the third is "stalled"
  And the stalled line has runs 3, failStreak 3, threshold 3
  And the answer keeps reason "exit-nonzero" and exit code 7
  When a tracked file is edited and "exit 7" runs again
  Then the answer is "failed"

Scenario: AC-e06s04-21 the engine answers exhausted
  Given maxFailures 3 and a tree that changes before each run
  When runEngine runs "exit 7" three times
  Then the third answer is "exhausted", with threshold 3 in its state line

Scenario: AC-e06s04-22 exhausted never gives done
  Given a ledger with five failed runs of the command string "check"
  When runEngine runs "check", now written so that it would pass
  Then the answer is "exhausted", done false, reason "not-run"
  And the command did not run (its marker file does not exist)
  And deleting the ledger file lets the same command give "done"

Scenario: AC-e06s04-23 exhausted outranks stalled
  Given stallAfter 3 and maxFailures 3
  When runEngine runs "exit 7" three times on an unchanged tree
  Then the third answer is "exhausted"

Scenario: AC-e06s04-24 the engine answers blocked
  When runEngine runs {"command":"touch ran","blocked":"need the API key"}
  Then the state is "blocked", done false, reason "not-run"
  And the detail is "need the API key" and the marker "ran" does not exist
  And the ledger holds one blocked state line with that detail and no run
    entry

Scenario: AC-e06s04-25 blocked never gives done
  When runEngine runs {"command":"true","blocked":"x"}
  Then done is false

Scenario: AC-e06s04-26 exhausted outranks blocked
  Given a ledger at the ceiling for "check"
  When runEngine runs "check" with a blocked reason
  Then the state is "exhausted"

Scenario: AC-e06s04-27 the ledger never gives done
  Given a ledger that holds a forged done run entry and a forged done state
    line for "false" at the current fingerprint
  When runEngine runs "false"
  Then the state is "failed", done false, reason "exit-nonzero"

Scenario: AC-e06s04-28 an unreadable ledger turns the rules off, not the gate
  Given "<git dir>/weftwork/ledger.jsonl" is a directory
  When runEngine runs "exit 7" and then "true"
  Then the first answer is "failed" and the second is not done
  And stderr holds a line about the ledger, and nothing throws

Scenario: AC-e06s04-29 the engine answers killed
  Given a signal that aborts while "sleep 30" runs
  When runEngine runs it
  Then the state is "killed", done false, reason "killed"
  And the ledger holds a run entry with reason "killed" and one killed
    state line

Scenario Outline: AC-e06s04-30 every state through the real CLI
  Given a temporary git repository
  When the real CLI is given <input> (after <before>)
  Then the exit code is <exit>
  And stdout is one JSON line whose state is "<state>"
  And, except for failed, the ledger holds a state line of that state

  Examples:
    | input                                    | before            | exit | state     |
    | {"command":"true"}                       | nothing           | 0    | done      |
    | {"command":"exit 7"}                     | nothing           | 1    | failed    |
    | {"command":"true","blocked":"no key"}    | nothing           | 3    | blocked   |
    | {"command":"exit 7"}                     | two same runs     | 4    | stalled   |
    | {"command":"exit 7","maxFailures":2}     | one failed run    | 5    | exhausted |

Scenario Outline: AC-e06s04-31 a real signal kills the run
  Given the real CLI runs "sleep 60 & echo $! > <pidfile>; wait"
  When the CLI gets <signal> after the pidfile exists
  Then it exits with code 6
  And stdout is one JSON line whose state is "killed"
  And the sleep process is gone
  And the ledger holds a run entry with reason "killed" and a killed state
    line

  Examples:
    | signal  |
    | SIGTERM |
    | SIGINT  |

Scenario: AC-e06s04-32 the old scenarios still hold
  Then the e06s01, e06s02 and e06s03 tests pass unchanged
  (cli.test.ts, gate.test.ts, gate.ledger.test.ts, ledger.test.ts,
  cli.ledger.test.ts)
  And Preflight passes
```

## Steps

1. RED: write `src/states.test.ts` (AC-01, AC-02) and record the failure.
   GREEN: write `src/states.ts`
   → verify: `node --test src/states.test.ts && npm run typecheck`
2. RED: write `src/ledger.states.test.ts` (AC-03 to AC-08) and record the
   failures. GREEN: add `failingRun`, `StateEntry`, `appendState`,
   state-line parsing and `readLedgerTail` to `src/ledger.ts`; keep
   `countsFor` and `readLedger` results as they are (ref: threat model C3;
   security review F3)
   → verify: `node --test src/ledger.states.test.ts src/ledger.test.ts && npm run typecheck && ! grep -nE 'shell:|execSync|[^a-zA-Z]exec\(' src/ledger.ts`
3. RED: write `src/breaker.test.ts` (AC-09 to AC-12), record the failure.
   GREEN: write `checkStall` in `src/breaker.ts`
   → verify: `node --test src/breaker.test.ts && npm run typecheck`
4. RED: write `src/ceiling.test.ts` (AC-13, AC-14), record the failure.
   GREEN: add `checkCeiling` and the defaults to `src/breaker.ts`
   → verify: `node --test src/ceiling.test.ts src/breaker.test.ts && npm run typecheck`
5. RED: write `src/gate.request.test.ts` (AC-15) and `src/killed.test.ts`
   (AC-16, AC-17), record the failures. GREEN: add the three input keys, the
   two reasons and the `AbortSignal` to `src/gate.ts`; move `isAlive` into
   `src/test-helpers.ts` (ref: threat model C7)
   → verify: `node --test src/gate.request.test.ts src/killed.test.ts src/gate.test.ts src/gate.ledger.test.ts && npm run typecheck && ! grep -nE 'readLedger|countsFor' src/gate.ts`
6. RED: write `src/engine.test.ts` and `src/blocked.test.ts` (AC-18 to
   AC-29), record the failures. GREEN: write `src/engine.ts`
   → verify: `node --test src/engine.test.ts src/blocked.test.ts && npm run typecheck && ! grep -nE 'shell:|execSync|[^a-zA-Z]exec\(' src/engine.ts`
7. RED: write `src/cli.states.test.ts` (AC-30 to AC-32), record the
   failures. GREEN: change `src/cli.ts` to call `runEngine`, map the state
   to the exit code and forward SIGTERM and SIGINT; update its header
   → verify: `node --test src/cli.states.test.ts && npm run typecheck && npm test`
8. Run the Preflight line from AGENTS.md, then `security-review` on the diff
   (AC-32). Mutation checks from the Verification Script
   → verify: `yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test`

## 4. Dependencies (slopcheck)

- `node:fs/promises` (`open`, and the ones `ledger.ts` already uses),
  `node:child_process`, `node:path`, `node:util`: built into Node 26. `[OK]`.
- `AbortController` and `AbortSignal`, and `process.on('SIGTERM')`: Node
  built-ins (Node 26 `process` docs, ctx7 `/nodejs/node/v26.0.0`, accessed
  2026-11-12). `[OK]`.
- The `git` program on the PATH, as in e06s02 and e06s03. Not a package.
- No new npm package.

## 5. Out of scope

- A run id, a reset command, and a restart rule after a terminal state
  (e08, e09). Today the owner deletes the ledger file.
- The budget setting, ceilings over the whole loop, spend and turn caps,
  and ledger rotation (e09). This story holds only the cap on failed runs.
- Capturing command output, hashing it, and any output cap (decision 1).
- Forwarding the original signal and waiting for the command to clean up
  (decision 4). SIGHUP, SIGQUIT and any other signal: the engine does not
  handle them. A SIGHUP ends the engine with no killed record, and the
  command, in its own process group, keeps running (host adapters, e07).
- The escape hatch and how it meets `exhausted` (e06s05).
- Redaction of secrets in a stored command or a blocked text (e10).
- Reading counts or states from the CLI, and any flag for the ledger path.
- A lock between two engines that run at once in one repository.
- A host's rule for which exit codes block (e07, threat model T7).

## 6. Risks

- **The agent can edit the ledger (threat model T3).** It can erase failed
  runs, so the breaker and the ceiling never trip, or add fake failed runs,
  so the engine answers `exhausted` and refuses to run. The first defeats a
  stop rule; the second is a denial of service. Neither makes `done`: the
  gate never takes `done` from the ledger (C4, AC-27). Do not describe the
  ledger or the stop rules as tamper proof. Real protection needs a path the
  agent cannot write, for e07 and e10.
- **A false trip blocks correct work (R15 [S14]).** Three identical failed
  runs on one tree is a stuck run, but a failing check that waits on
  something outside the tree (a flaky network) looks the same. The answer is
  a handover, with the counts in the state line. The thresholds are
  unmeasured defaults; R10 measures them. Detect: a `stalled` line whose
  command passes when run by hand.
- **A command that edits the tree on each run hides the stall.** Its
  fingerprint differs every time, so `stalled` never trips. The ceiling still
  stops the run.
- **Exhausted needs the owner.** Exit 5 with reason `not-run` means the
  ceiling is reached and the command no longer runs. The owner deletes
  `<git dir>/weftwork/ledger.jsonl` to restart, which also drops the history.
  A stale ledger from an earlier story can lock out a new one. Detect: exit 5
  on the first call of a new story. e08 and e09 own a proper run boundary.
- **The tail cap can blind the stop rules.** The reader takes the last
  1 MiB. A ledger whose recent lines are very long (a command string can be
  up to the 1 MiB input cap) leaves fewer than N entries in the window. The
  engine writes a line on stderr when the tail is `truncated`.
- **A signal kills at once.** SIGKILL on the group gives a command no chance
  to clean up. A command that starts its own session (`setsid`) leaves the
  group and survives (threat model T6 residual, e09 and e10).
- **A signal during the second fingerprint.** If the command already ended,
  the verdict stands and the engine finishes normally. The signal is not
  lost; it is just late.
- **`failed` is not a stop.** A host that reads exit 1 as a stop, or exit 3
  to 6 as a retry, breaks the loop's guarantee. e07 must check each host's
  rule (T7). All of 1 to 6 are non-zero, so none reads as a pass.
- **Two ledger reads and three git calls per run.** One read before the
  run, one after, and `ledgerPath` is called by the engine and again by
  `runGate`. Cheap next to the command, and each read is capped.
- **Re-review trigger.** Run `security-review` on this diff (the signal
  handling and the tail reader). Add the trigger to the threat model.

## Verification Script (human)

1. In a scratch git repository, a stalled run:
   `R=$(pwd); cd $(mktemp -d) && git init -q && echo a > f && git add f && git -c user.name=t -c user.email=t@e.invalid commit -qm i && for i in 1 2 3; do echo '{"command":"exit 7"}' | node $R/src/cli.ts; echo "exit=$?"; done`
   prints exit 1, 1, 4, and the third line has `"state":"stalled"`.
2. Start from an empty ledger (`rm .git/weftwork/ledger.jsonl`), run `exit 7`
   three times (stalled, exit 4), then `echo x >> f` and run `exit 7` again:
   it prints `"state":"failed"` and `exit=1`. The stall count restarts with
   the tree, but the default ceiling of 5 still counts all failures in a row,
   so the fourth failure is below it.
3. Exhausted: `rm .git/weftwork/ledger.jsonl; for i in 1 2; do echo '{"command":"exit 7","maxFailures":2}' | node $R/src/cli.ts; echo "exit=$?"; done`
   prints exit 1 then exit 5. Then `echo '{"command":"exit 7","maxFailures":2}' | node $R/src/cli.ts; echo "exit=$?"`
   prints `"reason":"not-run"` and exit 5, and the command did not run. The
   ceiling is per command, so `echo '{"command":"true","maxFailures":2}' | node $R/src/cli.ts`
   is done and exits 0. After `rm .git/weftwork/ledger.jsonl` the `exit 7`
   line prints `"state":"failed"` and exit 1 again.
4. Blocked: `echo '{"command":"touch ran","blocked":"need the API key"}' | node $R/src/cli.ts; echo "exit=$?"; ls ran`
   prints exit 3, `"detail":"need the API key"`, and `ls` says no such file.
5. Killed: `node $R/src/cli.ts <<< '{"command":"sleep 60"}' & P=$!; sleep 1; kill -TERM $P; wait $P; echo "exit=$?"; pgrep -f 'sleep 60'`
   prints a `"state":"killed"` line, `exit=6`, and `pgrep` prints nothing.
   Repeat with `kill -INT $P`. Check the child by its pid, not with `pgrep -f`,
   which also matches the shell that runs the check. A signal while the CLI
   still waits for stdin must exit 6 at once, with `"state":"killed"` and no
   ledger line. The test `src/cli.signal.test.ts` does this with a real signal
   and an open pipe.
6. `cat .git/weftwork/ledger.jsonl` shows run lines and state lines with
   `runs`, `failStreak`, `threshold` and `detail`.
7. Mutation checks (anti-vacuity): copy `src` to a scratch directory (with
   `package.json` and `tsconfig.json`), then in the copy (a) make
   `checkStall` return null and run `node --test src/breaker.test.ts` and
   `src/engine.test.ts`; (b) make `checkCeiling` return null and run
   `src/ceiling.test.ts`; (c) remove the abort listener in `watchChild` and
   run `src/killed.test.ts`. Each must fail. Delete the copy.
