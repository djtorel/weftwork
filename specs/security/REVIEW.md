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

## Addendum for e06s01 at b69ecf0 (2026-11-12)

The scan above ran before the `failUnreadable` helper in src/cli.ts
(part of b69ecf0). The re-check covers that change only. The helper
prints a static error string, or a message from parseRequest, which
has four fixed strings. The input-size message interpolates the cap
constant, not input. No sink changed: spawn, the command, and the cwd
are as reviewed. No new finding, none at confidence 8 or above.
Result for the release gate: REVIEW.md matches the branch diff at
b69ecf0.

# Security review for branch e06s02-fail-closed-tree (e06s02, fail closed and the tree fingerprint)

review_date: 2026-11-12
branch: e06s02-fail-closed-tree
base: main (1fb4c2d)
scope: src/tree.ts, src/gate.ts, src/cli.ts (product code); the test files,
  test helper and fixtures are excluded from production risk (rule 12)
method: security-review 5-phase scan, read-only, confidence cutoff 8, with
  two behaviour probes run on the code
threat model: specs/security/epics/e06/THREAT_MODEL.md (T5, T6, T7; C5, C6,
  C7, C10)

## Scope resolution and context

- TypeScript on Node 26, no dependency change, no new package. New sinks:
  `git` run with an argument array (tree.ts), file reads and `lstat` on
  paths that git lists (tree.ts), and `process.kill(-pid, 'SIGKILL')`
  (gate.ts).
- Inputs that reach them: the declared `cwd` and `command` from stdin, the
  file names and config of the repository under test, and `timeoutMs`.

## Vulnerability assessment (phase 3)

| Surface | Result |
|---------|--------|
| Git config that runs a program (CWE-78) | Probed. A repository with `core.fsmonitor` set to a script: plain `git status` runs the script (control); `fingerprintTree` does not. Mitigated by `-c core.fsmonitor=false`. |
| Shell string in tree.ts (CWE-78) | None. `execFile` with an argument array; the task verify greps for `shell:`, `execSync` and `exec(`. |
| Symlink followed out of the tree (CWE-59) | Not followed. Each entry gets `lstat`; a link is hashed as its target string. Tested with a link to a file outside the repository. |
| FIFO or socket opened (CWE-400) | Never opened; kind `other`. Tested with a FIFO, 5 s limit. |
| Path handling | Paths stay as bytes; names with a newline, a leading `-` or invalid UTF-8 are tested. No path is passed to git as an argument. |
| Kill of the wrong process (CWE-283) | `-pid` of a child the engine spawned with `detached: true`. A reused group id after the group is empty is possible in theory and tiny; `ESRCH` is ignored. |
| `timeoutMs` overflow | Bounded to 1 to 2147483647, tested at the edges. |
| Fail-open (CWE-754) | Every path to `done: true` needs `passed`: exit 0 and an equal tree. Errors give `no-tree`, `not-started`, `signal` or `timeout`. Tested by name. |
| Information exposure (CWE-200) | The verdict echoes `command` on stdout. The host already holds that string. Threat model T8 covers it. |
| Resource use | Unbounded hashing of a very large tree and a 256 MiB listing cap. DOS is excluded (rules 1 and 4); e09 owns a cap. |
| Test files | Excluded, rule 12. |

## Findings

No finding at confidence 8 or above that is a vulnerability in the diff. No
HIGH finding.

One MEDIUM residual, confidence 9 that it exists, reported as a documented
limit and not a defect:

- **src/gate.ts, runCommand: the process-group kill does not reach a process
  that leaves the group.** Probe: `setsid sleep 20 & echo $! > pidfile;
  sleep 0.5` returned `passed`, and the `sleep` was still alive after the
  gate (its session id equalled its pid). A command that does this can edit
  the tree after the second fingerprint, and the verdict stays `passed`.
  - Exploit scenario: the declared command starts a daemon that rewrites a
    tracked file after the gate has returned.
  - Why it is not HIGH: the command comes from the owner's plan (threat
    model C1), the gate is evidence against an honest command and not a
    sandbox, and closing it needs a PID namespace or a cgroup, which is out
    of scope for e06.
  - Recorded in the e06s02 spec (Risks) and the threat model (T6 residual).
    Owned by e09 and e10.

## Result for audit-code

"diff scanned — no unaddressed HIGH findings": PASS for e06s02. The MEDIUM
residual is documented above and in the threat model.

## Addendum for e06s02 at 92190e7 (2026-11-12)

The review above ran before the audit refactor (d05be85): runCommand split
into runCommand and watchChild, runGate into runAndCompare and settle, two
casts replaced by type checks, and kind in tree.ts typed as a union. The
re-check ran the same four probes against the committed code. A hostile
core.fsmonitor in the repository config did not run (control: plain git
status runs it). A symlink target's content change left the fingerprint
unchanged. A timeout ended the whole process group. The setsid command
still left the group, which is the MEDIUM residual already recorded. The
spawn call, the git calls and the kill are unchanged in what they do. No
new finding, none at confidence 8 or above. Result for the release gate:
REVIEW.md matches the branch diff at 92190e7.

## Addendum for e06s03 at c59e330 (2026-11-12)

branch: e06s03-counts-ledger, review of src/ledger.ts, src/gate.ts, src/cli.ts
method: security-review 5-phase scan, read-only, plus two probes by hand
re-review trigger met: threat model T3 (ledger writer and reader)

### Executable surface

1. `ledgerPath` in src/ledger.ts runs `git -c core.fsmonitor=false
   rev-parse --absolute-git-dir` with `execFile` and an argument array. No
   shell, and `cwd` is an option, never an argument.
2. `appendEntry` creates `<git dir>/weftwork/` and appends one line.
3. `readLedger` reads the file and parses each line.
4. `record` in src/gate.ts calls 1 and 2 after the verdict is settled and
   may turn a `passed` verdict into `no-ledger`.

No new package, no new `spawn`, no network, no `eval` or dynamic import.

### Scope and context

- Languages: TypeScript on Node 26. No dependency file changed.
- The ledger sits inside `.git`, which git never lists, so a write cannot
  change the tree fingerprint (tested, AC-02).
- The gate never reads the ledger (control C4). `grep readLedger
  src/gate.ts` finds nothing, and AC-12 forges a done entry and shows the
  verdict still comes from the run.

### Assessment (phase 3)

| Check | Result |
|-------|--------|
| Command injection (CWE-78) | None. Argument array, no shell, `core.fsmonitor=false`. |
| Log injection (CWE-117, C3) | Held. Entries are `JSON.stringify`; a newline in a command is escaped (AC-04). A leading newline ends a torn line (AC-06). |
| Fail open (CWE-754, T7) | Held. A `passed` verdict that cannot be logged is `done: false`, reason `no-ledger` (AC-11). A missing git working tree is treated as a failed append. `appendEntry` and `ledgerPath` never throw. |
| Forged ledger (T3) | Held by design. A forged done does not change a verdict (AC-12). A stale done is not fresh (AC-13). Erasure is still possible and is accepted residual. |
| Deserialization (CWE-502) | None. `JSON.parse` of plain data; fields are checked by type and unknown keys are dropped. |
| Path traversal (CWE-22) | The path is built from git's own output plus two fixed names. No input joins it. |

### Findings

Confidence is 0 to 10. A HIGH finding at 8 or more blocks. There are none.

### F1. `appendEntry` follows symlinks — LOW — CWE-59 — confidence 9

src/ledger.ts, `appendEntry`. `mkdir` and `appendFile` follow a symlink at
`.git/weftwork` or at `.git/weftwork/ledger.jsonl`. Probed by hand: with
`.git/weftwork` a symlink to a directory elsewhere, the CLI wrote
`ledger.jsonl` in that directory.

- Exploit scenario: an agent that can write in `.git` points the ledger at a
  file the user can write, and the next run appends one JSON line to it.
- Why it is LOW: the agent already runs as the same user and can write that
  file directly, so it gains nothing. The line is JSON, not a shell line.
- Recommendation, not done: open the file with `O_NOFOLLOW` (Node
  `fs.constants.O_NOFOLLOW`) and `lstat` the directory. Fix when e10 sets
  the trust baseline. Accepted residual, added to threat model T3.

### F2. The ledger takes the default file mode — LOW — CWE-276 — confidence 8 — FIXED

src/ledger.ts, `appendEntry`. Probed by hand: the directory is 755 and the
file 644 under a normal umask. The file holds each command string (T8), so
another local user can read a command that holds a token.

- Recommendation: pass `mode: 0o700` to `mkdir` and `mode: 0o600` to
  `appendFile`. One line each, and it narrows the T8 exposure. Not applied
  in the first pass. Applied after the owner's go-ahead (2026-11-12): AC-02
  now checks that no group or other bit is set, and a mutation without the
  modes fails it.

### F3. The ledger has no size cap, and `readLedger` reads all of it — LOW — CWE-400 — confidence 8

src/ledger.ts, `readLedger`. `readFile` holds the whole file. A very large
ledger costs memory. Nothing in the gate path reads it today, so the gate is
not affected. e06s04 will read it for the breaker.

- Recommendation: e06s04 caps what it reads (for example the last 1 MiB),
  and e09 adds rotation. Already in the spec's out-of-scope list.

#### Not findings

- A failed write to stderr in `note` could end the process with a non-zero
  exit. That is not done, so it fails closed. Not reported.
- Two writers at once can interleave a very long line. The reader skips it
  and counts it in `skipped`. Documented in the spec.

### Result for audit-code

HIGH findings at confidence 8 or more: 0. MEDIUM: 0. LOW: 3 (F1 to F3), all
documented, none blocking. F2 needs an owner decision: apply the two mode
arguments now, or leave it.

Diff scanned: no unaddressed HIGH findings.

## Addendum for e06s04 (2026-11-12, verify-work step 5)

Scope: `git diff main...HEAD -- src` on e06s04-terminal-states-breaker (17
files, plus the signal, ledger tail, state-line and gate changes). Read
against threat model T3, T6, T7, C4, C7 and F3. The stop rules and the kill
path were read in full. A process test ran the real CLI with a SIGTERM
sent while stdin was still open.

### F4. SIGTERM and SIGINT do nothing while stdin is open — MEDIUM — CWE-400 — confidence 9 — FIXED

Fixed on e06s04 in `4e03219` (fix(engine)). The stdin read stops on abort and
answers killed, exit 6. Tests: `src/cli.signal.test.ts` (SIGTERM and SIGINT
with stdin open). The recommendation below was implemented as written.

src/cli.ts, the signal listeners. `process.on('SIGTERM', abort)` is installed
before `readInput()`. Once a listener is set, Node no longer exits on SIGTERM
(Node 26 `process` docs). While the host holds stdin open, `readInput` keeps
waiting, and the abort only sets a flag that nothing reads yet.

- Probe: `spawn` the CLI, send SIGTERM at 0.5 s, keep stdin open. The process
  stayed alive for 4 s and exited only when stdin was ended (code 6, command
  not run). Before e06s04 the same SIGTERM ended Node at once.
- Exploit scenario: a host or an operator stops the engine with SIGTERM while
  the host still holds the pipe, as a hung caller does. The engine does not
  stop until the pipe closes, and a stuck caller keeps it alive. The CLI
  header says SIGTERM "stop[s] the declared command ... and end[s] with exit 6",
  which is false in this window.
- Why MEDIUM: an availability hang, not a verdict change. No `done` is
  produced, the command does not run, and the input is capped at 1 MiB.
- Recommendation: make the read cancellable. Reject the stdin read when the
  signal aborts, then answer `killed` and exit 6 at once. Example:
  `const input = await readInput(controller.signal)`, with `readInput`
  resolving null on abort and the caller then calling `failUnreadable` or
  printing a killed answer. Add a test that sends SIGTERM before stdin is
  closed and expects exit 6 within 2 s.

### F5. The stop rules switch off when the ledger cannot be read — LOW — CWE-754 — confidence 8

src/engine.ts, `readEntries`. An unreadable ledger returns no entries, so
`checkCeiling` and `checkStall` never trip, and the run goes on (AC-28
asserts this). `done` stays fail-closed: a passing run whose write also
fails becomes `no-ledger`, so no false done. The loss is the loop bound.

- Probe: `mkdir .git/weftwork/ledger.jsonl`. The first `exit 7` answers
  `failed`, and the second answers not done with the stop rules off.
- Scenario: an agent in a loop makes the ledger unreadable (a directory, or a
  symlink, which F1 already allows) to remove the stop rules, the same class
  as T3 erasure. Its effect is a longer loop, not a false done.
- Why LOW: the agent already has write access to the file (T3). This is a
  documented residual, not a new one.
- Recommendation for e08 or e09, not e06s04: decide whether an unreadable
  ledger should fail the loop closed (answer exhausted), which needs a
  deliberate owner decision. Record the choice in the threat model.

### Checked and clean

- No string-built shell in the new code. `runCommand` is the only spawn, with
  the declared `command` and nothing else (C2). `engine.ts` and `ledger.ts` do
  not call `exec` or a shell.
- `done` cannot come from the ledger. `engine.ts` takes `done` only from the
  `runGate` verdict, and AC-27 asserts this with a forged done run line and a
  forged done state line.
- A `killed` abort, a pre-aborted signal and a late abort (after exit) all
  leave `done` false or unchanged (AC-16, AC-17 and the late-abort case).
- The tail read is bounded: `readLedgerTail` reads at most 1 MiB by byte
  offset and drops the cut fragment (F3 is fixed for the stop-rule path).
- State-line `detail` holds the worker's `blocked` text (1 to 1000 characters,
  not only spaces) and fixed count text. It is written by `JSON.stringify`, so
  a newline cannot start a second line (C3).
- The process-group kill (C7) is unchanged in what it does. The abort path
  calls the same `killGroup`.

### Result for verify-work

No HIGH finding. F4 (MEDIUM) is fixed and tested. One LOW residual remains
(F5, confidence 8, owned by e08 or e09). The setsid residual (T6, MEDIUM) is
unchanged.

### Re-check of the refactor commits (2026-11-12, release-branch)

Commits b561f3e and 058d659 moved the child-process control into
src/process.ts and split the CLI input reader. Read against the scan above:
killGroup, the timeout, the abort and the close-time kill are unchanged in
what they do. The abort path still ends the whole group with SIGKILL, and the
disarm still clears the timer and the abort listener. The stdin reader still
stops on abort and on every read error. No new finding.
