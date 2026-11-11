# Audit: e03s07 (R13 enforcement design), branch e03s07-r13-enforcement-design

Scope: branch diff against main (`git diff main...HEAD`, 13 files, 1039 insertions, 97 deletions). The branch has no product code. The diff is one research brief, its story spec and tasks, planning ledgers and state. Checklist items that apply only to code are marked N/A with the reason.

Mode: default (full checklist). Churn rank: `scripts/bp-churn-rank.sh --since 90.days` lists specs/state.yaml first (26 changes), then execution-status.yaml (22) and e03s07-tasks.yaml (11). Each was reviewed; the state diff is covered below.

## Result: FAIL (1 item). Not ready for commit-message.

## Checklist

### Supply Chain & Security
- ✓ slopcheck for new dependencies: none added. No package manifest changed.
- ✓ No `[SLOP]` packages: N/A, no packages.
- ✓ No secrets in diff. One pattern hit was a false positive: `risk-adaptive` in the arXiv query list matches `sk-[A-Za-z0-9]{8,}`. Checked by hand; no key, token or credential in the diff.
- ✓ OWASP spot-check: no code shipped, so no injection, auth or data-exposure surface in the diff. The research did call external services (arXiv, Crossref, Europe PMC, vendor doc sites, raw GitHub files) from the session, not from shipped code. Recorded here so it is not forgotten.
- ✓ Security findings: no HIGH findings. security-review was not run because P2 skips it, and the e03 threat-model step is waived in state.yaml.

### Provenance & Metadata
- ✓ New plan artefacts include `type:` and `context:`. Story spec: `type: research`, `context: infra`. Tasks file: both fields set.
- ✓ Decisions reference dates and a commit: the spec cites the owner decisions of 2026-11-10 and the plan commit 21ef570 (source S47).

### Law of Demeter
- N/A. No code.

### CONVENTIONS.md Compliance
- ✓ Output files under specs/ or docs/research/ (the brief location CONVENTIONS requires).
- ✓ No `gh issue create` in the diff.
- ✓ `gh` not used in the branch diff. Session fetches used curl, git ls-remote and raw files; no `gh api` or `api.github.com`.
- ✓ No GitHub REST API call in the diff.
- ✓ Story trailer on all 14 branch commits (`Story: e03s07`), checked commit by commit.
- ✓ No AI attribution footer. "Claude Code" appears in the body of one commit message as a product name, not as an attribution footer.

### Scope
- ✓ Changes limited to e03s07 and the approved hypothesis and renumbering changes (H27, H1-H27 in SCOPE, glossary, e04 epic, e04s02 tasks). Those were owner decisions on 2026-11-10.
- ✓ No speculative features. No new research story added (the brief's Open questions say "none").
- ✓ No file outside the stated scope, except specs/state.yaml (see Boy Scout below).
- ✗ **Gate failure, not a scope item:** see the Verify line below.

### Boy Scout Rule
- ✗ **Should fix, not a gate:** specs/state.yaml shows 54 removed lines and 54 added lines against main. The semantic check passed: `waivers` is unchanged apart from two appended entries, and the only changed top-level keys are `active_story`, `vcs.branch` and `handoff`, all intended. The rest is reflow from `bp-timing.sh`, the same write-back that caused BUG-001. Reflowed text is harmless but makes the diff hard to review. Fix before release: restore the unchanged blocks from main, or make the timing helper preserve the file.
- ✓ No dead code or commented-out code: N/A for prose; the brief and spec contain none.

### Types and Safety
- N/A. No code.

### Test Coverage
- N/A for unit tests. The nine task `verify:` commands are the tests for this story. They were run in one contiguous pass in verify-work (exit 0 for all nine) and `check-briefs.sh` exits 0 for all briefs.

### SOLID and Heuristics
- N/A. No code. `HEURISTICS.md` (G, N, C, T) applies to code.

### Refactoring Smells (Fowler)
- N/A. No code.

### Code Style (CONVENTIONS.md)
- ✓ YAML lines at or under 80 columns and `---` at the start: yamllint passes on specs/ (Preflight).
- N/A for function length, file length and indentation. These apply to code, and the brief and spec are prose.

### Red Flags
- Rationalization caught: the failing `verify:` line below could be dismissed as "BUG-003 is closed, so it is pre-existing" or "a global skill, not this repo". CONVENTIONS bans that wording, and the line fails on every run, so it is a reproducible gate failure. It is recorded here as a failure.

## Failed item in detail

- ✗ **Verify line of this skill fails.** `test -f CONVENTIONS.md && test -d skills/enforce-first && test -d skills/request-review` exits 1. The two directories are not in this repository. They live in the global skill install (`~/.claude/skills/`). BUG-003 (`specs/bugs/BUG-003-audit-code-verify-line-fails-in-repo.md`) describes this exact failure and is marked `closed`, but it still reproduces on this branch.
  - Required action: reopen BUG-003 (reopen, do not refile, per the Lifecycle Gates), then fix it with `fix-bug` in a separate commit.
  - The fix would edit `~/.claude/skills/audit-code/SKILL.md`, which is outside this repository. CONVENTIONS requires the owner's go-ahead for that, so it is not done here.

## Summary for the owner

| Section | Result |
| --- | --- |
| Supply Chain & Security | PASS (1 false-positive secret hit, cleared) |
| Provenance & Metadata | PASS |
| Law of Demeter | N/A |
| CONVENTIONS.md Compliance | PASS |
| Scope | PASS, with the state.yaml reflow noted |
| Boy Scout Rule | FAIL (state.yaml reflow, should fix) |
| Types and Safety | N/A |
| Test Coverage | N/A, verify commands covered in verify-work |
| SOLID and Heuristics | N/A |
| Refactoring Smells | N/A |
| Code Style | PASS for YAML; prose items N/A |
| Verify line | FAIL (BUG-003, reproducible) |

Overall: FAIL. Two items need action before commit-message: the BUG-003 verify line (needs owner go-ahead to edit the global skill) and the state.yaml reflow (should fix).
