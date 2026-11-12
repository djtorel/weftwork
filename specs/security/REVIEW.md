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

## Addendum for e06s05 (2026-11-12, verify-work step 5)

Scope: `git diff main...HEAD -- src` on e06s05-one-shot-escape-hatch (11 files,
940 lines added; the new code is src/override.ts, plus the overrideAnswer step
in src/engine.ts, the state-line fields in src/ledger.ts and the states table).
Read against threat model T4, the silence rule (R13 [S56]), C4 and T3. Every
new function was read in full. No process probe was run for this addendum.

### Findings at or above confidence 8

None.

### Below the reporting threshold (confidence 6, not reproduced)

These are suppressed by the 8/10 rule. They are recorded so the owner can see
them. Both need a local writer who can swap `override.json` during a window of
microseconds, and that writer already has the T4 power to write a record.

- **Race between lstat and open, FIFO (CWE-367).** `readOverride` runs `lstat`,
  then `open(O_RDONLY|O_NOFOLLOW)` without `O_NONBLOCK`. A FIFO swapped in
  between the two calls makes the open block until a writer appears. The
  engine's `overrideAnswer` does not watch the abort signal, so a SIGTERM
  would not stop the wait. Effect: the engine hangs (an availability problem,
  as F4 was). Possible fix: open with `O_NONBLOCK`, then `fstat` the handle
  and require `isFile()`. **Fixed after review round 1 (3b7c164):** the open
  now uses `O_NOFOLLOW | O_NONBLOCK`, `lstat` is gone, and `fstat` on the
  handle checks the type. The FIFO test fails if `O_NONBLOCK` is removed.
- **Read, then rename of a different file (CWE-367).** `takeOverride` validates
  the record it reads, then renames whatever is at `override.json` at rename
  time. A swap between the two calls consumes the second file, which was never
  validated, and logs the author and reason of the first. Effect: an owner
  record for another run could be used up, and the log would name the wrong
  author. Possible fix: after the rename, read the moved `override.used-*`
  file and compare it with the text that was validated, or hold a lock.

### Checked and clean

- **Exact match, no pattern.** `takeOverride` compares the command and the
  fingerprint with `===`. `parseOverride` rejects a command made only of
  glob or regex characters. A `*` inside a real command matches only itself.
- **Size and file type.** `readOverride` checks `lstat` (regular file only,
  under 64 KiB), opens with `O_NOFOLLOW`, and reads into a buffer of
  64 KiB + 1 bytes. A symlink is refused. `rename` acts on the directory entry,
  so it cannot move a symlink's target. A FIFO at rest is never opened.
- **One use.** The rename is atomic. A second taker finds no file and gets
  null, and tests cover two takers at once (AC-11).
- **Silence rule.** `takeOverride` and `readOverride` never write to stdout or
  stderr. `overrideAnswer` writes a line only after the record is taken. A bad,
  missing, or non-matching record adds no output (AC-19, byte-identical CLI
  runs, and no occurrence of "overrid" or "hatch" in either stream).
- **Only failed and stalled runs.** `overrideAnswer` returns early for every
  other state. `exhausted` is decided before the run, and it outranks stalled
  after it. `blocked`, `killed` and `done` never reach the record (AC-14).
- **done is not reachable from the record.** `gate.ts` does not import or
  mention `override`. `done` still comes only from `runGate`. A forged done
  run and a forged overridden state line in the ledger leave `done` false
  (AC-18).
- **Ceiling not reset.** The overridden run is logged by `runGate` as a failed
  run, so `failingRun`, `checkCeiling` and `checkStall` count it (AC-16).
- **Ledger injection.** Every field of the state line goes through
  `JSON.stringify`, so a newline in a reason or author cannot start a second
  line (C3). The reason and author are length-capped (1000 and 200) and
  rejected when blank.
- **Shell.** `override.ts` and `engine.ts` have no `exec`, `execSync` or
  `shell:` (checked by the task 2 and task 4 verify commands).
- **Path.** The record path is `dirname(ledgerPath)/override.json`. The
  ledger path comes from `git rev-parse --absolute-git-dir`, not from the
  request, so the request cannot move the record.

### Result for verify-work

No HIGH or MEDIUM finding at confidence 8 or above. The two items above are
suppressed at confidence 6 and do not block the gate. The T4 residual
(authorship of the record is not proof) is unchanged and stays documented in
the threat model.

## Addendum for e07s01 (2026-11-12, verify-work step 5; revised after review
round 1)

Scope: `git diff main...HEAD -- src` on e07s01-claude-stop-hook (4 files:
src/claude-hook.ts, src/claude-hook-cli.ts and their tests). Read against
threat model T1 (the declared command is the owner's) and the host contract
for the Stop hook. Every new function was read in full. Probes beyond the
story's own tests: the UAT steps, and in review rounds 1 and 2 the reviewers
ran the real CLI against throwaway repositories.

### Findings at or above confidence 8

- **The command ran in the agent's directory (confidence 9). Fixed in round
  1 of review.** The first version of this addendum called the hook's `cwd`
  "trusted, confidence 6". That was wrong. The host is trusted, but the value
  it sends is the agent's working directory: the hooks docs (read 2026-11-12)
  say the Stop input's `cwd` is "the new directory after Claude runs `cd`".
  An agent could write a passing `check.sh` in a sub directory, `cd` into it
  and stop, and the owner's check would run there and answer done. Two
  reviewers found it independently and one reproduced it. Fix: the command
  runs in `CLAUDE_PROJECT_DIR`, which "stays put", the Stop input's fields
  are never read, and an unset, empty or relative variable blocks the stop
  (AC-e07s01-11). Round 2 tried `..`, a symlink, a file, `/`, a newline and a
  missing path: each runs in the right repository or ends in a block.
  Residual: in a worktree session the gate checks the main checkout (spec
  section 6).

### Below the reporting threshold (confidence 6, recorded)

- **Fail-open on a crash.** The host treats any exit code other than 2 as a
  non-blocking error. An uncaught throw from `runEngine`, or a stdin read
  error, ends the CLI with exit 1 and the stop goes ahead. The CLI header
  states it. e07s02 owns the fault list and e07s04 checks for it.
- **Stdin has no size cap, and a host that never closes it.** `readStdin`
  reads to the end of input. The writer is the host, not the agent. e07s02
  adds the cap and the timeout, as in src/cli.ts. It also covers the CLI
  exiting 2 on a bad directory or argument before it reads stdin (a host
  still writing could see EPIPE; exit 2 still blocks).
- **Host environment reaches the engine's git calls.** `GIT_DIR`,
  `GIT_WORK_TREE` and `GIT_INDEX_FILE` in the hook's environment would move
  the fingerprint. Only the host and the owner's settings `env` set them, and
  the agent cannot reach them except by editing settings.json, which is e10.
  Note for e10 and e07s04.

### Checked and clean

- **Shell.** The new files have no `exec`, `spawn`, `shell:`, `eval` or file
  access (grep of both files). The only process that starts is the engine's,
  through `runEngine`.
- **Command source.** The command is the one argument after `--` from the
  owner's hook entry. The agent's text (`last_assistant_message`) is never
  read. `parseHookInput` reads no field at all (changed in round 1).
- **Blank command.** Refused by the engine CLI's own rule, through
  `parseRequest` (changed in round 1; before, `' '` answered done).
- **Output.** No message of weftwork's says "done" except after "not" (test
  AC-e07s01-04, which strips the owner's command and detail first). The
  declared command's output goes to stderr, so stdout holds only the host's
  JSON or nothing.

### Result for verify-work

One finding at confidence 9, fixed and covered by a test. Two items at
confidence 6 remain, and they do not block the gate. e07s02 and e07s04 own
all of the residuals above.

## Addendum for e07s02 (2026-11-12, verify-work step 5; revised after review
rounds 1 and 2)

Scope: `git diff main -- src` on e07s02-fail-closed-faults: the adapter
(src/claude-hook.ts, src/claude-hook-cli.ts), `src/ledger.ts` and `src/tree.ts`
(BUG-007), and their tests and test helpers. Read against threat model T1, T3,
T6 and T7 and the e07s01 addendum. Probes: the verify-work manual steps, the
CLI tests that start the real process, and the probes of four reviewers over
two rounds, which I repeated where it mattered.

My first scan of this story found nothing at confidence 8 or above. The
reviews found four things that were real. The first scan read the adapter and
`src/process.ts` but not how the engine opens files, so it missed F1; it also
rated F2 at confidence 6 on the guess that nothing would send two signals.

### Findings at or above confidence 8

- **F1. A FIFO where the engine opens a file hangs the hook, so the stop goes
  ahead — HIGH — CWE-400, T3 and T7 — confidence 9 — FIXED (BUG-007).** Round
  1, reviewer B, reproduced by me: `src/ledger.ts` opened the ledger with flags
  that block on a FIFO, at three sites (`readLedgerTail`, `readLedger`, and the
  append in `writeLine`, which nobody had probed). An agent that can write under
  `.git/` runs `mkfifo .git/weftwork/ledger.jsonl`; the engine then waits for
  ever in a thread-pool call nothing can abort. The hook cannot answer, and the
  host's timeout drops its output and lets the stop go ahead. A timer that
  calls `process.exit(2)` does not help: I measured `process.exit` and
  `process.reallyExit` in a process stuck opening a FIFO, and both ran until
  killed. Fix: `openRegular` opens with `O_NONBLOCK` and refuses anything but a
  regular file, the pattern `override.ts` already uses. A FIFO, a device or a
  directory is now a `no-ledger` answer, which the hook maps to exit 2.
  Round 2 found the same class at a second site (F4 below).
- **F2. A second SIGTERM or SIGINT ended the hook with exit 143 (fail-open) —
  MEDIUM — CWE-754 — confidence 9 — FIXED.** Both round 1 reviewers reproduced
  it (exit 143 at a 4 ms and a 10 ms gap); I had rated it 6. `process.once`
  left the second signal to Node's default action. The handlers use
  `process.on`; a test sends two signals 5 ms apart and fails with `once`.
- **F3. The hook had no deadline of its own — MEDIUM — T6 and T7 — confidence
  8 — FIXED for work that can be interrupted.** The engine's 600 s clock starts
  at spawn, the host's 660 s clock at the hook's start, so the "60 s margin" was
  about 50 s and nothing enforced it; and a SIGTERM did nothing while work that
  ignores the abort signal was pending, because the handler had replaced Node's
  default exit. Now the CLI arms `hookDeadlineMs` (645 s from start) and a 2 s
  grace timer after a signal; both write the block with `writeSync` and leave
  with exit 2. `WEFTWORK_HOOK_DEADLINE_MS` can only shorten the deadline: a
  longer, zero, negative, non-integer or non-numeric value is ignored (tested,
  and two reviewers tried hex, whitespace, `Infinity`, `-0`, `1e3`, `1e400`
  and 2^53 more). An agent cannot set the hook's environment except through
  settings.json (e10). Tests use a stub `git` that hangs as the work that
  cannot be aborted.
- **F4. `tree.ts` `hashFile` could hang the same way after a swap — MEDIUM —
  CWE-367 and CWE-400 — confidence 8 — FIXED (BUG-007).** Round 2, reviewer B,
  by reading; I confirmed the code path. The fingerprint called `lstat`, saw a
  regular file, then opened it with `createReadStream`, which blocks on a FIFO.
  A process the agent left running could swap the file in between. The
  reviewer's race of 3000 swaps against 300 fingerprints did not hit, so the
  window is narrow, but the hang is certain once a FIFO is reached: the test
  hangs on the old code. Fix: `hashFile` opens with
  `O_RDONLY | O_NONBLOCK | O_NOFOLLOW`, checks `fstat` on the open file, and a
  file that is no longer regular makes the fingerprint not ok (`no-tree`, exit
  2). Fingerprints of regular files are unchanged (the tree tests pass).

### Residuals from the e07s01 addendum, now closed

- **Fail-open on a crash.** An uncaught error or a stdin read error in `run`
  goes through `failClosed`. An error outside the awaited chain goes through the
  `uncaughtException` and `unhandledRejection` handlers, which abort the engine
  (so the command's process group is killed) and exit 2. Both are tested in the
  real process (AC-e07s02-14) by preloading a module that raises the error
  while a command runs. The rejection test runs with
  `--unhandled-rejections=warn`, because in Node's default mode a rejection
  becomes an uncaught exception and the first handler would catch it: without
  the flag the second handler's test passes when the handler is deleted.
- **No stdin cap, and a host that never closes stdin.** `readHookInput`
  enforces 1 MiB across chunks and a 10 s total deadline, and destroys the
  stream on every path (AC-e07s02-03 to -05). Memory stays bounded because the
  size check runs before each chunk is kept.

### Residuals that stay

- **A stuck `git` makes each Stop attempt cost the full deadline, and the
  process outlives the hook (T6, not fail-open).** Git blocks on a FIFO in
  several places. Reviewer A reproduced `.git/index` and `.git/HEAD` as FIFOs;
  reviewer B found, and I checked (git 2.56.1), that a FIFO named `.gitignore`
  in the working tree hangs `git ls-files --exclude-standard`, which needs no
  write under `.git/` (a FIFO named `.gitattributes` did not hang it). The hook
  leaves with exit 2 at its 645 s deadline, so the stop is blocked, not
  allowed; but every Stop attempt takes that long, and the engine's `execFile`
  calls for git in `tree.ts` and `ledger.ts` take no abort signal or timeout, so
  one stuck `git` stays per attempt. An agent that can create files can already
  start background processes (the setsid residual, T6), so the orphan is not a
  new capability; the delay is a cost to the owner. Passing the abort signal and
  a timeout to the git calls is an e06 change for its own story.
- **Other thread-pool calls blocked in a syscall.** F1 and F4 close the ones an
  agent can reach through the ledger and the fingerprint. A stalled network file
  system, for example, would still hold a call that no timer can end.
- **A signal in the first ~100 ms of start-up exits 143, and a crash before the
  handlers are installed exits 1.** Both reviewers reproduced the first. The
  impact is low, because the host's own timeout kill comes about 660 s after the
  start. The header lists these with SIGKILL as the fail-open residual, and e07s04
  is the detector.
- **`leave` can lose the reason line.** It swallows a `writeSync` error (such
  as EAGAIN on a full non-blocking pipe), so the exit code stays 2 but the text
  can be lost. The messages are under 1 KB against a 64 KB pipe buffer.
  (A thrown value that cannot be printed, such as an object with no prototype,
  used to throw out of `messageOf` and end in exit 1 or Node's exit 7; found by
  reviewer A in round 3 and fixed, with a test.)
- **SIGHUP and SIGQUIT are not handled** and take Node's default action. The
  host's timeout kill is not one of them. Named in the CLI header.
- **Signal-killed runs and the failure ceiling.** Reviewer B says repeated
  signal kills count toward the ceiling. Not verified; it changes engine
  semantics, so it is an e06 decision (recorded in BUG-007).

### Checked and clean

- **Signal ordering.** After `runEngine`, the CLI checks the controller before
  it trusts the answer, so an aborted run, including one that returns
  `overridden`, becomes exit 2. A signal during the stdin wait ends the wait at
  once (a mutant without `stdin.destroy()` fails its test).
- **Process kill.** The abort path reaches `killGroup`, the SIGKILL-to-group
  used on timeout (`src/process.ts`). Tests check that a running command is gone
  after the deadline, after a signal, and after an uncaught error (a mutant that
  drops `abort()` from the fault handler fails).
- **BUG-007 holes tried by reviewers.** A symlink from the ledger to a FIFO or
  to `/dev/zero` or `/dev/null`, a FIFO as the ledger's directory, a directory
  or a missing path, a FIFO as `override.json` (already guarded), a FIFO in the
  working tree (`tree.ts` never opens it) and a hostile `core.fsmonitor` (the
  engine passes `-c core.fsmonitor=false`) all give exit 2 or no hang. `fstat` is
  on the open handle, so there is no open-then-stat race. The ledger change
  keeps mode 0600 on create, append semantics and the empty-ledger read of a
  missing file, and does not add `O_NOFOLLOW` there.
- **Late stream errors.** My first version added a no-op `error` listener on
  the stream. It was dead code: Node's async iterator already leaves a
  listener, so a late `error` does not throw. Checked on a `PassThrough` in three
  paths and by a reviewer on the real stdin, with data and with a hung stdin.
  The line is removed and a test pins the behaviour.
- **Output.** Stdout holds nothing on a block, and no weftwork line says "done"
  without "not" (a test covers every failed reason).
- **T1.** The command comes only from the owner's hook entry; no Stop input
  field is read; the stdin reader never feeds the command. No new `exec`,
  `spawn`, `shell:` or `eval` in the source files.

### Result for verify-work

Four findings at confidence 8 or above (F1 high; F2, F3 and F4 medium), all
fixed and covered by tests that I broke on purpose to check they fail (the
mutation checks also found two weak tests and one dead line, which were fixed).
No finding is open at that level, so the security gate does not block. The
residuals above stay, with the stuck-git orphan the one worth an e06 story. The
fail-open residual that remains is a crash or a signal before the handlers are
installed and SIGKILL, and e07s04 owns the check for those.
