# Security review for branch e05s04-pr-template-protected-main (e05s04, PR template and protected main)

review_date: 2026-11-11
branch: e05s04-pr-template-protected-main
base: main (d322c6a)
head: 11e690d (two story commits; state.yaml uncommitted, see scope)
scope: git diff main...HEAD, plus the uncommitted specs/state.yaml
method: security-review 5-phase scan, read-only

## Executable surface

The branch has no product code. Its only executable surface is:

1. The task 3 verify command in specs/epics/archive/e05-repo-and-environment/e05s04-tasks.yaml. It runs `gh api` with a fixed endpoint, `repos/{owner}/{repo}/branches/main/protection`, and parses the reply with `python3 -I`. No user input reaches it.
2. The one-off `gh api -X PUT` that set branch protection on main. Its JSON body is fixed, with no user input.

## Scope resolution

- Changed: .github/pull_request_template.md (new), the e05s04 story spec, tasks file, epic.yaml and execution-status.yaml, verify evidence, AUDIT-e05-e05s04.md, AUDIT_LATEST.md, and state.yaml (uncommitted).
- Languages: Markdown, YAML. No dependency files changed. No new packages.

## Context research

- The protection call uses the owner's `gh` login. It needs no token in the repo. No credentials appear in the diff.
- The `checks` status name must match the CI job in .github/workflows/ci.yml (`jobs.checks`). It does.

## Vulnerability assessment

| Check | Result |
|-------|--------|
| Secrets (sk-, ghp_, AKIA, .env values, private keys) | None in the branch diff or new files |
| Injection (shell, SQL, template) | None. Verify commands use fixed strings. |
| Auth boundary change | Intended. Protection now requires a PR and a passing `checks` run before merge to main, and applies to admins (`enforce_admins: true`). This tightens the boundary. |
| Unsafe deserialization | None. The verify command parses a fixed JSON reply with `json.load`. |
| Path traversal | None. Paths are fixed. |
| Outbound requests | Only the `gh api` calls to the GitHub protection endpoint. No curl or fetch to api.github.com in the code. |
| Weakened control | None. Force pushes and branch deletion stay blocked. Required approvals is 0, which is a deliberate single-owner choice (spec §3, §6). It does not weaken the PR and CI requirement. |

## Findings

None at confidence 8 or above.

Below-threshold notes (not reported as findings):
- Required approvals set to 0. This is a deliberate single-owner choice, recorded in the spec. A second owner would change it.
- The verify command uses `{owner}/{repo}` placeholders. `gh` fills them from the current repository. There is no injection path.

## Decision

PASS for this branch. Gate 2a is satisfied. No HIGH findings.
