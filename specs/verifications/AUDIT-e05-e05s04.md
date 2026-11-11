# Audit: e05s04 (PR template and protected main)

Story: e05s04
Mode: default (full checklist). Diff: branch
`e05s04-pr-template-protected-main` against `main` (d322c6a), plus the
untracked files. Files reviewed (churn rank,
`scripts/bp-churn-rank.sh --since 90.days`): `state.yaml` (churn hotspot,
read as a diff), `execution-status.yaml`, the e05 `epic.yaml`, the e05s04
tasks file, the new story spec, `.github/pull_request_template.md` and the
verify evidence file.

VERDICT: PASS

No checklist item failed. The story changes no code. Its one exception
(`gh api`) is recorded as a waiver in `specs/state.yaml`.

## Checklist

### Supply Chain & Security
- ✓ No new packages. The spec's slopcheck section says so.
- ✓ No `[SLOP]` packages.
- ✓ No secrets in the diff. Scanned `sk-`, `ghp_`, `AKIA` and `.env` on the
  full branch diff and on each new file. No matches.
- ✓ OWASP spot-check: the only executable surface is a GitHub branch
  protection call (task 3). It sends a fixed JSON body, with no user input.
  It needs the owner's go-ahead, which was given on 2026-11-11.
- ✓ Security: no HIGH findings. The story is P2, so the security scan was
  skipped by risk policy (verify-work evidence).

### Provenance & Metadata
- ✓ The new story spec, tasks file and evidence file carry `type`, `risk`
  and `context` metadata. The PR template has no provenance marker.
- ✓ The spec cites the source for its GitHub rules (docs.github.com branch
  protection endpoint, via ctx7, accessed 2026-11-11).

### Law of Demeter
- ✓ N/A. No code.

### CONVENTIONS.md Compliance
- ✓ All output files are in `specs/` or `.github/`. No new docs in the root.
- ✓ No `gh issue create` call anywhere in the diff.
- ✓ `gh` use is an exception, not a breach. Task 2 records it as a waiver in
  `state.yaml` (scope e05s04, date 2026-11-11), and the owner allowed it.
  The calls are `gh api` GET and PUT on
  `repos/{owner}/{repo}/branches/main/protection`, nothing else.
- ✓ No `api.github.com`, `curl` or fetch calls in the new or changed files.
  The only REST path in the diff is the protection endpoint above.

### Scope
- ✓ Changes are limited to the three tasks and the planning files for
  e05s04.
- ✓ No speculative features. The spec's out-of-scope section names rulesets,
  CODEOWNERS and signed commits as excluded.
- ✓ No files touched outside the story's scope. `state.yaml` also carries
  the timing counters that the skill scripts write. Those are expected.
- ✓ Discovered defects: none. Preflight is green (verify-work evidence).
- ✓ Boy Scout Rule: no code files opened. Planning files edited were only
  the e05s04 entries.

### Boy Scout Rule
- ✓ No dead code and no commented-out code added.

### Types and Safety
- ✓ N/A. No TypeScript or Python changed.

### Test Coverage
- ✓ Each task has a `verify:` command, and each was re-run after its change
  (verify-work evidence: T1, T2 and T3 PASS).
- ✓ Task 3 verifies the live GitHub setting, not a local copy.
- ✓ F.I.R.S.T: N/A. No test files in the diff.

### SOLID and Heuristics
- ✓ N/A. No modules changed.

### Refactoring Smells (Fowler)
- ✓ None detected in the new markdown and YAML.

### Code Style (CONVENTIONS.md)
- ✓ N/A for function and file rules. Story YAML passes `yamllint specs`
  (80 columns, `---` start).
- ✓ Comments in the tasks file say why (the owner's choices and the reason
  for classic protection over rulesets).

### Red Flags
- Checked whether the `gh api` exception could be a scope creep. It is
  narrow (one endpoint, one branch) and waived in writing, so it stands.
- Checked whether the new check name `checks` matches the CI job. It does
  (`.github/workflows/ci.yml`, job `checks`).

## Findings to carry forward (not blocking)
- The PR for this story is the first one the new rules apply to. It needs a
  green `checks` run and must be up to date with `main` before merge.
- `specs/state.yaml` has the owner's deferred items (experiment task source,
  spend cap, `engines.node` low item). They stay in the handoff note.
