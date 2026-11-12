# Threat model for epic e06 (Engine core and done gate, B1)

type: threat-model
context: engine
date: 2026-11-11
step: build-epic step 0 (security-review, threat-model mode)
scope: specs/epics/e06-engine-core-done-gate/ (e06s01 to e06s05)
basis: story spec e06s01 and tasks files e06s02 to e06s05. No product
code exists yet, so this is a design-time model. There are no code
findings. Re-run the scan on the diff of each story at verify-work
(phase 5).
waiver: none. e06 is the first epic with product code, and the owner
chose not to waive this step (state.yaml handoff note).
overall risk: P1, medium. The engine reads no network input and holds
no secrets. The risk that matters is integrity: a false "done".

## What the engine is, in security terms

A local CLI. JSON on stdin names one shell command. The engine runs
the command and answers with an exit code, so a caller can trust
"done" only when the command exited 0. The asset is the truth of that
verdict. Confidentiality and availability are secondary.

Who writes the stdin JSON is set by later epics (hosts in e07, skills
in e11). Who can edit files in the working tree is the agent. The
agent is the party whose claim of "done" the gate exists to doubt.

## Trust boundaries

| Boundary | Trusted side | Untrusted side |
|----------|--------------|----------------|
| stdin JSON | the owner's plan or a host hook | anything a host forwards from the agent |
| the declared command | the owner or the plan that declared it | the agent, if it can choose it |
| the working tree and `.git` | none (the agent edits it) | the agent and any repository content |
| the ledger file (e06s03) | none (a plain file in the tree) | the agent |
| the override file (e06s05) | the owner, by hand | the agent, which can write files too |

## Surface area and threats

Severity is the risk to the verdict's integrity. CWE ids follow
skills/security-review/REFERENCE-vuln-categories.md style.

### T1. The agent picks a command that always passes (e06s01) — High

CWE-345 (insufficient verification of data authenticity). If the
caller lets the agent choose `command`, the agent writes `true` and
the gate answers done. The engine cannot tell a real check from a
vacuous one.

- Mitigation in e06: the anti-vacuity fixtures in e06s02 task 3 show
  the gate rejects exit 1, "all tests passed" with exit 1, and exit 0
  after the run edited a file. They prove the gate itself is not
  vacuous. They do not prove the declared command is a good check.
- Residual, owned elsewhere: the command must come from the owner's
  plan, not the agent. That rule belongs to the host adapters (e07)
  and the untrusted-content baseline (e10). Record it as an input
  assumption in e06s01, do not claim it as solved.

### T2. Command execution through a shell string (e06s01) — Low, by design

CWE-78. `spawn` with `shell: true` runs `/bin/sh -c <command>`. The
Node docs warn not to pass unsanitised input to it. The engine is not
a boundary against the declared command: whoever sets `command` can
already run any code as the same user. No privilege is gained.

- Mitigation: no extra quoting or filtering (it would give false
  comfort). Say plainly in the CLI help and docs that `command` is
  code. Do not add a second code path that builds a command from other
  input (for example a file name) with string concatenation.
- Detect: audit-code flags any new `spawn`/`exec` call whose string
  holds input other than `command`.

### T3. Forged or edited ledger (e06s03) — Medium

CWE-345, CWE-73. The ledger is a plain file in the tree. The agent can
append a fake `done` line or delete failures, which would hide a stuck
run from the breaker (e06s04) and fake the counts.

- Mitigation: the gate never takes `done` from the ledger. Every
  verdict comes from running the command now. The ledger is a log for
  counts and the breaker, and a recorded done whose fingerprint differs
  from the current tree is stale (e06s03 task 2).
- Residual: an agent can still erase failures to defeat the breaker or
  the failure ceiling. State this limit in e06s03. Ledger location and
  git-ignore choice are open for e06s03 plan-work. An ignored file the
  agent can still write is no stronger. Do not describe it as tamper
  proof.
- Log injection (CWE-117): write each entry as one JSON object per
  line with `JSON.stringify`, so a command with a newline cannot start
  a second fake entry. The reader skips a torn or bad line, reports
  it, and never throws.

### T4. Agent-forged escape hatch (e06s05) — Medium

CWE-290, CWE-862. The hatch turns a failing gate into "overridden".
If the agent can create the override file, it can open the hatch for
itself. The engine cannot tell who wrote a file.

- Mitigation in the design: one exact command, one exact tree
  fingerprint, never a pattern; one shot; a reason and an author are
  required; every use is logged with a distinct exit code and an
  "overridden" mark; overrides and false alarms are counted. This
  limits the damage of a forged hatch to one run on one tree, and
  leaves a trace.
- Residual: authorship is not proof (the e06s05 tasks file already
  says so). Do not market the hatch as owner-authenticated. Real
  separation needs a host-level control or a path the agent cannot
  write, which is for e07 and e10.
- Test: the reader must reject wildcards, empty fields and a missing
  reason, and a record for another command or tree must do nothing.

### T5. Tree fingerprint and the git calls under it (e06s02) — Medium

- Running git in an untrusted tree (CWE-78): git reads repository
  config. Settings such as `core.fsmonitor` can name a program that git
  runs during `git status`. Call git with `execFile`/`spawn` and an
  argument array, never a shell string, and neutralise such settings
  for the engine's own git calls. Confirm the exact option names
  against the git docs when e06s02 is planned (ctx7), not from memory.
- Symlinks (CWE-59): hashing "contents of untracked files" must not
  follow a symlink out of the tree. Hash the link target string, or
  skip, and test it.
- Time of check to time of use (CWE-367): the fingerprint is taken
  before the run and again after. A tree that changed while the command
  ran gives a verdict that is not done, with its own reason (e06s02
  task 2). This is the control, not a bug.
- Large trees and files (CWE-400): hashing has no cap. Hash by stream,
  and let the timeout cover the whole gate run, not only the command.
- Path arguments: pass paths after `--` so a file named `-x` is not a
  flag.

### T6. Hang, flood and orphan processes (e06s01, e06s02, e06s04) — Low to Medium

CWE-400.

- e06s01 has no timeout. A hanging command hangs the gate until e06s02
  adds one. Accept for the tracer, and say so in the story.
- `kill` on the shell does not stop grandchildren. When the timeout and
  signal forwarding arrive (e06s02, e06s04), start the command in its
  own process group and signal the group. Test that no child outlives
  the gate.
- stdin is read to the end with no size limit. Cap it (for example
  1 MiB) when the CLI is written. A larger input is an error, exit 2.
- The child's output goes to the engine's stderr, so it cannot flood
  the verdict line. When e06s04 captures output for the breaker, cap
  the captured size.

- Residual (probed in e06s02 verify-work, 2026-11-12): a command that starts
  its own session (for example `setsid`) leaves the process group, so the
  group kill does not reach it, and it can edit the tree after the second
  fingerprint. The gate is evidence against an honest command, not a
  sandbox. Closing it needs a PID namespace or a cgroup, owned by e09 and
  e10.

### T7. Fail-open on error (all stories) — High if wrong

CWE-754. The worst bug is a path where an error reads as success. Every
unexpected state must give `done: false`.

- Mitigation: `done` is true only for exit code 0 and nothing else.
  `null` (no start, or a signal) is not done. Bad input is exit 2 and
  not done. Exhausted and stalled never give done (e06s04). Each case
  has a named test in the stories.
- The `fail-open verify directive` fixtures in skills/security-review
  (CWE-754) apply to every verify string in the tasks files. Check them
  at each story's audit.
- Caller risk for e07: some hosts treat only certain exit codes as
  blocking, and treat the rest as a soft error. Exit 1 and exit 2 must
  not be read as "pass" by a host. Check each host's rule when e07 is
  planned. Do not assume.

### T8. Information exposure (e06s01) — Low

CWE-200.

- The child inherits the engine's environment, including any tokens in
  it. That is the same as the agent's own shell. Do not pass extra
  secrets in, and do not print the environment.
- The command's output goes to stderr and is seen by the host. A
  command that prints a secret leaks it to host logs. The engine does
  not filter output. Note it as a limit, e10 owns redaction.
- The ledger stores the command string. A command with a token in it
  stores the token on disk. Say so in the e06s03 docs, and do not put
  secrets in declared commands.

### T9. Supply chain (all stories) — Low

No new package is planned for e06 (e06s01 section 4). Node built-ins
only, plus the existing dev tooling. Any later `npm install` in e06
needs slopcheck and a fresh review of `package.json`.

## Controls to carry into the stories

| # | Control | Story |
|---|---------|-------|
| C1 | State the input assumption: `command` comes from the owner's plan, not the agent | e06s01 |
| C2 | No string-built shell commands other than the declared `command` | all |
| C3 | One JSON object per ledger line, `JSON.stringify` only | e06s03 |
| C4 | Gate never reads `done` from the ledger or a file | e06s03 |
| C5 | git by argument array, repo-config hooks neutralised, `--` before paths | e06s02 |
| C6 | Symlinks are not followed when hashing | e06s02 |
| C7 | Process group kill on timeout, test for orphans | e06s02, e06s04 |
| C8 | stdin size cap, captured output cap | e06s01, e06s04 |
| C9 | Override: exact match only, one shot, logged, counted, not marketed as proof | e06s05 |
| C10 | Every error path is tested as not done | all |

## Accepted residual risks

1. The gate cannot judge whether the declared command is a good check
   (T1). Owned by e07, e10 and the plan author.
2. An agent that can write files can forge the ledger and the override
   record (T3, T4). The design limits the harm to one run and a trace.
   It does not prevent it.
3. Output and environment pass through unfiltered (T8). Owned by e10.

## Re-review triggers

- e06s02: the git and hashing code (T5). Run security-review on the
  diff.
- e06s03: the ledger writer and reader (T3).
- e06s05: the override reader (T4). The owner decision on how the engine
  tells a hatch is open and changes this section.
