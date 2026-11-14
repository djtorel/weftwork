# Audit: e09s01, the owner sets the engine's limits in a budget setting file

**Story:** e09s01
**Branch:** e09s01-budget-setting
**Diff:** `git diff 052c656..858609f` (main at 052c656)
**Mode:** default (full checklist), run by audit-code, the coding agent's self-review
**Run:** first audit, 2026-11-14, after verify-work and the F1/F2 fixes
**Result:** PASS after four fixes made in this audit (858609f)

## Failed and fixed in this audit

1. **Function over 20 lines.** `readBudget` in `src/budget.ts` was about
   45 lines. It is now `yamlData` (12), `budgetMapping` (7),
   `checkLimits` (16) and `readBudget` (6).
2. **Generic names.** `readSetting` matched 19 lines (through
   `readSettings` in claude-settings-file.ts); it is `readBudgetFile`.
   `Read` and `Parsed` are `BudgetFileRead` and `BudgetCheck`.
3. **Exports with no outside user.** `settingMaxBytes` and
   `userSettingPath` are no longer exported.
4. **Error text that repeats the key.** `budget.maxFailures: "maxFailures"
   must be ...` is now `budget.maxFailures must be ...`; `limitProblem`
   returns only the rule and each caller names the key. The request errors
   of `parseRequest` are word for word unchanged (gate.request tests pass).

## Checklist

### Supply Chain & Security
- ✓ No new dependency (`package.json` and `package-lock.json` unchanged);
  `yaml` 2.9.1 was pinned in e08s01 [OK].
- ✓ No secrets in the diff (grep for `sk-`, `ghp_`, `AKIA`: 0 hits).
- ✓ OWASP spot-check: `specs/security/REVIEW.md` (section
  e09s01-budget-setting), five probes.
- ✓ No unaddressed HIGH finding. F1 (CWE-248) and F2 (CWE-150), both LOW,
  are fixed (9607d02, 87f6221). A1 and A2 are owned by e10.

### Provenance & Metadata
- ✓ `e09s01-budget-setting.md` has `type:` and `context:`; the tasks file
  has `risk:` and `allure:` per task.
- ✓ Decisions are in spec §1 (four owner decisions at plan-work, ba83fd7);
  code comments cite e09s01, the spec rules and the security findings.

### Law of Demeter
- ✓ No chains through unrelated objects. `applyBudget` talks to
  `readRegularFile`, `repositoryRoot` and `resolveLimits` only.

### CONVENTIONS.md Compliance
- ✓ Planning output in `specs/`; the user doc is `docs/BUDGET.md`, where
  CONVENTIONS puts docs. No file at the project root.
- ✓ No `gh issue create`, no direct GitHub API call.
- ✓ ESM, `.ts` imports, `import type` for types; no enum or namespace.
- ✓ Errors are returned values (`Failure`); the one throw from the yaml
  package is caught (F1). The CLIs stay thin: one `applyBudget` call each.
- ✓ AGENTS.md names `budget.ts`; no new command in AGENTS.md.

### Scope
- ✓ Only the story: the setting files, the two callers, the docs, the
  tests and the test isolation (spec R6).
- ✓ The `gate.ts` change shares the range rule (spec §2), no more.
- ✓ The `print` change in `cli.ts` is the F2 fix, owner decision.
- ✓ Discovered defect: the one AC-e07s02-13 failure is logged as BUG-008
  (owner decision), with the reproduction attempts.

### Boy Scout Rule
- ✓ `gate.ts`: two duplicate range checks became one rule.
- ✓ No dead code; no commented-out code.

### Types and Safety
- ✓ No `any`, no `@ts-ignore`, no `as unknown as`.
- ✓ One `value as number` in `checkLimits`, with a comment: `limitProblem`
  has just accepted it as an integer in range.

### Test Coverage
- ✓ Every new function is reached by a test: `resolveLimits` and the three
  check steps (src/budget.test.ts, 26 tests), `applyBudget`,
  `userSettingPath` and `readBudgetFile` (src/budget.files.test.ts, 13),
  both callers (src/cli.budget.test.ts, src/claude-hook-cli.budget.test.ts).
- ✓ F1 and F2 each have a regression test that failed first (9607d02).
- ✓ Tests go through the public functions and the real CLIs.
- ✓ F.I.R.S.T: each test makes its own temporary repository and config
  home; no test reads the real user file (checked with a hostile user file
  under XDG_CONFIG_HOME and under HOME, 733 of 733).

### SOLID and Heuristics
- ✓ Single responsibility: parse, find the mapping, check, merge, read
  files are separate functions.
- ✓ Dependency inversion: `applyBudget` takes `env`; `resolveLimits` is
  pure over the texts.
- ✓ No G/N/C/T smell found after the fixes above.

### Refactoring Smells (Fowler)
- None left. Duplicated Code (the two range checks) and a Long Function
  (`readBudget`) were removed.

### Code Style
- ✓ Functions 6 to 16 lines in `budget.ts`.
- ✓ Files under 300 lines (`budget.ts` 157, `gate.ts` 217).
- ✓ Names specific; max two levels of indentation; early returns.
- ✓ Comments say why (the F1 throw, the F2 escaping, the recordCall order).

## Red flags

- I nearly kept `readBudget` at 45 lines as "one linear check". It broke
  the 20-line rule, so it was split.
- `cli.ts` keeps its own `print` rather than `printAnswer` from cli-io.ts:
  `print` does not set the exit code, and the CLI sets it apart in three
  branches. Switching is a refactor outside this story.

## Verification

Preflight at 858609f: `yamllint specs && bash tools/validate-specs-yaml.sh
&& bash tools/check-gate-ignores.sh && npm run typecheck && npm test`,
exit 0, 737 of 737 tests.

VERDICT: PASS
