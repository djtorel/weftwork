# Audit: e03s05 (R11 security and permissions), default mode

Target: branch `e03s05-r11-security-permissions` against `main` (9 files, 714 insertions, 53 deletions), plus the uncommitted `specs/state.yaml` and `specs/verifications/e03s05-verify.yaml`. Files reviewed by size and risk: the R11 brief, the e03s05 tasks file and spec, `planning-context.yaml`, then the H1-H23 reference edits. Mode: default. Story risk P2. No code ships, so the code-only items are marked not applicable.

## Supply chain and security

- [✓] slopcheck: no new package. Nothing to tag.
- [✓] No `[SLOP]` packages.
- [✓] No secrets: grep over the diff for `sk-`, `ghp_`, `AKIA` and private-key headers found none. The brief names credential file paths (`~/.ssh`, `~/.aws/credentials`) as text only.
- [✓] OWASP spot-check: no executable change. The verify commands run grep and awk over files in this repo.
- [✓] Security: no HIGH finding by manual review. No `security-review` scan run (P2 skips it per verify-work).

## Provenance and metadata

- [✓] New plan artefacts carry `type:`, `risk:`, `context:` and `bcps:`.
- [✓] Implementation steps reference the decision they follow: §6 of the spec cites the owner's 2026-11-09 decisions (H21 to H23 added; evidence only).

## Law of Demeter

- [✓] Not applicable: no code.

## CONVENTIONS.md compliance

- [✓] Output files are under `specs/` or `docs/research/`.
- [✓] No `gh issue create` in changed files.
- [✓] `gh` not used on this branch.
- [✓] No direct GitHub REST API call. Two lines in the diff contain `api.github.com`, and both say it was not used (brief Method; spec §2). Publication dates came from public Atom feeds on `github.com`.
- [✗ — waiver recorded] Four sources (S26 to S29) have no publication date. The owner approved the exception on 2026-11-09 and it is in `state.yaml`, scoped to e03s05.

## Scope

- [✓] Changes follow the story, plus one owner-approved item: adding H21 to H23 and moving every "H1-H20" reference in `specs/` to "H1-H23" (e04 epic, e04s02 task text and verify, SCOPE, glossary). The remaining "H1-H20" strings are quotes of the old text in the spec's MODIFIED requirement and in the `state.yaml` note.
- [✓] No speculative features.
- [✓] No files touched outside the stated scope.
- [✓] Discovered defects: Preflight is green. The CRITICAL and HIGH plan-consistency findings for e03s06 to e03s08 are covered by the e03 waiver in `state.yaml`.
- [✓] Boy Scout: touched YAML passes yamllint. All added lines over 80 columns are in `specs/state.yaml`, which `.yamllint` exempts because the timing helper rewrites it.

## Boy Scout Rule

- [✓] Every touched file is at least as clean as before. No dead code or commented-out blocks.

## Types and Safety

- [✓] Not applicable: no code.

## Test Coverage

- [✓] Every task has a runnable `verify:`. All eight pass on the committed brief (single run in `e03s05-verify.yaml`).
- [✓] They were also checked against a fixture brief during plan-work: eight pass on a good brief, all fail with no brief, and `check-brief.sh` fails a brief with no H23 verdict.
- [✗ — known limit] The verify commands check structure, citations and keywords only. A well-formed brief with a wrong number or verdict passes them. The brief reads abstracts only, so numbers are the main risk. This is the job of the manual spot-check (confirmed "yes" by the owner, not itemised) and of `request-review`.

## SOLID and heuristics, Fowler smells, Code style

- [✓] Not applicable: no code. The brief repeats some numbers across sections (for example 58.2% to 14.3%), each tied to the same source. Not a smell for a research brief.

## Red flags

- I considered skipping the `security-review` scan because P2 allows it. Reason stated: no executable change.
- I considered treating the owner's single "yes" as itemised confirmation of five spot-check steps. I recorded it as one answer to the whole prompt.

## Result

All applicable items pass, with the two noted exceptions (undated sources, waived; verify commands cannot check claim accuracy). Next: `request-review`, capped at 2 rounds. Ask the reviewers to check claims against the full texts, not only the abstracts.

## Addendum, 2026-11-10: changes after this audit

The audit ran on commit `2ce7854`. Two request-review rounds then changed the
brief (commits `2e09f9e` and `5d8089a`): sources grew from 32 to 43 (S33 to
S43), the H21 and H23 verdicts were rewritten, and several claims were
corrected after checks against the full texts. The eight task verify commands,
`check-brief.sh` and Preflight were re-run on the final text and all pass.
The AND-gate did not pass in either round, and the owner waived it
(`specs/state.yaml`). The addendum does not re-run the checklist.
