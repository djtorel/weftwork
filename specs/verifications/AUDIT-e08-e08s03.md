# Audit: e08s03, the engine writes the handoff note

**Story:** e08s03
**Branch:** e08s03-handoff-note
**Diff:** `git diff main` plus the untracked new files (main at 6722344; 9 commits up to bf224b9, then the uncommitted audit refactor and request-review fixes)
**Mode:** default (full checklist), run by audit-code, the coding agent's self-review
**Run:** second audit, 2026-11-13, after five request-review rounds
**Result:** PASS after one fix made in this audit (three dead exports)

## History

The first audit (at bf224b9) failed five items and fixed them: `state-file.ts`
over 300 lines (split into `state-write.ts` and `state-mapping.ts`), a copied
stdin reader (shared), two functions over 20 lines, a dead export, and a
missing decision reference. Request-review then ran its five-round cap
(scores A/B 72/83, 78/67, 91/88, 96/90, 95/92; no must-fix in rounds 3 to 5).
The owner waived the AND-gate for e08s03 and the round-5 fixes were made
without another review (waiver in `specs/state.yaml`). This audit checks the
code as it now stands.

## Failed and fixed in this audit

1. **Dead exports (Boy Scout).** `readStdin`, `JsonRequest` and
   `maxInputBytes` in `src/cli-io.ts` were exported but used only inside it
   (the CLIs call `readJsonObject` and `printAnswer`). They are now private.
   `maxInputBytes` looked used because `src/cli.ts` (e06) has its own constant
   of that name. `StateFields` in `src/state-fields.ts` was already exported
   on main and is left as it was.

## Checklist

### Supply Chain & Security
- ✓ No new dependencies (`package.json` and `package-lock.json` unchanged).
- ✓ No secrets in the diff or the new files (grep for `sk-`, `ghp_`, `AKIA`).
- ✓ OWASP spot-check: `specs/security/REVIEW.md` (section e08s03 and its
  addendum after the review rounds): no finding at confidence 8 or more.
- ✓ No unaddressed HIGH finding. A1 (`git status` runs a clean filter named
  in `.git/config`) is an owner-accepted risk owned by e10.

### Provenance & Metadata
- ✓ `e08s03-handoff.md` has `type:` and `context:`; the tasks file has `risk:`
  and `allure:` per task.
- ✓ Decisions are recorded in spec §1 (decisions 1 to 5 at plan-work, commit
  6bb3791; decision 6 in request-review round 3) and cited where the code
  implements them.

### Law of Demeter
- ✓ No chains through unrelated objects in the story's code. The only long
  chain in a touched file is the e06 hash builder in `tree.ts`, which calls
  the same object.

### CONVENTIONS.md Compliance
- ✓ Output files are in `specs/`, `src/` and `docs/`; nothing new in the root.
- ✓ No `gh`, `gh issue create` or `api.github.com` in the changed files.

### Scope
- ✓ The changes are the story's: the mapping edit, the handoff writer, its
  CLI, `uncommittedPaths`, the docs, and the hardening that review asked for.
- ✓ Files outside the original task list changed only to carry that work:
  `state-cli.ts` and `state-fields.ts` (shared CLI I/O and value check),
  `state-write.ts` (the file half of the writer, moved out of
  `state-file.ts`), and the renamed tests. Their behaviour is unchanged
  except where review asked; the e08s01 and e08s02 suites pass.
- ✓ No speculative features: every rule beyond the plan is recorded in the
  spec with the review finding that asked for it.
- ✓ Discovered defects: none. Preflight is green.

### Boy Scout Rule
- ✓ Touched files are cleaner (the dead exports above are removed).
- ✓ No dead code; no commented-out code (grep, empty).

### Types and Safety
- ✓ No `any`, `@ts-ignore`, `eslint-disable` or `as unknown as` (grep,
  empty). Typecheck: 0 errors.
- Observation: `checkHandoff` narrows with one cast (`fields as
  HandoffInput`) after `fieldProblem` has checked each field; the comment
  says so. The owner chose to keep validate-then-cast.

### Test Coverage
- ✓ Every new exported function is tested directly or through the public
  function or CLI that uses it (`setMapping`, `writeStateMapping`,
  `checkHandoff`, `writeHandoff`, `uncommittedPaths`, both CLIs as
  processes; the shared helpers through `setField`/`setMapping`).
- ✓ Every defect found in review has a regression test, and the tests for
  the fixes since round 1 were shown to fail without their fix.
- ✓ One test reads written layouts with PyYAML itself; it skips only where
  python3 with PyYAML is missing (CI has it for `validate-specs-yaml.sh`).
- ✓ F.I.R.S.T: every test uses its own temporary repository and an injected
  time; none touches this repository's `specs/state.yaml`.

### SOLID and Heuristics
- ✓ Single responsibility: scalar edit and shared checks (`state-file.ts`),
  file I/O (`state-write.ts`), mapping edit (`state-mapping.ts`), CLI I/O
  (`cli-io.ts`), handoff rules (`handoff.ts`), git status (`tree.ts`).
- ✓ The CLIs take the root and stdin through small functions; the library
  runs in tests without a process.

### Refactoring Smells (Fowler)
- Data Clumps (minor, kept): `(text, span, key)` travels through
  `entryTexts` and `firstThatFits`.
- Duplicated Code (minor, kept by owner choice): the parse-then-`toJS`
  pattern in `parseOne`, `readsAsItself` and `fits`; `plainStringIsSafe`
  (setField) beside `staysPlain` (setMapping).
- Mysterious Name, Feature Envy, Primitive Obsession, Message Chains,
  Middle Man: none found in the story's code after the review rounds.

### Code Style (CONVENTIONS.md)
- ✓ Functions: every function in the story's files is 20 lines or fewer.
- ✓ Files: largest `state-mapping.test.ts` 283, `state-file.ts` 263,
  `state-mapping.ts` 242; all under 300.
- ✓ Names: each new name has one definition; counts of 5 or more hits are
  call sites across modules.
- ✓ No line indented 12 spaces or more in the story's source.
- ✓ Comments explain why, with the review finding that asked for each rule.
- Observation: some TypeScript lines are over 120 characters; no width rule
  exists for TypeScript, and main has the same pattern.

## Red flags

- I nearly counted the 13 exported helpers with no direct test mention as a
  failure. Each is reached by a tested public function, and the checklist
  asks for tests through public interfaces, so it is not one.
- The waived review gate is not an audit failure, but it means the round-5
  fixes have only this self-audit and the gates as checks. They are small
  (wording, a removed branch, refusal messages, one regex) and each has a
  test.

## Gates after the fix

- Preflight: `yamllint specs`, `validate-specs-yaml`, `check-gate-ignores`,
  `npm run typecheck` (0 errors), `npm test` (636 of 636, 0 skipped).
- The four task verify commands in `e08s03-tasks.yaml`: exit 0.
- `scripts/verify-adversarial.sh`: exit 0.
- `scripts/check-blind-spots.sh`: 0 HIGH (52 MEDIUM, 13 LOW, double-tags).
- `scripts/lib/completeness-critic.sh` after `trace-stories.sh`: 0 BLOCKER.

## Next

Refresh `specs/verifications/e08s03-verify.yaml` at the new head (it records
bf224b9 and 583 tests), then commit-message, then release-branch, each with
the owner's go-ahead.
