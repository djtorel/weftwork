# Audit: e09s02, the engine stops the whole loop at a counted ceiling

**Story:** e09s02
**Branch:** e09s02-loop-ceiling
**Diff:** `git diff main...a8cc9fe` (main at d3fe07c)
**Mode:** default (full checklist), run by audit-code, the coding agent's self-review
**Run:** first audit, 2026-11-14, after verify-work (3030bce)
**Result:** PASS after three fixes made in this audit (a8cc9fe)

## Failed and fixed in this audit

1. **One function doing three jobs.** `ceilingStop` in `src/engine.ts`
   checked the failure ceiling, the F5 rule and the loop ceiling in about
   20 lines. It is now `ceilingStop` (1 line), `failureStop` (2) and
   `loopStop` (9).
2. **Generic names.** `Read` matched 20 lines in `src` and `Stop` 89.
   They are `LedgerForRules` and `TrippedRule` (0 other hits).
3. **Unused import.** `src/budget.ts` imported `LimitKey` after `Limits`
   stopped using it. Removed.

Preflight after the fixes: 799 of 799, exit 0.

## Checklist

### Supply Chain & Security
- ✓ No new dependency (`package.json` and `package-lock.json` unchanged).
- ✓ No secrets in the diff (grep for `sk-`, `ghp_`, `AKIA`: 0 hits).
- ✓ OWASP spot-check: one new input, `maxRuns`, an integer from 1 to
  1000 checked by the shared `isLimit`; no new spawn, path or write.
- ✓ Security review at verify-work: no HIGH or MEDIUM finding. F1 (LOW,
  junk lines in the ledger) accepted by the owner, owned by e10
  (specs/security/REVIEW.md, section e09s02-loop-ceiling).

### Provenance & Metadata
- ✓ The story spec and tasks file carry `type:` and `context:`.
- ✓ The owner's decisions are recorded with dates in the spec (plan-work)
  and REVIEW.md (F1); commits name the RED and GREEN pairs.

### Law of Demeter
- ✓ No call chains through unrelated objects.

### CONVENTIONS.md Compliance
- ✓ Planning output in `specs/`; the user doc in `docs/BUDGET.md`.
- ✓ No `gh` calls, no GitHub API calls.
- ✓ Every commit carries `Story: e09s02`; no AI attribution.

### Scope
- ✓ Only the loop ceiling, the `maxRuns` key and the F5 rule. The
  reserve (e09s03) and the report (e09s04) are not started.
- ✓ No gate failure was found outside the story.

### Boy Scout Rule
- ✓ `breaker.ts` header said "two ways"; now "the ways". Unused import
  removed. No dead or commented-out code.

### Types and Safety
- ✓ No `any`, `@ts-ignore`, `eslint-disable` or `as unknown as`.

### Test Coverage
- ✓ `checkLoopCeiling`: 10 tests (src/breaker.loop.test.ts).
- ✓ `maxRuns` parsing and precedence: src/budget.test.ts,
  src/gate.request.test.ts.
- ✓ The engine order and F5 before and after a run:
  src/engine.loop.test.ts; the CLI: src/cli.loop.test.ts; the hook:
  src/claude-hook-cli.budget.test.ts (fails against the engine before
  the change).
- ✓ F.I.R.S.T: each test makes its own temporary repository and isolates
  `XDG_CONFIG_HOME`; the suite passes with a hostile user file.
- Not tested: a cut ledger tail with no `done` (the F1 residual), as
  recorded in the spec's risks and REVIEW.md.

### SOLID and Heuristics
- ✓ Each new function does one thing after fix 1.
- ✓ `lowered` in budget.ts is the one precedence rule for all limits.

### Refactoring Smells (Fowler)
- None left. Fixed: a long function and two mysterious names.

### Code Style
- ✓ Functions under 20 lines; files under 300 (engine.ts 248).
- ✓ Early returns; at most 2 levels of indentation.
- Note: a few lines pass 100 columns, as elsewhere in `src`. There is no
  TypeScript formatter in the project (CLAUDE.md, Lint).

### Red Flags
- I first meant to leave `ceilingStop` as it was because it was "only
  about 20 lines"; the three jobs in it were the real problem, so it was
  split.
- The detail `1 runs since the last done` reads badly for a count of 1.
  It matches the existing `1 failed runs` text, so it is left as is and
  named in REVIEW.md.

VERDICT: PASS

## Second run, after request-review (2026-11-14, head 9c277da)

Diff `e51df7d..9c277da`: the round 1 to round 3 fixes (src/engine.ts,
src/gate.ts, src/budget.ts, tests, docs/BUDGET.md, the spec and
REVIEW.md).

- ✓ No new dependency, secret, `any`, `@ts-ignore`, `eslint-disable` or
  `as unknown as`.
- ✓ Functions at most 22 lines (`readEntries`, with its two notes, is
  the longest); files under 300 (engine.ts 281, gate.ts 237).
- ✓ New names are specific: `LedgerForRules`, `TrippedRule`,
  `uncountedReason`, `runLoggedGate`, `LoggedVerdict`, `writeProblem`.
- ✓ Every new rule has a test (AC-e09s02-11 to 13 and the round 3
  pins); the gate's `runGate` keeps its contract and its tests.
- ✓ All 20 commits carry `Story: e09s02`; no AI attribution.
- ✓ Preflight 818 of 818, exit 0.
- Declined review items and their reasons are in REVIEW.md (round 3
  addendum).

VERDICT: PASS
