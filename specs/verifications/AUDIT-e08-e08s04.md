# Audit: e08s04, the engine checks the handoff at resume

**Story:** e08s04
**Branch:** e08s04-handoff-check
**Diff:** `git diff ada1fb3..98788f3` (main at ada1fb3)
**Mode:** default (full checklist), run by audit-code, the coding agent's self-review
**Run:** first audit, 2026-11-14, after verify-work and the F1 fix
**Result:** PASS after four fixes made in this audit

## Failed and fixed in this audit

1. **Function over 20 lines.** `check` in `src/resume-cli.ts` was 21 lines.
   The state-file read is now `readHandoff`; `checkRepository` is 20
   (486db31).
2. **Generic names.** `check` and `describe` (also a `node:test` name)
   became `checkRepository` and `stderrText` (486db31); `shown`, which
   matched 45 lines of prose, became `terminalSafe` (98788f3).
3. **Missing doc comment.** `stderrText` now has one (486db31).
4. **Untested branch.** No test reached the stderr text for a ready block
   with no next skill; one does now (2d433d7).

## Checklist

### Supply Chain & Security
- ✓ No new dependencies (`package.json` and `package-lock.json` unchanged).
- ✓ No secrets in the diff (grep for `sk-`, `ghp_`, `AKIA`).
- ✓ OWASP spot-check: `specs/security/REVIEW.md` (section
  e08s04-handoff-check): no finding at confidence 8 or more; seven attack
  paths probed live.
- ✓ No unaddressed HIGH finding. F1 (LOW, CWE-150) is fixed (6651d64). A1
  is an owner-accepted risk owned by e10.

### Provenance & Metadata
- ✓ `e08s04-resume-check.md` has `type:` and `context:`; the tasks file has
  `risk:` and `allure:` per task.
- ✓ Decisions are in spec §1 (seven owner decisions at plan-work, commit
  1936b6e) and cited in the code comments of `resume.ts` and
  `resume-cli.ts`.

### Law of Demeter
- ✓ No chains through unrelated objects.

### CONVENTIONS.md Compliance
- ✓ Output files are in `specs/`, `src/` and `docs/`; nothing new in the root.
- ✓ No `gh`, `gh issue create` or `api.github.com` in the changed files.

### Scope
- ✓ The changes are the story's: the report, the CLI, `currentBranch`, the
  `readStateData` export, the docs, and the F1 fix that verify-work asked
  for.
- ✓ No speculative features: no caller, no hook, no age limit (spec §5).
- ✓ No discovered defect: Preflight green at every step.

### Boy Scout Rule
- ✓ Touched files are cleaner or unchanged in style; no dead code, no
  commented-out code.

### Types and Safety
- ✓ No `any`, `@ts-ignore`, `eslint-disable` or `as unknown as` in the diff.
- ✓ Test files cast parsed JSON to `Record<string, unknown>`, as the e08s03
  CLI tests do.

### Test Coverage
- ✓ Every new function has a test: `resumeReport` (13 cases), `currentBranch`
  (4), the CLI (14, real processes after a real handoff write).
- ✓ The F1 fix has a regression test (5cd6d68).
- ✓ Tests use public interfaces only: the exported function and the CLI.
- ✓ F.I.R.S.T: temporary repositories, no shared state, no network.

### SOLID and Heuristics
- ✓ Single responsibility: rules in `resume.ts` (pure), I/O in
  `resume-cli.ts`, git in `tree.ts`.
- ✓ Dependency inversion: `resumeReport` takes facts, including `exists`,
  so its tests need no repository.

### Refactoring Smells (Fowler)
- Duplicated Code, accepted: `existsIn` in `resume-cli.ts` and
  `fileProblem` in `handoff.ts` both run `insideRoot` then `lstat`. The
  writer needs a reason per cause (outside, missing, unresolvable); the
  check needs only a boolean. Sharing would add a parameter for one caller.
  Left as is.

### Code Style
- ✓ Functions 20 lines or fewer (longest: `checkRepository`, 20).
- ✓ Files under 300 lines (`resume.ts` 90, `resume-cli.ts` 109).
- ✓ New names have fewer than 5 hits outside tests and docs, except
  `resumeReport` and `currentBranch`, which are the public exports.
- ✓ Early returns; at most 2 levels of indentation.
- ✓ Comments explain why (owner decisions, F1, R12).

## Red flags

I caught one: I nearly let `check` stay at 21 lines as "close enough".
The rule says 20, so it was split.

## Evidence

Preflight at 98788f3: yamllint, validate-specs-yaml, check-gate-ignores,
typecheck, and 667 of 667 tests, exit 0.
