# Audit: e08s02, the engine changes only the documented state fields

**Story:** e08s02
**Branch:** e08s02-state-fields
**Diff:** `81e60a1..HEAD` (main at release of e08s01), 11 commits before the audit fixes
**Mode:** default (full checklist), run by audit-code, the coding agent's self-review
**Result:** PASS after two fixes made in this audit (see "Failed and fixed")

## Failed and fixed in this audit

1. **File length (Code Style: files under 300 lines).** `src/state-file.ts`
   was 313 lines; it was 299 at the base. The read helper `readStateData`
   moved to `src/state-fields.ts` (its only caller), and `insideRoot` and
   `parseOne` are now exported for it. `state-file.ts` is 299 lines.
2. **Duplication (G5).** Three test files each had a copy of the "repository
   with specs/state.yaml" helper. One `makeStateRepo(text)` in
   `src/test-helpers.ts` replaces them. `state-fields.test.ts` wraps it in
   a local `repoWithState` that returns the path.
3. **Provenance (metadata: steps reference a decision).** The three steps of
   `e08s02-state-fields.md` now cite the owner decisions they implement
   (§1 decisions 1 to 4, and §3).

Gates re-run after the fixes: Preflight exit 0, 537 of 537 tests;
`scripts/verify-adversarial.sh` exit 0.

## Look-here-first (churn, 90 days)

Top churn in the branch's files: `specs/state.yaml` (52), `specs/security/REVIEW.md`
(21), `AGENTS.md` (11). The source files in this story have little prior
churn, so the review went file by file in the order of the diff: the field
table `src/state-fields.ts`, the CLI `src/state-cli.ts`, the writer
`src/state-file.ts`, then the tests.

## Supply Chain & Security

- ✓ No new dependency in this story. `yaml` 2.9.1 was added in e08s01 and
  reviewed there.
- ✓ No `[SLOP]` package.
- ✓ No secrets in the diff: grep for `sk-`, `ghp_`, `AKIA`, private-key headers
  returned nothing.
- ✓ OWASP spot-check: no shell (`git` through `execFile`, unchanged); the
  get path prints five fixed fields only; no outbound calls; no auth surface.
- ✓ Security: `specs/security/REVIEW.md` section e08s02-state-fields. No HIGH
  finding. F1 (get read outside the root) and F2 (alias bomb made get throw)
  are LOW and fixed (4946dcb, 2260d5a), with regression tests.

## Provenance & Metadata

- ✓ The story spec and the tasks file carry `type:` and `context:`.
- ✓ Steps cite decisions (fixed in this audit; see above). No ADR was written
  for this story; the owner decisions are dated in spec §1.

## Law of Demeter

- ✓ No chains through unrelated objects. The longest is `read.file.text`, one
  result and its field.

## CONVENTIONS.md Compliance

- ✓ Output files are under `specs/` (verifications, REVIEW, state, tasks).
  `docs/STATE.md` is under `docs/`, not the project root, as the spec requires.
- ✓ No `gh issue create`, and no GitHub REST call, in the diff (grep: 0).
- ✓ `gh` is not used by this story.

## Scope

- ✓ Changes are what e08s02 asks for: the field table, the CLI shape, the
  `get` read, the document, one AGENTS.md line.
- ✓ `src/state-file.write.test.ts` is a move of e08s01 tests that the CLI
  narrowing made unreachable through the CLI (commit 3438f72). It is needed,
  and no test was dropped.
- ✓ No speculative feature. Each exported name has a caller: `readStateFields`
  (CLI get), `setStateField` (CLI set), `checkStateField` (set), `stateFields`
  (both), `insideRoot` and `parseOne` (the new reader).
- ✓ No file outside the stated scope.
- ✓ Discovered defects: none open. Preflight is green.
- ✓ Boy Scout: `state-file.ts` lost its read helper and the three test
  helper copies are gone. `state-cli.ts`'s comment about `chunk as Buffer` is
  unchanged from e08s01 and still true.

## Boy Scout Rule

- ✓ Every file touched is cleaner than before.
- ✓ No dead code. `readStateData` is called by `readStateFields`; the
  previous path-based request is gone from `state-cli.ts`.
- ✓ No commented-out code (grep for commented statements: none).

## Types and Safety

- ✓ No `any` introduced (grep: 0 in `src`).
- ✓ No `@ts-ignore`, no `eslint-disable`, no `as unknown as`.
- ✓ One cast, `value as string | null` in `setStateField`. It follows
  `checkStateField`, which lets only null and strings through, and the
  comment says so. Noted as a clarity point: a type predicate would remove
  the cast (not changed; see observations).

## Test Coverage

- ✓ Every new function has a test: `checkStateField`, `setStateField`,
  `readStateFields`, `stateFields` directly in `state-fields.test.ts`.
  `readStateData` is private and is covered through `readStateFields` (the
  symlink, alias bomb, missing file and invalid YAML cases). `parseRequest` is
  private and is covered through the CLI tests.
- ✓ Each bug fix has a regression test: F1 (`readStateFields refuses a specs
  folder that is a symlink out of the repository`) and F2 (`readStateFields
  refuses an alias bomb and does not throw`).
- ✓ Tests go through public interfaces. The one exception is the docs/STATE.md
  test, which reads a document on purpose: it is the contract between the
  code table and the document (AC-05).
- ✓ F.I.R.S.T: each test runs in its own temporary repository; no test touches
  this repository's `specs/state.yaml`.
- ✓ Boundaries (T5): 200 and 201 code points, the astral case, newline, carriage
  return, the number, the boolean, the list and the object.

## SOLID and Heuristics

- ✓ Single Responsibility: `state-file.ts` (299 lines) is the writer; the
  reader of the field table is in `state-fields.ts`.
- ✓ Dependency Inversion: `root` is passed in, so the tests use temporary
  repositories.
- ✓ Chapter 17, Functions: the new functions have at most 2 arguments
  (`readStateData`, `checkStateField`) or 3 (`setStateField`). The existing
  `writeStateField(root, file, path, value)` has 4 and was written in e08s01.
  This story does not change its signature, so it is recorded as an existing
  deviation, not a new one.
- ✓ Chapter 17, General: no duplication left (G5, fixed); constants are named
  (`maxValueLength`, `maxInputBytes`, `maxStateBytes`) (G25); no output
  arguments (F2); no flag arguments (F3).

## Refactoring Smells (Fowler)

- Mysterious Name: none. `readStateData` (reads with the checks) and
  `readStateFields` (returns the five fields) are kept apart on purpose.
- Duplicated Code: fixed (test repository helper).
- Feature Envy, Data Clumps, Message Chains, Middle Man: none found.
- Primitive Obsession: `stateFields` is `readonly string[]`, so a typo in a
  key is only caught at run time. Noted as an observation; a union type of the
  five keys would catch it at compile time (not changed here).

## Code Style

- ✓ Functions: the longest new function is `parseRequest`, about 15 lines. An
  awk pass over the three source files found no function over 20 lines.
- ✓ Files: `state-file.ts` 299, `state-fields.ts` 83, `state-cli.ts` 78, the
  tests 150 to 176 lines.
- ✓ Names: the names are project-specific, but the literal item (fewer than five
  whole-word hits) is not met for `readStateFields` (16), `setStateField` (10),
  `stateFields` (10) and `checkStateField` (9). The hits are the definition, the
  callers and the tests. Only one definition of each name exists in `src/`
  (`grep` for the definitions: 3 hits for the three functions and the constant).
  The item's purpose, no generic name that collides with another, is met. Noted
  as a deviation from the literal count.
- ✓ No duplication after the fix above.
- ✓ Early returns; the deepest new nesting is two levels (the field loop in
  `readStateFields`).
- ✓ Conditionals: the new code uses negative guards for early returns
  (`if (!read.ok) return read`), which is how the rest of the codebase is
  written. Noted under G29 as a style point; no positive rewrite was made.
- ✓ Comments explain why (the `value as string | null` note, the alias-bomb
  note, the case-insensitive `.git` note). None restate the code.

## Red Flags

Rationalizations I caught while auditing:
- I nearly marked the "under 300 lines" item as passing because `state-file.ts`
  was "only 14 lines over". The item is a limit, not a guideline; it was fixed.
- I nearly marked the "steps reference a decision" item as passing because the
  decisions are in the spec. The steps did not point to them; they now do.
- I nearly marked the names item as passing on a literal count. I did not: the
  deviation is written out above, not hidden.

## Observations (not failing, not changed)

- `writeStateField` has four arguments (Chapter 17, F1). It predates this story.
  A later story can take an options object if a fifth argument ever appears.
- `setStateField` casts `value as string | null` after the check. A type
  predicate in `checkStateField` would remove the cast.
- `stateFields` could be a union type of the five keys (Primitive Obsession).
- Blind-spot warnings (48 MEDIUM, 12 LOW) are double-tags between e08 stories,
  as in e08s01. Left as they are.

## Verdict

PASS. No checklist item fails after the fixes above. Next step:
`commit-message`, then the owner's go-ahead for push, PR and merge.
