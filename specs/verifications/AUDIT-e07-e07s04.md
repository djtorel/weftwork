# Audit: e07s04 (check that the hook is live)

Story: e07s04
Branch: e07s04-live-check
Diff: git diff 28c371f..HEAD -- src (13 files), at 870fa40
Mode: default (full checklist)
Churn: bp-churn-rank.sh ranks only spec and state files. The new files
  were read in full; the changed ones (claude-install.ts, claude-hook-cli.ts,
  ledger.ts, claude-install-cli.ts) were read at the diff and around it.
Result: PASS. Six items were fixed in this audit (two commits, below).

## Checklist

### Supply Chain & Security
- ✓ slopcheck: no new packages (Node built-ins only, spec section 4).
- ✓ No `[SLOP]` packages.
- ✓ No secrets in the diff (grep for sk-, ghp_, AKIA, private keys: no hits).
- ✓ OWASP spot-check: files the agent can replace are opened non-blocking,
  only as regular files, never through a symlink, and the record write
  refuses a hard link; printed text has its control characters escaped.
- ✓ Security: no HIGH finding at confidence 8 or more. F1 (MEDIUM) and F2
  (LOW) are fixed (specs/security/REVIEW.md, section e07s04 and addendum).

### Provenance & Metadata
- ✓ Spec has `type: feat` and `context: adapter`.
- ✓ Decisions are in the spec's "Owner decisions" block with the date; the
  security fixes cite their commits in the REVIEW.md addendum.

### Law of Demeter
- ✓ No chains through unrelated objects. The longest is
  `parseStopHook(hook)?.cliPath`, a value the call returns.

### CONVENTIONS.md Compliance
- ✓ Outputs are in specs/.
- ✓ No `gh issue create`, no `gh` in code, no direct GitHub REST call.

### Scope
- ✓ Changes are the story's files, the ones the plan named (the split of
  claude-install.ts, one call in claude-hook-cli.ts, one `export` in
  ledger.ts), and the security fixes the owner chose in verify-work.
- ✓ No speculative features: no managed-settings read, no start-and-end
  record pair, no change to the install's notes (all out of scope in the
  spec).
- ✓ Discovered defects: none. Preflight is green (see the end).

### Boy Scout Rule
- ✓ claude-install.ts went from 299 to 199 lines; the entry match is now one
  parser instead of a prefix test and a regex.
- ✓ No dead code: `tsc --noEmit --noUnusedLocals --noUnusedParameters` is clean.
- ✓ No commented-out code.

### Types and Safety
- ✓ No `any`, `@ts-ignore`, `eslint-disable` or `as unknown as X` in the diff.

### Test Coverage
- ✓ Every new exported function has a test: `parseStopHookCommand`
  (claude-install.parse.test.ts), `lastCallPath`, `writeLastCall`,
  `readLastCall` (last-call.test.ts), `liveReport` (claude-live.test.ts),
  `readSettings` with `follow` and the CLI (claude-live-cli.test.ts), the
  adapter's record (claude-hook-cli.test.ts). `parseStopHook` is reached
  through the install's and the check's tests.
- ✓ Each security fix has a regression test that failed first (a125fed, b548a4e,
  97c06c5).
- ✓ Tests use public interfaces, temporary directories and temporary HOME and
  CLAUDE_CONFIG_DIR; none reads this machine's settings.
- ✓ F.I.R.S.T: each test builds its own repository; checked by hand.
- ✓ Red before green: RED commits 91ce5f6, 988537d, 52c3395, a3a7ee6, 20b39fd,
  a125fed, b548a4e, 97c06c5. The RED gate script skips outside fix_bug.

### SOLID and Heuristics
- ✓ Single Responsibility: liveReport is pure; the CLI reads and prints;
  last-call.ts owns the record's shape and its safe open.
- ✓ Open/Closed: a new answer case is one step in rawReport.
- ✓ Dependency Inversion: the check takes `exists`, `now` and the reads as input.
- ✓ Heuristics: F1 (≤3 arguments) fixed in a test helper; G5 fixed (below);
  G29 as in e07s03 (single `!` early returns, kept by the owner's earlier
  decision); T5 (boundaries) fixed for the age text.

### Refactoring Smells (Fowler)
- **Duplicated Code, fixed:** the check repeated the install's "command hook
  with a string command" test before parsing. Both now use `parseStopHook`.
- **Mysterious Name, fixed:** `seen`, `registered` and `decide` matched plain
  words 6 to 13 times; renamed `answerFromRecord`, `weftworkEntries`,
  `rawReport` (2 hits each).
- **Data Clumps, fixed:** the test helper `run` took five arguments; it now
  takes the argv and one `At` value.
- Feature Envy, Message Chains, Middle Man, Primitive Obsession: none found.

### Code Style (CONVENTIONS.md)
- ✓ Functions: every function and test in the 11 touched files is 20 lines
  or fewer, with at most 3 arguments (measured by script). Fixed:
  `decide` (22), the CLI's `main` (23), the precedence test (32).
- ✓ Files: all under 300 lines (largest touched: ledger.ts 289, one word changed).
- ✓ Names: each new name has fewer than five hits except `lastCallPath`
  (5: one definition, two imports, two calls).
- ✓ Early returns; at most two levels of indentation.
- ✓ Comments say why (F1 and F2 references, BUG-007, the docs read for
  disableAllHooks precedence).

### Red Flags
- I nearly passed the names check on the first grep. `seen` and
  `registered` had 13 hits each; renamed.
- I nearly treated the age test as covered by the 2-minute case. Only one
  unit was tested; added a test and checked it against a mutant.
- The audit's refactor changed code after the owner's manual run. The change
  is structure only (no output text changed), and the CLI tests that drive
  the same steps as the manual script pass.

## Fixes made in this audit

- refactor(adapter): audit fixes for the live
  check's style and names
- test(adapter): pin the age units of the last call in the live report

## Verdict

PASS.
