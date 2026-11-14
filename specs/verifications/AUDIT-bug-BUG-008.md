# Audit: BUG-008, a second SIGTERM once ended the hook by signal

**Story:** BUG-008
**Branch:** fix-bug-008-second-sigterm
**Diff:** `git diff main...fb61429` (main at 1b98929)
**Mode:** default (full checklist), run by audit-code, the coding agent's self-review
**Result:** PASS, no item failed

## Checklist

### Supply Chain & Security
- ✓ No new dependency (`package.json` and `package-lock.json` unchanged).
- ✓ No secrets in the diff (grep for `sk-`, `ghp_`, `AKIA`: 0 hits).
- ✓ Security review: no finding at confidence 8 or more
  (specs/security/REVIEW.md, section fix-bug-008-second-sigterm).

### Scope
- ✓ One production change: the last four lines of
  `src/claude-hook-cli.ts` and its header comment. One new test. The bug
  file records the root cause, the CI evidence and the fix.
- ✓ The refused idea (let the test tolerate a late signal) is recorded in
  the bug file with the reason.
- ✓ No gate failure found outside the story. The same pattern in
  `src/cli.ts` is not fail-open and is noted in REVIEW.md, not changed.

### Boy Scout Rule
- ✓ The header comment of the hook CLI now says that every answer leaves
  through `leave` and why. No dead or commented-out code.

### Types and Safety
- ✓ No `any`, `@ts-ignore`, `eslint-disable` or `as unknown as`.

### Test Coverage
- ✓ A regression test for the bug: `BUG-008 a signal right after the block
  is written still ends in exit 2`. It failed before the fix (round 1,
  `null !== 2`, commit 35ca1cd) and passes after it. It tests the public
  behaviour (the exit code of the real CLI), not the implementation.
- ✓ F.I.R.S.T: each round makes its own repository and environment; the
  signal is sent on an event, not on a delay; 5 rounds per run.
- ✓ The suite: 819 of 819. The hook test files: 8 repeats and 24
  parallel runs, 0 failures.

### Code Style
- ✓ The change removes 4 lines and adds 1 line of code. No new function.
- ✓ The long line I added to the test was shortened (fb61429).

### Red Flags
- I first wanted to leave only the signal path on `leave`. The probe
  showed that any signal in the shutdown stretch is the same hole, so
  every path uses it.

VERDICT: PASS
