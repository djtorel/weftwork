# e06s01 — Run a declared command and answer with its verdict

**type:** feat
**risk:** P1
**context:** engine
**bcps:** 3
**epic:** e06 (Engine core and done gate, B1)
**research story:** none (B1 rests on R13, R14 and R15 through
docs/research/SYNTHESIS.md)
**branch:** e06-engine-core-done-gate

## 1. Purpose

This is the tracer bullet for B1. The evidence gate is the one gate
with a live catch in the legacy ledger: done means a declared command
that the engine ran itself exited 0, not that the agent said so
(SYNTHESIS.md, "Earns its place"). This story builds the thinnest
path through it. JSON goes in on stdin, the engine runs the declared
command, and the exit code carries the verdict. Later stories add
fail-closed reasons and the tree fingerprint (e06s02), the ledger
(e06s03), the terminal states (e06s04) and the escape hatch (e06s05).

Reason for Depth: two modules, `src/gate.ts` (library) and
`src/cli.ts` (thin shell). CONVENTIONS.md requires the split: logic
lives in the library so tests call it without a process, and the CLI
only reads, calls and prints. No other abstraction is added.

## 2. Zoom-out

The story replaces one existing module and one line of AGENTS.md.

- **Purpose:** `src/smoke.ts` and `src/smoke.test.ts` prove that the
  compiler and the test runner run (e05s02). The Run row of the
  AGENTS.md command table says how to run the program.
- **Callers:** `npm test` finds `smoke.test.ts`; nothing imports
  `smoke.ts` except its test. No script parses the Run row:
  `scripts/bp-read-agents.sh` reads the code blocks under headings,
  not the table.
- **Contracts:** `npm test` must still find and pass at least one
  test, and `npm run typecheck` must pass. CI and Preflight run both
  and do not change. Every command in AGENTS.md must resolve in this
  repository (CONVENTIONS.md).

Blast radius (inline, in place of a separate `assess-impact` run):
new files `src/gate.ts`, `src/gate.test.ts`, `src/cli.ts`,
`src/cli.test.ts`; two deleted files; two lines of AGENTS.md. No
tool script, CI step, `package.json` or `tsconfig.json` changes.

## 3. Requirements

#### MODIFIED: what `src/` holds
**Before:** `src/` holds only the e05s02 smoke files, which check
that exit code 0 means passed.
**After:** `src/` holds the gate library and the CLI. The smoke check
becomes a real test of a real command.

#### REMOVED: `passed(exitCode)` in `src/smoke.ts`
**Before:** a pure function that returns true only for exit code 0,
with one test.
**After:** (removed). `runGate` makes the same rule on a real process
exit, so the placeholder has no job left. e05s02 said e06 replaces it.

#### MODIFIED: AGENTS.md Run row and Architecture section
**Before:** Run says `N/A until e06 ships the CLI`. Architecture says
`src/` holds only the e05s02 smoke files.
**After:** Run says `` echo '{"command":"npm test"}' | node src/cli.ts ``.
Architecture says `src/` holds the gate library (`gate.ts`) and the
thin CLI (`cli.ts`).

#### ADDED: `runGate(request)` in `src/gate.ts`
- Takes `{ command: string; cwd: string }` and returns
  `Promise<Verdict>`, where `Verdict` is
  `{ done: boolean; exitCode: number | null }`.
- Runs `command` as one shell string (`spawn` with `shell: true`, so
  `/bin/sh -c`) in `cwd`. A shell string is required because every
  declared verify command in this repository is one, for example
  `node --test src/gate.test.ts && npm run typecheck`.
- `done` is true only when the exit code is 0. Anything else is not
  done.
- Never throws for an expected failure (CONVENTIONS.md, Errors). A
  command that cannot start resolves to `done: false` with
  `exitCode: null`. Node 26 docs: when `cwd` does not exist, the
  child "emits an `ENOENT` error", and `'close'` "will always emit
  after `'exit'` ... or `'error'` if the child process failed to
  spawn". A command killed by a signal gives `'close'` a `code` of
  `null`, which is also not done (ctx7 `/nodejs/node/v26.0.0`,
  child_process.md, accessed 2026-11-11). e06s02 adds a named reason
  for each of these cases.
- The child's stdin is closed (`'ignore'`). Its stdout and stderr go
  to the engine's stderr (`stdio: ['ignore', 2, 2]`), so the engine's
  stdout carries only the verdict. e06s04 may capture the output for
  the no-progress breaker.

#### ADDED: `parseRequest(text, defaultCwd)` in `src/gate.ts`
- Returns `{ ok: true; request }` or `{ ok: false; error }`, never a
  throw.
- Accepts one JSON object with `command`, a string that is not empty
  or only spaces, and an optional `cwd` string. With no `cwd`, the
  request uses `defaultCwd`.
- Rejects text that is not JSON, JSON that is not an object (an
  array, a string, `null`), a missing or empty `command`, and a `cwd`
  that is not a string. Other keys are ignored, because later stories
  add keys such as the timeout.

#### ADDED: `src/cli.ts`
- Reads all of stdin, calls `parseRequest` with `process.cwd()`, then
  `runGate`, and prints one JSON line to stdout.
- Exit 0 and `{"done":true,"exitCode":0}` when done.
- Exit 1 and `{"done":false,"exitCode":<n or null>}` when not done.
- Exit 2 and `{"done":false,"error":"<why>"}` for input it cannot
  read. stdout always carries exactly one JSON line.
- e06s04 replaces the 0, 1, 2 codes with one code per terminal state.

## 17. Acceptance criteria (Gherkin)

These IDs are local to this story. Library scenarios run in
`src/gate.test.ts`. CLI scenarios start the real CLI with
`process.execPath` in `src/cli.test.ts`.

```gherkin
Scenario: AC-e06s01-01 exit code 0 is done
  When runGate runs "true"
  Then the verdict is done with exit code 0

Scenario Outline: AC-e06s01-02 any other exit code is not done
  When runGate runs "<command>"
  Then the verdict is not done with exit code <code>

  Examples:
    | command                 | code |
    | false                   | 1    |
    | exit 3                  | 3    |
    | no-such-command-xyz     | 127  |
    | true && false           | 1    |

Scenario: AC-e06s01-03 the command runs in the given directory
  Given a temporary directory that holds the file marker
  When runGate runs "test -f marker" with that directory as cwd
  Then the verdict is done
  And the same command with the repository root as cwd is not done

Scenario Outline: AC-e06s01-04 an abnormal run is not done, no throw
  When runGate runs <case>
  Then the promise resolves, not rejects
  And the verdict is not done with exit code null

  Examples:
    | case                                       |
    | "true" with a cwd that does not exist      |
    | "kill -TERM $$" (the shell kills itself)   |

Scenario Outline: AC-e06s01-05 parseRequest accepts and rejects input
  When parseRequest reads <text> with default cwd "/d"
  Then the result is <result>

  Examples:
    | text                                | result                     |
    | {"command":"true"}                  | ok, cwd "/d"               |
    | {"command":"true","cwd":"/x"}       | ok, cwd "/x"               |
    | {"command":"true","extra":1}        | ok, extra key ignored      |
    | not json                            | error                      |
    | (empty)                             | error                      |
    | []                                  | error                      |
    | null                                | error                      |
    | {}                                  | error                      |
    | {"command":""}                      | error                      |
    | {"command":"   "}                   | error                      |
    | {"command":5}                       | error                      |
    | {"command":"true","cwd":5}          | error                      |

Scenario Outline: AC-e06s01-06 the CLI answers at the process boundary
  When the real CLI reads <stdin>
  Then it exits <exit>
  And stdout is exactly one JSON line with "done" set to <done>

  Examples:
    | stdin                     | exit | done  |
    | {"command":"true"}        | 0    | true  |
    | {"command":"false"}       | 1    | false |
    | {"command":"exit 7"}      | 1    | false |
    | not json                  | 2    | false |
    | {}                        | 2    | false |

Scenario: AC-e06s01-07 command output never reaches stdout
  When the real CLI reads {"command":"echo noise"}
  Then stdout is exactly one JSON line and does not hold "noise"
  And stderr holds "noise"

Scenario: AC-e06s01-08 the CLI honours cwd
  Given a temporary directory that holds the file marker
  When the real CLI reads {"command":"test -f marker","cwd":"<dir>"}
  Then it exits 0

Scenario: AC-e06s01-09 the smoke files are gone and AGENTS.md is true
  Then src/smoke.ts and src/smoke.test.ts do not exist
  And the AGENTS.md Run row names node src/cli.ts
  And Preflight passes
```

## Steps

1. RED: write `src/gate.test.ts` for AC-01 to AC-04 and run it; it
   fails because `src/gate.ts` does not exist. Record the failure.
   GREEN: write `runGate`. Delete the smoke files
   → verify: `node --test src/gate.test.ts && npm run typecheck && ! test -e src/smoke.ts && ! test -e src/smoke.test.ts`
2. RED: add AC-05 to `src/gate.test.ts` and write `src/cli.test.ts`
   for AC-06 to AC-08; both fail. GREEN: write `parseRequest` and
   `src/cli.ts`
   → verify: `node --test src/gate.test.ts src/cli.test.ts && (echo '{"command":"true"}' | node src/cli.ts >/dev/null) && (echo '{"command":"false"}' | node src/cli.ts >/dev/null; test $? -eq 1) && (echo 'not json' | node src/cli.ts >/dev/null 2>&1; test $? -eq 2)`
3. Update the AGENTS.md Run row and Architecture section, then run
   Preflight
   → verify: `grep -E '^\| Run ' AGENTS.md | grep -q 'src/cli.ts' && ! grep -q 'N/A until e06' AGENTS.md && ! grep -q 'only the e05s02 smoke' AGENTS.md && yamllint specs && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh && npm run typecheck && npm test`

## 4. Dependencies (slopcheck)

- `node:child_process` (`spawn`, `shell: true`, `stdio` with file
  descriptor numbers): built into Node 26. `[OK]`.
- `node:test`, `node:assert/strict`, `node:fs`, `node:os`: built in,
  already the project's test stack. `[OK]`.
- No new npm package.

## 5. Out of scope

- Named reasons for each failure, a timeout, and the tree fingerprint
  (e06s02).
- The ledger (e06s03), the terminal states with their own exit codes,
  signal forwarding and the breaker (e06s04), and the escape hatch
  (e06s05).
- Capturing the command's output. It goes to stderr only.
- Windows. `shell: true` uses `cmd.exe` there; the engine targets
  Linux and macOS for now.
- A `bin` entry in `package.json` or a published package (e11).

## 6. Risks

- **The engine runs a shell string by design.** The Node docs warn
  "do not pass unsanitized user input" to `shell: true`. The caller
  (the owner's plan or a host hook) declares the command; the engine
  is not a boundary against it. The untrusted-content rule is e10.
  e06 is the first epic with product code, so build-epic step 0 (the
  security-review threat model) is due and should not be waived as
  e01 to e05 were. Detect: the threat model names this surface.
- **Process tests can be slow or flaky.** Each case starts `/bin/sh`.
  Use only built-in commands (`true`, `false`, `exit`, `test`), no
  sleeps. Detect: `npm test` time grows past a few seconds.
- **Exit codes 0, 1 and 2 are temporary.** e06s04 changes them. Any
  caller written now must read the JSON `done` field, not only the
  code. Detect: e06s04's table test.
- **Child output on the engine's stderr.** A host hook that treats
  stderr as an error message will see the command's output there.
  e07 decides how each host reads it.

## Verification Script (human)

1. `echo '{"command":"true"}' | node src/cli.ts; echo "exit=$?"`
   prints `{"done":true,"exitCode":0}` and `exit=0`.
2. `echo '{"command":"exit 3"}' | node src/cli.ts; echo "exit=$?"`
   prints `{"done":false,"exitCode":3}` and `exit=1`.
3. `echo '{"command":"echo hi"}' | node src/cli.ts 2>/dev/null`
   prints only the JSON line, not `hi`.
4. `echo 'nope' | node src/cli.ts; echo "exit=$?"` prints a JSON line
   with `"error"` and `exit=2`.
5. `ls src` shows no smoke files, and `npm test` passes.
