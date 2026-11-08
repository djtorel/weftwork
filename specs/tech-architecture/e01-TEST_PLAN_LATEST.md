# Test Design: e01-foundations (lite)

Written by `plan-tests --lite` on 2026-11-07. NFRs and complex fixtures skipped.
No test code exists yet. `plan-work` MUST cite these scenario IDs in its Gherkin criteria.

## Scope

Epic e01 is research work. The only executable artifact is `tools/check-brief.sh`
(story e01s01). Every later brief is gated by it, so a false pass spreads to all 15
briefs. That is why e01 is P1 and why the checker is the only thing tested here.
Brief prose is judged by the owner and by R7-style review, not by tests.

`check-brief.sh` reads `specs/planning-context.yaml` to find the hypotheses assigned
to an R-id (`hypotheses[].tested_by`).

## 1. Risk Matrix and Scenarios

| Scenario ID | Behavior | Risk | Level | Target |
| ----------- | -------- | ---- | ----- | ------ |
| SC-e01s01-P1-01 | A complete brief (sections, dated sources, a verdict for every assigned hypothesis) exits 0 | P1 | Integration | `tools/check-brief.sh --selftest` |
| SC-e01s01-P1-02 | A brief missing the verdict for one assigned hypothesis exits non-zero and names that hypothesis | P1 | Integration | same |
| SC-e01s01-P1-03 | A source with no access date or no publication date exits non-zero | P1 | Integration | same |
| SC-e01s01-P1-04 | An unknown R-id exits non-zero with a message listing valid ids | P1 | Integration | same |
| SC-e01s01-P1-05 | A verdict word outside confirmed, refined, refuted exits non-zero | P1 | Integration | same |
| SC-e01s01-P2-06 | R0 and R11 have no assigned hypotheses: the checker says "none assigned" and does not pass silently | P2 | Integration | same |
| SC-e01s01-P2-07 | `--sources` checks only the source section, so a draft brief passes task 1 | P2 | Integration | same |
| SC-e01s01-P2-08 | A missing brief file exits non-zero with the path in the message | P2 | Unit | same |
| SC-e01s01-P2-09 | The self-test leaves no files behind in the repo (`git status --porcelain` unchanged) | P2 | Integration | same |

P0 is empty: nothing here can lose data or leak anything.

## 2. Fixture Architecture and Isolation

- Fixtures are built inline in `mktemp -d` directories. The self-test never writes
  inside the repo (SC-e01s01-P2-09).
- A fixture planning-context is a small copy with two R-ids and three hypotheses, so
  the test does not depend on the real file changing.
- Anti-vacuity: each rejecting scenario starts from the passing fixture of
  SC-e01s01-P1-01 and breaks exactly one thing. Otherwise a checker that rejects
  everything would pass the rejection tests.
- Default level is the lowest possible: shell-level calls to the script, no mocks.

## 3. NFR Verification

Skipped (`--lite`).

## 4. Out of Scope

- Whether a brief's claims are true or well argued. That is review, not a test.
- Link checking of cited URLs (network, flaky). Revisit if briefs show dead links.
- Stories e01s02 and e01s03 have no code. Their `verify:` commands are `grep` checks
  that use the checker from e01s01.
