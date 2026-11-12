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

# Security review for branch e06s01-gate-tracer (e06s01, run a declared command)

review_date: 2026-11-12
branch: e06s01-gate-tracer
base: main (4975ebb)
scope: src/gate.ts, src/cli.ts (product code); src/gate.test.ts and
  src/cli.test.ts (test files, excluded from production risk by rule 12)
method: security-review 5-phase scan, read-only, confidence cutoff 8
threat model: specs/security/epics/e06/THREAT_MODEL.md (T1 to T8, C1 to C10)

## Scope resolution and context

- Languages: TypeScript on Node 26. No dependency change. No new package.
- Inputs: one JSON object on stdin (at most 1 MiB), read by cli.ts and
  parsed by parseRequest in gate.ts.
- Sinks: spawn with shell: true in runGate (gate.ts), the command as one
  shell string, cwd from the request or process.cwd(). Stdout carries
  the verdict JSON only. The child's stdout and stderr go to the engine's
  stderr.
- Existing patterns: the e05 PR review found none of this surface. This
  is the first product code in the repo.

## Vulnerability assessment (phase 3)

Traced stdin → parseRequest → runGate → spawn. The only attacker-reachable
value that reaches a sink is `command` (shell code, by design) and `cwd`.
Both come from the declared request, not from the code path.

| Surface | Result |
|---------|--------|
| Command injection via `command` (CWE-78) | Suppressed, see below |
| Path traversal via `cwd` (CWE-22) | Suppressed, same trust as command |
| Unbounded stdin (CWE-400) | Capped at 1 MiB; DOS is excluded (rule 1) |
| Error text reflected to stdout (CWE-209) | Static strings only; no input echoed |
| Information exposure via inherited env (CWE-200) | Suppressed, precedent 3 |
| Child output on stderr | Suppressed, log spoofing excluded (rule 13); T8 residual owned by e10 |
| Shell-string secrets in `command` | Owner's plan responsibility (C1); no secret handled here |
| NUL-byte crash (fixed in this story) | Not exploitable: spawn throws, caught, returns not done |
| Fail-open (CWE-754) | Every error path resolves done: false; tested (AC-04, AC-06) |
| Test files | Excluded, rule 12 |

## False-positive filtering (phase 4)

- **Command injection (CWE-78), confidence 7, suppressed.** The engine
  runs `command` as shell code by design. An attacker who can set
  `command` already runs code as this user, so the engine gives no new
  privilege. The shell-script precedent (11) says report only with a
  concrete untrusted-input path. None exists in this diff: the owner's
  plan supplies the command (C1). Not reported as HIGH.
- **Re-open trigger:** e07, when a host forwards agent-supplied content
  into the stdin JSON. At that point the command-is-code surface becomes
  a concrete untrusted path (threat model T1). Re-run this scan then.

## Findings

No findings at confidence 8 or above. No HIGH findings.

## Result for audit-code

"diff scanned — no unaddressed HIGH findings": PASS for e06s01.
Residual risks recorded in the threat model, not in this report:
T1 (command choice), T3 and T4 (agent-writable ledger and override,
e06s03 and e06s05), T8 (output and env pass-through, e10).
