# e06s02 — Fail closed, and name the tree each verdict ran on

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 3
**epic:** e06 (Engine core and done gate, B1)
**research story:** none (B1 rests on R13, R14 and R15 through
docs/research/SYNTHESIS.md)
**branch:** e06s02-fail-closed-tree

## 1. Purpose

e06s01 made done mean "the declared command exited 0". That is not
enough. A command can exit 0 after it edited the files it was meant to
check, and a command that hangs, is killed or cannot start must never
read as done. This story makes the gate fail closed and makes each
verdict say which tree it ran on and why it came out as it did.

- A fingerprint of the working tree is taken before the run and again
  after it. A tree that changed under the command is not done
  (SYNTHESIS.md, evidence gate; R15).
- Every verdict carries a named reason, the declared command and the
  fingerprint taken before the run.
- A timeout, with a default and an input key, ends a hanging command
  and the whole process group it started.
- Held-out failing fixtures show the gate can fail. A gate that cannot
  fail is vacuous (R13, R15).

Owner decisions (2026-11-11, plan-work, "approve" to the six
recommendations): a `cwd` outside a git repository is fail closed
(`no-tree`) and the command is not run; the fingerprint covers the whole
working tree; git lists the files and the engine hashes them; the
timeout is an input key `timeoutMs` with a 10 minute default and kills
the process group; the verdict carries `reason`, `command` and
`fingerprint`; e06s01 tests move from the real repository to temporary
git repositories.

Reason for Depth: one new module, `src/tree.ts`, which has one job,
returning a fingerprint of a working tree. `gate.ts` calls it twice per
run. A second new file, `src/test-helpers.ts`, builds temporary git
repositories and is shared by four test files; without it each file would
repeat the same `git init` code.

## 2. Zoom-out

The story changes one existing module and adds one.

- **Purpose of `src/gate.ts`:** run a declared command and say whether it
  is done (e06s01). `src/cli.ts` is the thin shell around it.
- **Callers:** `src/cli.ts` calls `parseRequest` and `runGate`.
  `src/gate.test.ts` and `src/cli.test.ts` call them. Nothing else
  imports `gate.ts`.
- **Contracts that must hold:** `runGate` resolves and never rejects.
  `done` is true only for a command that exited 0 and left the tree
  unchanged. The CLI writes exactly one JSON line to stdout, exits 0 for
  done, 1 for not done and 2 for input it cannot read, and the stdin cap
  is 1 MiB. The command's output goes to stderr.
- **What breaks on purpose:** the `Verdict` type gains fields, so the
  e06s01 tests that compare a whole verdict must compare fields. A
  `cwd` that is not a git working tree no longer runs the command.

Blast radius (inline, in place of a separate `assess-impact` run): new
files `src/tree.ts`, `src/tree.test.ts`, `src/test-helpers.ts`,
`src/gate.vacuity.test.ts` and four scripts in `src/fixtures/`; changed
files `src/gate.ts`, `src/gate.test.ts`, `src/cli.ts`
(comments and one doc line only) and `src/cli.test.ts`. No change to
`package.json`, `tsconfig.json`, CI or AGENTS.md. CI already runs
`npm test`, and the runner has git.

## 3. Requirements

#### ADDED: `fingerprintTree(cwd)` in `src/tree.ts`
- Takes a directory and returns `Promise<FingerprintResult>`, where
  `FingerprintResult` is `{ ok: true; fingerprint: string }` or
  `{ ok: false; error: string }`. It never throws for an expected
  failure (CONVENTIONS.md, Errors).
- Finds the repository root with
  `git -c core.fsmonitor=false rev-parse --show-toplevel`, then lists the
  files with
  `git -c core.fsmonitor=false ls-files -z --cached --others --exclude-standard`
  run in that root. Both calls use `execFile` with an argument array and
  no shell (threat model C5). Node 26 docs: the `shell` option of
  `child_process` has the default `false` (no shell). git 2.56.1 docs: `core.fsmonitor` can name
  a hook command that git runs for commands such as `git status`, and with
  `-z` "the filename is output verbatim and the line is terminated by a
  NUL byte" (ctx7 `/git/git/v2.56.1`, config/core.adoc and
  git-ls-files.adoc, and `/nodejs/node/v26.0.0`, child_process.md,
  accessed 2026-11-11). Setting `core.fsmonitor=false`
  for the engine's own calls keeps a repository's own config from running
  a program.
- The listing holds tracked files and untracked files that are not
  ignored. An ignored file is not listed, so it does not change the
  fingerprint.
- Paths stay as bytes (`Buffer`), so a name that is not valid UTF-8 still
  resolves. Each entry is read with `lstat` and never followed:
  - a regular file: SHA-256 of its content, read as a stream, plus its
    executable bit. Kind `file` or `file-x`;
  - a symbolic link: SHA-256 of the link target string, never the file it
    points to (threat model C6). Kind `link`;
  - a listed path that no longer exists (tracked, then deleted): kind
    `missing`;
  - anything else, such as a FIFO, a socket or a nested repository
    directory: kind `other`, never opened, so a FIFO cannot hang the
    gate.
- The fingerprint is the SHA-256, in hex, of the entries sorted by path
  bytes, each written as `path NUL kind NUL digest NUL`. File times are
  not part of it, so `touch` does not change it.
- Returns `{ ok: false }` when the directory is not inside a git working
  tree, does not exist, holds a NUL byte, git is missing, or a listed
  file cannot be read.
- Known limit: the contents of a nested repository or submodule are not
  hashed. A change inside one does not change the fingerprint. Recorded
  in the threat model as residual (T5).

#### MODIFIED: `Verdict` in `src/gate.ts`
**Before:** `{ done: boolean; exitCode: number | null }`.
**After:** `{ done: boolean; exitCode: number | null; reason: Reason;
command: string; fingerprint: string | null }`, where `Reason` is one of
`passed`, `exit-nonzero`, `not-started`, `signal`, `timeout`, `no-tree`,
`tree-changed`. `fingerprint` is the one taken before the run, or `null`
for `no-tree`. `done` is true only with reason `passed`.

#### MODIFIED: `runGate(request)` in `src/gate.ts`
**Before:** runs the command in `cwd` and resolves with `done` true only
for exit code 0.
**After:**
- `GateRequest` gains an optional `timeoutMs`. `defaultTimeoutMs` is
  600000 (10 minutes).
- Order of events: take the fingerprint of `cwd`; if that fails, resolve
  `no-tree` and do not run the command. Run the command. On exit code 0,
  take the fingerprint again; if that fails, resolve `no-tree`; if it
  differs from the first, resolve `tree-changed`; else resolve `passed`.
- A run failure keeps its own reason and the second fingerprint is not
  taken: a command that cannot start (a NUL byte in the command) is
  `not-started` with exit code null; killed by a signal that is not the
  timeout is `signal` with exit code null; a non-zero exit code is
  `exit-nonzero` with that code; running past `timeoutMs` is `timeout`
  with exit code null.
- Process group (threat model C7). Spawn with `detached: true`. Node
  docs: on non-Windows platforms, "if `options.detached` is set to
  `true`, the child process will be made the leader of a new process
  group and session" (ctx7 `/nodejs/node/v26.0.0`, child_process.md,
  accessed 2026-11-11). On timeout, send `SIGKILL` to the group with
  `process.kill(-pid, 'SIGKILL')`. Node's own `timeout` option is not
  used: it signals only the shell, and a grandchild would survive. After
  the shell exits, send `SIGKILL` to the group once more, so a background
  process still in the group cannot keep writing after the second
  fingerprint. A process that leaves the group (for example with `setsid`)
  is out of reach; see Risks. A group that
  is already gone is not an error.
- Never throws or rejects for an expected failure.

#### MODIFIED: `parseRequest(text, defaultCwd)` in `src/gate.ts`
**Before:** accepts `command` and an optional `cwd`; other keys are
ignored.
**After:** also accepts an optional `timeoutMs`. It must be an integer
from 1 to 2147483647. Node's timer limit is 2147483647 ms; a larger
value would fire at once. A value that is missing from the input stays
missing in the result, and `runGate` applies the default. Any other value
is an error.

#### MODIFIED: the CLI JSON line in `src/cli.ts`
**Before:** `{"done":…,"exitCode":…}`.
**After:** the verdict as it is, with `reason`, `command` and
`fingerprint`. Exit codes stay 0, 1 and 2, and stdout still holds exactly
one JSON line. e06s04 replaces the exit codes.

#### MODIFIED: e06s01 tests
**Before:** `gate.test.ts` and `cli.test.ts` run commands in the real
repository root and compare whole verdicts.
**After:** they run in a temporary git repository from
`src/test-helpers.ts` and compare the fields they care about. The
"cwd does not exist" and "NUL byte in the cwd" cases now give `no-tree`
(the command does not run); the "NUL byte in the command" case gives
`not-started`.
The e06s01 test AC-07 ("command output never reaches stdout") now runs
`echo no''ise`: the verdict carries the command text, so a command that
spelled its own output would put it on stdout through the `command` field.

#### ADDED: held-out fixtures (anti-vacuity)
Four plain scripts in `src/fixtures/`: `pass.sh` (exits 0), `exit1.sh`
(exits 1), `lies.sh` (prints "all tests passed", exits 1) and
`edits.sh` (edits a tracked file, exits 0). Their names do not end in
`.test.ts`. `src/gate.vacuity.test.ts` runs each through `runGate` in a
temporary git repository.

## 17. Acceptance criteria (Gherkin)

These IDs are local to this story. Fingerprint scenarios run in
`src/tree.test.ts`, gate scenarios in `src/gate.test.ts`, process
scenarios in `src/cli.test.ts` and fixture scenarios in
`src/gate.vacuity.test.ts`. Every scenario runs in a temporary git
repository, never in the real one.

```gherkin
Scenario: AC-e06s02-01 the same tree gives the same fingerprint
  Given a temporary git repository with one tracked file
  When fingerprintTree reads it twice
  Then both results are ok with the same 64 character hex fingerprint

Scenario Outline: AC-e06s02-02 a change to the tree changes the fingerprint
  Given a temporary git repository with a tracked file and a symlink
  When <change>
  Then the fingerprint differs from the one taken before

  Examples:
    | change                                          |
    | the tracked file gets one more byte             |
    | a new untracked file is added                   |
    | the tracked file is deleted                     |
    | the tracked file gets the executable bit        |
    | the symlink is re-pointed at another path       |

Scenario Outline: AC-e06s02-03 these do not change the fingerprint
  Given a temporary git repository with a tracked file, a symlink to a
    file outside the repository, and a .gitignore that lists "out/"
  When <change>
  Then the fingerprint equals the one taken before

  Examples:
    | change                                          |
    | a file is added under the ignored directory out/|
    | the file the symlink points to gets new content |
    | the tracked file is touched, content unchanged  |

Scenario Outline: AC-e06s02-04 odd names and kinds do not break it
  Given a temporary git repository
  When it holds <entry>
  Then fingerprintTree resolves ok within 5 seconds

  Examples:
    | entry                                            |
    | an untracked file whose name holds a newline     |
    | an untracked file named "-x"                     |
    | an untracked file whose name is not valid UTF-8  |
    | an untracked FIFO                                |
    | a nested git repository directory                |

Scenario Outline: AC-e06s02-05 where the fingerprint can be taken
  When fingerprintTree reads <place>
  Then the result is <result>

  Examples:
    | place                                  | result            |
    | a subdirectory of a repository         | ok, equal to root |
    | a directory that is not in a git repo  | not ok, no throw  |
    | a directory that does not exist        | not ok, no throw  |
    | a path with a NUL byte                 | not ok, no throw  |

Scenario Outline: AC-e06s02-06 the verdict names the reason
  Given a temporary git repository
  When runGate runs <case>
  Then the verdict has <done>, exit code <code> and reason "<reason>"
  And the verdict holds the declared command
  And its fingerprint is <fingerprint>

  Examples:
    | case                                       | done  | code | reason        | fingerprint |
    | "true"                                     | true  | 0    | passed        | 64 hex      |
    | "false"                                    | false | 1    | exit-nonzero  | 64 hex      |
    | "exit 3"                                   | false | 3    | exit-nonzero  | 64 hex      |
    | "kill -TERM $$"                            | false | null | signal        | 64 hex      |
    | "true" with a NUL byte in the command      | false | null | not-started   | 64 hex      |
    | "sleep 30" with timeoutMs 300              | false | null | timeout       | 64 hex      |
    | a command that edits the tracked file      | false | 0    | tree-changed  | 64 hex      |
    | a command that writes an ignored file      | true  | 0    | passed        | 64 hex      |

Scenario Outline: AC-e06s02-07 no tree means the command does not run
  Given a directory <place> with a file "ran" that the command would
    create
  When runGate runs "touch ran" there
  Then the verdict is not done with exit code null, reason "no-tree"
    and fingerprint null
  And the file "ran" does not exist

  Examples:
    | place                                 |
    | that is not in a git repository       |
    | that does not exist                   |
    | whose path holds a NUL byte           |

Scenario: AC-e06s02-08 a timeout ends the whole process group
  Given a temporary git repository and a temporary directory outside it
  When runGate runs a shell command that starts a background "sleep 30",
    writes its pid to a file in the outside directory, and waits,
    with timeoutMs 300
  Then the verdict has reason "timeout"
  And the background process is gone within 2 seconds

Scenario: AC-e06s02-09 a leftover background process is ended after exit
  Given a temporary git repository and a temporary directory outside it
  When runGate runs "sleep 30 & echo $! > <outside>/pid" and it exits 0
  Then the verdict is done with reason "passed"
  And the background process is gone within 2 seconds

Scenario Outline: AC-e06s02-10 timeoutMs is checked
  When parseRequest reads {"command":"true","timeoutMs":<value>}
  Then the result is <result>

  Examples:
    | value        | result                            |
    | 1            | ok, timeoutMs 1                   |
    | 2147483647   | ok, timeoutMs 2147483647          |
    | 0            | error                             |
    | -1           | error                             |
    | 1.5          | error                             |
    | "5"          | error                             |
    | 2147483648   | error                             |

Scenario: AC-e06s02-11 the default timeout is used when none is given
  Then defaultTimeoutMs is 600000
  And parseRequest of {"command":"true"} holds no timeoutMs

Scenario Outline: AC-e06s02-12 the CLI carries the new fields
  Given a temporary git repository as the cwd
  When the real CLI reads <stdin>
  Then it exits <exit>
  And stdout is exactly one JSON line with reason "<reason>"
  And that line holds "command" and "fingerprint"

  Examples:
    | stdin                                             | exit | reason       |
    | {"command":"true"}                                | 0    | passed       |
    | {"command":"exit 7"}                              | 1    | exit-nonzero |
    | {"command":"sleep 30","timeoutMs":300}            | 1    | timeout      |
    | {"command":"true","cwd":"<a dir with no repo>"}   | 1    | no-tree      |

Scenario Outline: AC-e06s02-13 held-out fixtures are rejected
  Given a temporary git repository with the tracked file "tracked.txt"
  When runGate runs "sh <fixture>" in it
  Then the verdict is <done> with reason "<reason>"

  Examples:
    | fixture    | done  | reason        |
    | pass.sh    | done  | passed        |
    | exit1.sh   | not done | exit-nonzero |
    | lies.sh    | not done | exit-nonzero |
    | edits.sh   | not done | tree-changed |

Scenario: AC-e06s02-14 the e06s01 scenarios still hold
  Then the e06s01 tests, moved to temporary git repositories, pass
  And Preflight passes
```

## Steps

1. RED: write `src/test-helpers.ts` (a function that makes a temporary git
   repository and cleans up) and `src/tree.test.ts` for AC-01 to AC-05;
   run it and record the failure, since `src/tree.ts` does not exist.
   GREEN: write `fingerprintTree`
   → verify: `node --test src/tree.test.ts && npm run typecheck && ! grep -nE 'shell:|execSync|[^a-zA-Z]exec\(' src/tree.ts`
2. RED: move the e06s01 tests to temporary git repositories, add AC-06 to
   AC-12, run them and record the failures. GREEN: change `gate.ts` and
   `parseRequest`, update the `cli.ts` comment
   → verify: `node --test src/gate.test.ts src/cli.test.ts && npm run typecheck && (echo '{"command":"no-such-command-xyz"}' | node src/cli.ts | grep -q '"reason":"exit-nonzero"') && grep -q 'detached: true' src/gate.ts`
3. Add `src/fixtures/` and `src/gate.vacuity.test.ts` for AC-13, then
   run the mutation check by hand (see the Verification Script)
   → verify: `node --test src/gate.vacuity.test.ts && ls src/fixtures | grep -q .`
4. Run the Preflight line from AGENTS.md (AC-14)
   → verify: `yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test`

## 4. Dependencies (slopcheck)

- `node:child_process` (`execFile`, `spawn` with `detached`), `node:crypto`
  (`createHash`), `node:fs` (`lstat`, `readlink`, `createReadStream`),
  `node:stream/promises`, `node:os`, `node:path`: built into Node 26.
  `[OK]`.
- The `git` program on the PATH. Not a package. The gate needs it: with
  no git, `fingerprintTree` fails and every verdict is `no-tree`, which
  fails closed. The CI runner has git.
- No new npm package.

## 5. Out of scope

- The ledger (e06s03), the terminal states with their own exit codes,
  signal forwarding and the no-progress breaker (e06s04), and the escape
  hatch (e06s05).
- Capturing the command's output. It goes to stderr only. The breaker
  needs it in e06s04.
- Budget ceilings over the whole loop, and a time limit on hashing a very
  large tree (e09). The timeout covers the command, not the hashing.
- Hashing the contents of nested repositories and submodules.
- Windows. `detached` and process groups behave differently there.
- A `reason` detail string. `no-tree` covers "git is missing" and "a file
  could not be read" alike; e06s03 may log the cause.

## 6. Risks

- **The command writes outside ignored paths.** A command that writes a
  file the repository does not ignore, for example a build output that is
  not in `.gitignore`, is `tree-changed` and never done. That is the
  design, since such a write is a change to the tree. Detect: a gate
  that always says `tree-changed` for a clean command. The fix is a
  `.gitignore` line, not a gate change.
- **A group kill reaches the wrong process.** `SIGKILL` goes to `-pid`
  after the leader has exited. A process group id can in theory be reused
  once the group is empty. The window is tiny, and a group that is gone
  gives `ESRCH`, which is ignored. Detect: AC-08 and AC-09 stay green and
  the test run never kills the test runner.
- **A command can leave the process group.** A process that starts its own
  session, for example `setsid sleep 20 &`, is not in the group, so neither
  kill reaches it and it can edit the tree after the second fingerprint.
  Probed by hand during verify-work: the child outlived the gate. Closing
  it needs a PID namespace or a cgroup, which belongs to e09 and e10. The
  gate is evidence against an honest command, not a sandbox.
- **Ctrl-C no longer reaches the command.** A detached child is in its own
  session. e06s04 adds signal forwarding. Until then a user who hits
  Ctrl-C on the CLI leaves the command running until its own timeout.
- **Process tests are slower.** Each case starts `sh` and, for four of
  them, `git`. The two timeout cases use `sleep 30` and are ended by
  `timeoutMs 300`. Detect: `npm test` takes more than about ten seconds.
- **Fingerprint cost grows with the tree.** The hash reads every tracked
  and untracked file twice per run. Acceptable for this repository. e09
  owns a cap.
- **git config that runs a program.** `core.fsmonitor=false` is set for
  the engine's own git calls only. Other config keys that name programs
  are not set. Re-run `security-review` on this diff (threat model T5 re-review trigger).
- **Fail-closed means a missing git blocks all work.** A machine with no
  git gets `no-tree` for every run. That is the intended direction of the
  failure.

## Verification Script (human)

1. In a scratch git repository:
   `R=$(pwd); cd $(mktemp -d) && git init -q && echo a > f && echo '{"command":"true"}' | node $R/src/cli.ts; echo "exit=$?"`
   prints `"done":true`, `"reason":"passed"` and a 64 character
   `"fingerprint"`, then `exit=0`.
2. In the same repository:
   `echo '{"command":"echo b >> f"}' | node $R/src/cli.ts; echo "exit=$?"`
   prints `"done":false` and `"reason":"tree-changed"`, then `exit=1`.
3. `echo '{"command":"sleep 30","timeoutMs":300}' | node $R/src/cli.ts`
   returns in under 2 seconds with `"reason":"timeout"`.
4. In a directory that is not a repository (`cd $(mktemp -d)`):
   `echo '{"command":"touch ran"}' | node $R/src/cli.ts; ls ran`
   prints `"reason":"no-tree"` and `ls` finds no file `ran`.
5. Mutation check (anti-vacuity): copy `src` to a scratch directory,
   change the exit-code rule in the copy so that a non-zero exit counts
   as passed, and run `node --test src/gate.vacuity.test.ts` there. It
   must fail. Delete the copy.
6. `ls src/fixtures` shows the four scripts, and `npm test` passes.
