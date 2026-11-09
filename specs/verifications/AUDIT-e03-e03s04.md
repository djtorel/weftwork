# Audit: e03s04 (R9 model routing), default mode

Target: branch `e03s04-r9-model-routing` against `main` (13 files, 884 insertions, 102 deletions). Churn ranking (`bp-churn-rank.sh --since 90.days`) put `specs/state.yaml`, `specs/execution-status.yaml`, the e03s04 tasks file and the R9 brief first. Reviewed in that order. Mode: default. Story risk P2.

Fixes made in this audit are listed under each item and committed separately.

## Supply chain and security

- [✓] slopcheck: no new package. Nothing to tag.
- [✓] No `[SLOP]` packages.
- [✓] No secrets: grep over the diff for `sk-`, `ghp_`, `AKIA` and private-key headers found none.
- [✓] OWASP spot-check: the only executable change is an 11-line wrapper that passes its arguments to the global script. No input reaches a shell from outside the repo.
- [✓] Security: no HIGH finding by manual review. No `security-review` run (P2 skips the scan per verify-work).

## Provenance and metadata

- [✓] New plan artefacts carry `type:`, `risk:`, `context:` and `bcps:`.
- [✗ → fixed] Implementation steps did not reference the decision they follow. Fix: added a "Decision reference" paragraph under §6 of `e03s04-r9-model-routing.md`, citing the 2026-11-09 scope decision, the plan commit 538dd9d and the `state.yaml` note.

## Law of Demeter

- [✓] No code paths with method chains. The wrapper is shell.

## CONVENTIONS.md compliance

- [✓] Output files are under `specs/` or `docs/research/`.
- [✓] No `gh issue create` in changed files.
- [✓] `gh` not used on this branch.
- [✗ — not fixable in the repo] A direct request to `api.github.com` happened during R9 research: one `curl` to the API root, output discarded, while checking the network. CONVENTIONS forbids direct REST calls. The R9 brief's Method section records it, and nothing depends on the response. Needs an owner waiver, as for e02s04 and e03s01.

## Scope

- [✓] Changes follow the story, plus two items the owner approved in this session: the tidy-ups (`CONVENTIONS.md`, BUG-004 note, `execution-status.yaml` statuses, `tools/record-cycle-time.sh`) and the MED-finding fixes (top-level `status` in the e03s01 to e03s03 task files and one reworded sentence in the e03s02 spec).
- [✓] No speculative features.
- [✓] No files outside the stated scope beyond those two approved items.
- [✓] Discovered defects: Preflight is green. The two MED items and the completeness-critic BLOCKER (stale traceability matrix, regenerated with `trace-stories.sh --json`) were handled. The CRITICAL and HIGH plan-consistency findings for e03s05 to e03s08 are covered by the e03 waiver in `state.yaml`.
- [✓] Boy Scout: the touched files are cleaner. `e03s04-tasks.yaml` and the R9 brief pass yamllint at 80 columns.

## Boy Scout Rule

- [✓] No dead code in the wrapper.
- [✓] No commented-out code.

## Types and safety

- [✓] No typed code in this story. No `any`, no ignore directives, no casts.

## Test coverage

- [✓] Every new function has a test. The wrapper has no functions.
- [✗ → fixed] Bug fix without a committed regression test. BUG-004 was verified only by hand on a scratch repository. Fix: added `tools/test-record-cycle-time.sh`. It runs the wrapper in a throwaway repository, with a fake global script that drops the marker, and expects the marker back. Output: `PASS record-cycle-time keeps the document start marker`, exit 0. Mutant check: with the restore line disabled it prints `FAIL document start marker missing after wrapper run` and exits 1, so the test does detect the bug.
- [✓] Tests use the public interface (the wrapper and its arguments), not internals.
- [✓] F.I.R.S.T: the test is self-contained, uses a temp directory, and cleans up.

## SOLID and heuristics

- [✓] No module boundaries changed.
- [✗ — cannot check here] Chapter 17 heuristics file `audit-code/HEURISTICS.md` does not exist. This repo has no `skills/` directory, which is the known open item carried in `state.yaml`. The item cannot be checked in this repository.

## Refactoring smells

- [✓] None detected in the wrapper or the test.

## Code style

- [✓] Wrapper: 11 lines, one branch.
- [✓] Test: under 40 lines, one function-free script.
- [✓] Files under 300 lines. The longest is the e03s04 story spec at 288.
- [✓] Comments explain why (BUG-004, the dropped marker).

## Verify line of this skill

- [✗ — known gap] `test -d skills/enforce-first && test -d skills/request-review` fails in this repository, which has no `skills/` directory. Recorded as the known open item.

## Red flags

- I was tempted to skip the regression test because the change is a wrapper. The checklist does not allow that, so I added the test.
- I was tempted to call the direct API request "not a call" because it was discarded and not used. It was a call. It is reported above.

## Result

Fixed: 2 items (decision references, regression test). Not fixable here: 1 item (direct API request, needs waiver). Cannot check here: 2 items (heuristics file and `skills/` verify line, both caused by the missing `skills/` directory).

Suggested next: `request-review` for an independent second opinion. The waiver for the direct API request is needed before `release-branch`.
