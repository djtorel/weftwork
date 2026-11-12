# Audit: e06s04 (name the five terminal states and trip a no-progress breaker)

Story: e06s04
Branch: e06s04-terminal-states-breaker
Diff: git diff main...HEAD -- src (24 files)
Mode: default (full checklist)
Result: PASS after fixes (see "Fixed during this audit")

## Look-here-first (churn)

`bp-churn-rank.sh --since 90.days` ranked the spec and state files first. The
code hotspots were the e06 engine files, all new in this story. They were
read in full: src/engine.ts, src/cli.ts, src/gate.ts, src/process.ts,
src/ledger.ts, src/breaker.ts, src/states.ts, src/json.ts.

## Checklist

### Supply Chain & Security
- ✓ slopcheck: no new dependency. package.json and the lock file are unchanged.
- ✓ No `[SLOP]` package.
- ✓ No secrets in the diff (grep for sk-, ghp_, AKIA and .env values: none).
- ✓ OWASP spot-check. Injection: the declared command runs through a shell
  by design (C1, C2); no other string reaches a shell. Sensitive data: the
  ledger stores the command string (T8), documented in the CLI header and the
  spec. Misconfiguration: the ledger is mode 0600 in a 0700 directory (F2).
- ✓ Security scan (verify-work step 5): no HIGH finding. F4 (MEDIUM) fixed in
  4e03219 with tests. F5 (LOW residual) is in specs/security/REVIEW.md, owned
  by e08 or e09.

### Provenance & Metadata
- ✓ The story spec and tasks file carry type, context and risk.
- ✓ Steps reference the threat model controls (C2, C4, C7, F3). The spec
  references the owner decisions by date.

### Law of Demeter
- ✓ No method chain through an unrelated object in the new code (grep for
  `).x().y(`: none). `stdin.on(...).on(...)` is one object's fluent API and is
  allowed.

### CONVENTIONS.md Compliance
- ✓ Output files are in specs/ and src/. No file was written to the project root.
- ✓ No `gh issue create` anywhere in the diff.
- ✓ No `gh` call in this story.
- ✓ No call to api.github.com in the diff.

### Scope
- ✓ The changes are the e06s04 tasks, the F4 fix (a security finding of this
  story) and the refactor the checklist requires (see below).
- ✓ No speculative feature. The engine answers five terminal states and the
  spec's out-of-scope list is respected: no run id, no budget ceiling, no
  output capture, no escape hatch.
- ✓ No file outside the stated scope. test-helpers.ts gained isAlive and the
  readers the spec named.
- ✓ No open reproducible gate failure. Preflight is green at 196 tests.
- ✓ Boy Scout: the files touched are cleaner than before (see below).

### Boy Scout Rule
- ✓ Every touched file is cleaner. Long functions split, duplication removed.
- ✓ No dead code. Every new function has a caller (grep counts 2 or more).
- ✓ No commented-out code (the one hit is prose: "An abort stops the command").

### Types and Safety
- ✓ No `any`. No `@ts-ignore` or `eslint-disable`. No `as unknown as`.
- ✓ Casts in new code: `state as State` in src/ledger.ts follows the check
  `knownStates.includes(state)`, so the cast is backed by a runtime check. The
  `as string` and `as Record` casts are in tests, on values the test just made.
- ✓ tsconfig is unchanged and strict. `npm run typecheck` exit 0.

### Test Coverage
- ✓ Every new function has at least one test: states (table), ledger
  (appendState, failingRun, readLedgerTail, tailText through the tail tests),
  breaker (checkStall, checkCeiling), process (runCommand, armKill, watchChild
  through gate and killed tests), engine (runEngine, refusedBeforeRun,
  classify, logState, readEntries through engine and blocked tests), cli
  (readInput, readEvents, listenStdin through cli.signal and cli.states),
  json (isRecord and isInteger through the parse and ledger tests).
- ✓ Bug fix F4 has a regression test: src/cli.signal.test.ts (SIGTERM and
  SIGINT with stdin open).
- ✓ Tests go through public interfaces (runEngine, runGate, parseRequest,
  readLedgerTail, the real CLI). They do not reach into private helpers.
- ✓ F.I.R.S.T: each test runs in a temporary git repository. The F4 test
  waits 1.5 s before the signal, documented in the file (startup is about
  200 ms, and a signal that arrives first gets the default action). No test
  depends on another's state.

### SOLID and Heuristics
- ✓ Single responsibility: src/process.ts holds child-process control, and
  src/gate.ts keeps the verdict rules. src/engine.ts orders the checks and
  logs. src/breaker.ts holds the stop rules. src/cli.ts is a thin shell.
- ✓ Open/closed: the stop rules are pure functions over ledger entries, so a
  new rule is an added function, not an edit to the engine.
- ✓ Dependency inversion: the engine takes the gate, the ledger and the
  request as arguments and uses the module functions directly. Tests use
  real temporary repositories, not mocks, except stderr.
- ✓ HEURISTICS.md (C, E, F, G, N, T) checked against the diff. The rules
  below were fixed. The rest are met:
  - F1 (arguments, never more than 3): armKill took four. It now takes one
    limits object. No new function has more than three.
  - F2 (output arguments): armKill mutated a flags object it was given. It
    now returns its own flags. Fixed.
  - G5 (duplication): isRecord was in gate.ts and ledger.ts. isInteger and
    isCount were duplicated too. They now live in src/json.ts. Fixed.
  - G30 (one thing): watchChild and readInput each did several things. They
    now delegate to armKill and listenStdin/readEvents. Fixed.
  - G29 (negative conditionals): the remaining `if (!x)` are guard clauses on
    positive predicates (`!isTimeout(x)`, `!read.ok`), which are early returns.
    G29 targets negatively named predicates, and the diff adds none. The CLI
    main branch was rewritten positively.
  - G25 (magic numbers): the caps and thresholds are named (maxInputBytes,
    maxBlockedLength, maxThreshold, ledgerReadCap, defaultStallAfter,
    defaultMaxFailures). The file modes 0700 and 0600 are named by their use.
  - C5 (commented-out code): none.
  - T9 (fast tests): the suite runs in about 2.5 s. The two slow tests are the
    real-process timeouts, which are bounded.

### Refactoring Smells (Fowler)
- Checked: Mysterious Name (none; names are the spec's terms), Duplicated
  Code (fixed, see above), Feature Envy (none), Data Clumps (the timeout and
  signal pair is passed as one limits object, fixed), Primitive Obsession
  (the states are a string-literal union, not loose strings), Message Chains
  (none), Middle Man (none).

### Code Style (CONVENTIONS.md)
- ✓ Functions: 20 lines or fewer. A scan of every non-test src file found
  none over 20 lines. This was the largest fix (readInput 35, parseRequest
  31, watchChild 28, readLedgerTail 23, runEngine 22, readEvents 27).
- ✓ Files: 300 lines or fewer. The largest is src/ledger.ts at 295, close to
  the cap. e09 will add rotation there, so split it then.
- ✓ Names: unique enough, no name with 5 or more hits in new code.
- ✓ Early returns over nested ifs. Nesting is at most 2 levels in the new code.
- ✓ Comments explain WHY (the F4 reason, the per-command ceiling, why the
  kill is a whole group).

## Fixed during this audit

1. Long functions split (see Code Style): readInput, parseRequest,
   watchChild, readLedgerTail, runEngine, readEvents. Child-process control
   moved to src/process.ts, which keeps gate.ts under 300 lines. Commit b561f3e.
2. isRecord, isInteger and isCount shared in src/json.ts. Commits b561f3e and 058d659.
3. armKill: arity reduced to two; the output argument removed. Commit 058d659.
4. CLI main branch positive. Commit 058d659.
5. F4 test: startup wait raised to 1.5 s. The first run was racing the CLI's
   startup. Commit 058d659.

## Red flags caught

- "The tests pass, so the refactor is safe." It was not enough for the
  refactor: the F4 SIGINT test failed on the first run. The fix was the wait,
  not the product, and the cause is recorded in the test.
- "A cast is fine, the code is correct." The `state as State` cast was
  checked: it follows a runtime check, so it stays, and the reason is noted.
- "G29 says no negatives, so every `if (!x)` must go." Rejected: guard
  clauses on positive predicates are early returns. Only a negatively named
  predicate would be a G29 breach, and there are none.

## Verdict

PASS. The checklist items are met after the five fixes above. Preflight is
green at 196 tests (exit 0, commit 058d659). Next: request-review for an
independent second opinion.
