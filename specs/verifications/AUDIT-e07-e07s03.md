# Audit: e07s03 (install registers the Stop hook)

Story: e07s03
Branch: e07s03-install-stop-hook
Diff: git diff main...HEAD -- src (the four install files), plus the
  uncommitted changes from this audit (the refactor below and the verify
  script and evidence file from verify-work).
Mode: default (full checklist)
Churn: bp-churn-rank.sh ranks only spec and state files. The four src files
  are new in this story, so each was read in full.
Result: PASS. Two judgement calls were resolved by the owner (see below).

## Checklist

### Supply Chain & Security
- ✓ slopcheck: no new packages (Node built-ins only, plan-work section 4).
- ✓ No `[SLOP]` packages.
- ✓ No secrets in the diff (grep for sk-, ghp_, AKIA, api.github.com, gh issue: no hits).
- ✓ OWASP spot-check: command injection is covered by shellQuote (tested
  through sh); the settings file is refused unless it is a regular file, and
  O_NOFOLLOW stops a symlink being read.
- ✓ Security: no HIGH finding at confidence 8 or more (specs/security/REVIEW.md, section e07s03).

### Provenance & Metadata
- ✓ Spec has `type: feat` and `context: adapter`.
- ✓ Decisions are recorded in the spec's "Owner decisions" block, with the
  date. The story has no ADR or commit SHA to point to; the spec is the record.

### Law of Demeter
- ✓ No chains through unrelated objects. The longest is `group.hooks.some(...)`,
  which is the group's own list.

### CONVENTIONS.md Compliance
- ✓ Outputs are in specs/ (the verify evidence and the audit report).
- ✓ No `gh issue create`; no `gh` use in the code.
- ✓ No direct GitHub REST call.

### Scope
- ✓ Changes are the four install files and the story's spec, tasks and verify files.
- ✓ No speculative features. No uninstall, no `--project` option (both out of scope in the spec).
- ✓ No files outside the stated scope.
- ✓ Discovered defects: none. Preflight is green (372 of 372 tests).
- ✓ Boy Scout: the refactor removed the long functions and the four-argument helper.

### Boy Scout Rule
- ✓ Every touched file is cleaner than before.
- ✓ No dead code: `tsc --noUnusedLocals --noUnusedParameters` passes on the four files.
- ✓ No commented-out code.

### Types and Safety
- ✓ No `any`.
- ✓ No `@ts-ignore` or `eslint-disable`.
- ✓ No `as unknown as X`. The one `as unknown` is in a test helper, `JSON.parse(...) as unknown`, which the test then narrows.

### Test Coverage
- ✓ Every new exported function has a test: `shellQuote` and `stopHookCommand`
  directly (the quote round-trip through sh), `installStopHook` (AC-01 to AC-06),
  `installInProject` and the CLI (AC-07 to AC-10, with symlink, FIFO and directory cases).
- ✓ Private helpers are reached through those public functions.
- ✓ Tests use the public interface and temporary directories only.
- ✓ F.I.R.S.T: each test sets up its own directory and is repeatable. Not
  run through enforce-first; checked by hand against the rubric.
- ✓ Red before green: the RED commits are 10c8be0 and 6889d1b (see the branch log).

### SOLID and Heuristics
- ✓ Single Responsibility: the edit is pure (`installStopHook`), and the file
  I/O is separate (`installInProject`, `readSettings`, `writeAtomic`).
- ✓ Open/Closed: a new entry shape needs a change in one place (`stopHookCommand`).
- ✓ Dependency Inversion: the adapter path is passed in, not read from a global.
- ✓ Heuristics (audit-code/HEURISTICS.md):
  - F1 (≤3 arguments): **fixed.** `editHooks` had four arguments. They are now
    three, with `cliPath` and `entry` bundled as `Install`.
  - G5 (duplication): one small duplication left, in the tests (see Refactoring smells).
  - G25 (named constants): `hookTimeoutSeconds` is named. The file modes
    `0o644` and `0o777` are the usual POSIX values and are left as literals.
  - G29 (negative conditionals): see "Items for the owner".
  - G34 (one level of abstraction): each function calls helpers one level down.
  - C5 (commented-out code): none. T5 (boundaries): blank command, empty
    text and malformed JSON are tested.

### Refactoring Smells (Fowler)
- **Data Clumps, fixed:** `cliPath` and `entry` travelled together through
  four functions. They are now one `Install` value.
- **Mysterious Name, fixed:** the local `done` became `inserted`.
- **Duplicated Code, left:** `stopGroups` (claude-install.test.ts) and
  `firstStopGroup` (claude-install-cli.test.ts) read the same structure. Two
  small helpers in two files; left as is.
- Feature Envy, Message Chains, Middle Man, Primitive Obsession: none found.

### Code Style (CONVENTIONS.md)
- ✓ Functions: every function is 20 lines or fewer, counted from its signature to its closing brace.
- ✓ Files: claude-install.ts is 284 lines (under 300); the others are under 200.
- ✓ Names: checked by grep; each name has fewer than five hits.
- ✓ Early returns; indentation no deeper than two levels inside a function.
- ✓ Comments say why (the BUG-007 reference, the untrusted-input note, the
  reason for the temporary file and rename).

### Red Flags
- I nearly marked the test files as exempt from the 20-line rule. The existing
  test files keep every test under 20 lines, so the rule applies. Four tests
  were trimmed.
- I nearly marked G29 as passed without checking. There are fourteen single `!`
  guards. See "Items for the owner".

## Items for the owner (both resolved 2026-11-12)

1. **G29, negative conditionals: kept.** The new code has fourteen single `!`
   guards, such as `if (!isGroup(item)) return null`. They are early returns,
   not double negatives. Flipping them would nest the code and break the
   early-return and two-level rules. The owner accepted this ("do your
   recommendations").
2. **The code changed after the owner's UAT: re-checked.** The refactor in this
   audit changed the code after the UAT. The install was re-run on the final code
   in a scratch clone: `added`, then `unchanged`, with one Stop entry and
   `timeout: 660`. Recorded in e07s03-verify.yaml. Steps 4 and 5 were not
   repeated: the entry's text is unchanged and the tests pin it.

## Verdict

PASS. Both items resolved.
