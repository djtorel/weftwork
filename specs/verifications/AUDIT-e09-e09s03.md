# Audit: e09s03, the engine keeps a reserve so a hard stop leaves a handoff

**Story:** e09s03
**Branch:** e09s03-engine-reserve
**Diff:** `git diff main...HEAD` (main at 70a01bd)
**Mode:** default (full checklist), run by audit-code, the coding agent's self-review
**Run:** first audit, 2026-11-15, after verify-work (99916b3)
**Result:** PASS after three fixes made in this audit

## Failed and fixed in this audit

1. **File over 300 lines.** `src/engine.ts` was 302 lines (281 on main).
   Two doc comments are one line each now, and `reserveDetail` reads
   `reserve.count` and `reserve.left` with no extra binding. It is 299.
2. **Duplicated constant.** `src/budget.ts` had `reserveMax = 1000`, the
   same limit as `maxThreshold` in `src/gate.ts`. `maxThreshold` is
   exported and used for both.
3. **Test file over 300 lines.** `src/budget.test.ts` went from 266 to 301
   lines. One test ("with no source setting reserveRuns it stays unset")
   repeated the last assertion of AC-e09s03-07 and was removed, and a
   section comment is one line. It is 296.

Preflight after the fixes: 851 of 851 (one test fewer), exit 0.

## Checklist

### Supply Chain & Security
- ✓ No new dependency (`package.json` and `package-lock.json` unchanged).
- ✓ No secrets in the diff (grep for `sk-`, `ghp_`, `AKIA`: 0 hits).
- ✓ OWASP spot-check: one new input, `reserveRuns` in the owner's setting
  file, an integer from 0 to 1000. The request cannot set it: `parseRequest`
  does not read it and `applyBudget` drops it. No new spawn or write. The
  detail text holds two counts, the ceiling and a path the engine builds
  from its own location, none from the agent.
- ✓ Security review: skipped at verify-work, risk P2 (scan is for P0 and
  P1). No HIGH finding to address.

### Provenance & Metadata
- ✓ The story spec and tasks file carry `type:` and `context:`.
- ✓ The owner's four plan-work decisions are recorded with dates in the
  spec; commits name the RED and GREEN pairs.

### Law of Demeter
- ✓ No call chains through unrelated objects.

### CONVENTIONS.md Compliance
- ✓ Planning and evidence output is in `specs/`; docs in `docs/`.
- ✓ No `gh issue create`, no `gh` call, no GitHub REST call.
- ✓ Every commit is a Conventional Commit with a `Story: e09s03` trailer
  and no attribution footer.

### Scope
- ✓ Limited to the five planned tasks. The change to `checkLoopCeiling`
  is an extract (`loopRuns`) shared with `checkReserve`, no behaviour
  change.
- ✓ No speculative features: the reserve covers the loop ceiling only, as
  decided.
- ✓ No gate failure found, so no fix-or-log was needed.

### Boy Scout Rule
- ✓ Touched files are no worse; the loop count is in one place now.
- ✓ No dead code and no commented-out code.

### Types and Safety
- ✓ No `any`, `@ts-ignore`, `eslint-disable` or `as unknown as`.
- ✓ The `_fromRequest` binding in `applyBudget` only drops the key; the
  typecheck accepts it.

### Test Coverage
- ✓ New functions have tests: `checkReserve` (10 tests), the
  `reserveRuns` key (budget, files and request), the engine detail (6),
  the CLI (3) and the hook (2 unit, 1 process).
- ✓ Tests use public interfaces (`checkReserve`, `resolveLimits`,
  `applyBudget`, `runEngine`, the two CLIs, `hookAnswer`).
- ✓ F.I.R.S.T: each process test has its own temporary repository and an
  isolated `XDG_CONFIG_HOME`; the suite passed with a hostile user file.

### SOLID and Heuristics
- ✓ Single responsibility: `checkReserve` counts, `reserveDetail` words it,
  `blockFailed` places it.
- ✓ Open/closed: the reserve is added beside the other rules; no rule
  changed.
- ✓ No G or N heuristic smell found.

### Refactoring Smells (Fowler)
- None found after fix 2 (Duplicated Code).

### Code Style
- ✓ Functions under 20 lines; `src/engine.ts` 299 lines after fix 1,
  `src/budget.ts` 222, `src/breaker.ts` 98, `src/claude-hook.ts` 234.
- ✓ Early returns; at most 2 levels of indentation.
- Note: `src/engine.loop.test.ts` is 375 lines; it was 319 on main, before
  this story. Splitting it is not in this story's scope.
- Note: a few lines pass 100 columns, as elsewhere in `src`.

### Red Flags
- Rationalization caught and refused: "engine.ts at 302 is close enough"
  (fixed, fix 1).
- Kept on purpose, for review to judge: the detail names the handoff CLI
  as `node <path>` with no shell quoting. A weftwork checkout under a path
  with spaces would give a command that does not paste as is. The path
  comes from the install location, not from the agent.
- Not a code finding: `trace-stories.sh` does not credit a story that is
  the last id of a multi-story header line (verify-work evidence).
