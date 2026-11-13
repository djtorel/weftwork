# Audit: e08s01 (a caller sets one field of a state file and nothing else changes)

Story: e08s01
Branch: e08s01-state-writer
Diff: git diff aac82fa..HEAD -- src package.json package-lock.json AGENTS.md,
  at d9050f7 before the audit fixes
Mode: default (full checklist)
Churn: bp-churn-rank.sh ranks only spec and state files and AGENTS.md. The
  new files (regular-file.ts, state-file.ts, state-cli.ts and their tests)
  were read in full; the changed ones (claude-settings-file.ts, tree.ts)
  were read at the diff and around it.
Result: PASS. Seven items were fixed in this audit (2242b19, 5d8a0e1).

## Checklist

### Supply Chain & Security
- ✓ slopcheck: yaml 2.9.1 tagged `[OK]` in the spec, section 4 (ISC, no
  dependencies, published 2026-09-11, exact pin, lockfile sha512).
- ✓ No `[SLOP]` or `[SUS]` packages.
- ✓ No secrets in the diff (grep for key, token and private-key shapes; the
  only hits are CST token names).
- ✓ OWASP spot-check: the file must resolve inside the repository root; no
  symlink, FIFO or oversized file is read; the write is a temp file and a
  rename, so a hard link is not written through; no shell is involved.
- ✓ Security: no HIGH finding at confidence 8 or more. F1 (LOW, alias bomb)
  is fixed (specs/security/REVIEW.md, section e08s01-state-writer).

### Provenance & Metadata
- ✓ Spec and tasks file have `type: feat` and `context: engine`.
- ✓ Decisions are in the spec's "Owner decisions" block with the date and
  the spike numbers; the F1 fix cites its commits in the verify evidence.

### Law of Demeter
- ✓ No chains through unrelated objects. The longest is
  `CST.resolveAsScalar(entry.key)?.value`, a value the call returns.

### CONVENTIONS.md Compliance
- ✓ Outputs are in specs/; the fixtures are test data in src/fixtures/.
- ✓ No `gh issue create`, no `gh` in code, no direct GitHub REST call.
- ✓ Errors are returned values; the only throw (yaml's alias guard) is now
  caught and returned (F1).
- ✓ Every commit has the `Story: e08s01` trailer and no AI attribution.

### Scope
- ✓ Changes are the files the plan named: regular-file.ts (moved helpers),
  state-file.ts, state-cli.ts, the `repositoryRoot` export in tree.ts, the
  AGENTS.md line, and the F1 fix the security review asked for.
- ✓ No speculative features: no folding, no new keys, no lock (spec
  section 5).
- ✓ Discovered defects: none open. Preflight is green at every step.

### Boy Scout Rule
- ✓ claude-settings-file.ts lost 79 lines of helpers to regular-file.ts and
  kept its names; its header says where they went.
- ✓ No dead code, no commented-out code.

### Types and Safety
- ✓ No `any`, `@ts-ignore` or `eslint-disable`.
- ✓ Fixed in this audit: `docs[0] as Document` is now an undefined check,
  and `path as string[]` is now a type predicate in `every`.
- ✓ One cast remains, `chunk as Buffer` in state-cli.ts: the stdin iterator
  is typed `any`, and with no encoding set every chunk is a Buffer. A
  comment now says so.

### Test Coverage
- ✓ Every new function has a test through a public interface:
  readRegularFile and writeAtomic (regular-file.test.ts), setField
  (state-file.test.ts), writeStateField and the CLI (state-cli.test.ts, as a
  real process), repositoryRoot (the CLI's not-a-repository case).
- ✓ Fixed in this audit: the 1 MiB caps on stdin and on the state file had
  no test. Both cases now exist and each fails when its cap is raised to
  8 MiB (checked by hand, then restored).
- ✓ The F1 bug fix has a regression test in both test files.
- ✓ F.I.R.S.T: tests use temporary directories and repositories, never this
  repository's files except the read-only round trip of specs/state.yaml
  (AC-06); the FIFO read runs in a child with a timeout.

### SOLID and Heuristics
- ✓ Single responsibility: regular-file.ts holds file rules, state-file.ts
  the YAML edit and the file operation, state-cli.ts the shell.
- ✓ Open/closed: claude-settings-file.ts calls the shared helpers through
  the same exported names; its callers did not change.
- ✓ Dependency inversion: the library takes the root as an argument; only
  the CLI asks git for it.
- ✓ Heuristics: fixed G34 and N4 below.

### Refactoring smells (Fowler)
- Fixed: **Mysterious Name.** `edit`, `holds`, `answer` and `dataOf` were
  too generic to grep, and `parseRequest` in state-cli.ts shadowed the
  exported one in gate.ts. Now `editScalar`, `holdsData`, `printAnswer`,
  `toData` and `parseFieldRequest`, and `dataWithField` in the test.
- Fixed: **Duplicated Code.** The before-and-after snapshot in
  state-cli.test.ts is one helper.
- None found: Feature Envy, Data Clumps, Primitive Obsession, Message
  Chains, Middle Man.

### Code Style
- ✓ Fixed in this audit: `setField` was 21 lines; the style-retry loop is
  now `firstEditThatHolds`, and `setField` is 15.
- ✓ Files under 300 lines (largest new: state-file.ts at 157).
- ✓ Early returns; at most two levels of indentation in the new code.
- ✓ Comments say why: the CST choice, the type check, the alias guard, the
  symlink and FIFO rules.
- Note: several helpers are under 4 lines (`sourceOf`, `isValue`,
  `printAnswer`). That matches the rest of src/ and splitting them further
  would not help; kept.

## Red flags

- I nearly passed the `chunk as Buffer` cast as "the typings make me do it"
  without a word in the code; it now has a comment, and it is the only cast
  left.
- I nearly accepted the cap tests because they passed at once. A test that
  passes at birth may not test anything, so each was checked against a
  raised cap.
- Not skipped: every checklist item above was checked against the code.

## Evidence

- Preflight at 5d8a0e1: exit 0, 486 of 486 tests.

VERDICT: PASS

## Addendum: re-check at release head 3f2e2b4

The five review rounds changed src/ after this audit (d8aa880..3f2e2b4).
The checklist was re-run on the final code:

- ✓ Files under 300 lines: state-file.ts 299, regular-file.ts 115,
  state-cli.ts 76.
- ✓ No function over 20 lines in the new or changed modules.
- ✓ No `any`, `@ts-ignore` or `eslint-disable`; the one cast (`chunk as
  Buffer`) has its comment.
- ✓ Every review fix landed test-first: a RED commit checked by
  verify-tdd-red-commit.sh, then GREEN (rounds 1 to 5).
- ✓ Failure moved to errors.ts, so the pure install edit no longer imports
  the file module for a type; one import per module.
- ✓ Coverage (node --experimental-test-coverage): 99.27% lines and 96.09%
  branches overall; state-file.ts 98.66% lines, regular-file.ts 95.65%. The
  uncovered lines are defensive catch blocks.
- ✓ Preflight at 3f2e2b4: exit 0, 494 of 494 tests.

VERDICT: PASS
