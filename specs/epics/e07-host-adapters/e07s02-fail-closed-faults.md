# e07s02 — The adapter fails closed on every fault of its own

**type:** feat
**risk:** P1
**context:** adapter
**bcps:** 5 (slice said 3; resized at plan-work, owner decision 3)
**epic:** e07 (Host adapters, B3)
**research story:** none (R13 [S25] gives the hook contract)
**branch:** e07s02-fail-closed-faults

## 1. Purpose

Claude Code blocks a stop only on exit 2. Any other exit code, a crash,
a hook that outlives its timeout, or invalid output is a non-blocking
error and the stop goes ahead. So every fault of the adapter's own must
end in exit 2 with a reason, and the engine must always answer before the
host's timeout cuts the hook off. e07s01 did this for bad stdin, bad
arguments and a bad `CLAUDE_PROJECT_DIR`. This story closes the rest.

Host facts, read 2026-11-12 from the Claude Code hooks docs
(https://code.claude.com/docs/en/hooks, through Context7
`/websites/code_claude`):

- A hook with no `timeout` gets 600 seconds. `Stop` has no shorter
  default. The `timeout` field is in seconds.
- A hook that reaches its timeout is cancelled and its output is
  discarded, so the stop goes ahead.
- The engine's default command timeout is 600000 ms
  (`defaultTimeoutMs`, `src/gate.ts`). With both at 600 s, the host's
  silent cut-off and the engine's `timeout` answer arrive together.

Owner decisions (2026-11-12, plan-work; each took the recommended
option):

1. **The pair is 600 s for the engine and 660 s for the hook entry.** One
   exported constant holds each, so e07s03 writes 660 into
   `settings.json` from the constant. The 60 s margin covers the
   fingerprint, the ledger write and the kill.
2. **A fault Claude cannot fix still blocks, with an honest message.** The
   reasons `no-tree`, `no-ledger`, `not-started` and `timeout`, and a
   passing run that changed the tree (`tree-changed`), keep exit 2. Each
   says what weftwork could not do. Those Claude cannot fix say "tell the
   owner". The host's cap of eight consecutive blocks ends the loop. An
   allow with a warning would be fail-open.
3. **One story, resized to 5 BCPs.** `epic.yaml`, `release-plan.yaml` and
   `execution-status.yaml` go from 18 to 20 BCPs. WSJF is not rescored
   (4.2 was an estimate; a rescore is a `change-request`).

## 2. Zoom-out

Modules changed: `src/claude-hook.ts` and `src/claude-hook-cli.ts`, both
from e07s01. No module outside the adapter changes.

- **`claude-hook.ts`.** Purpose: map the host's input and the engine's
  answer to the host's terms. Callers: `claude-hook-cli.ts` and its tests.
  Contracts: every function is pure except the new stdin reader; exit 2
  is the only block; `hookAnswer` is an exhaustive `switch` over `State`.
- **`claude-hook-cli.ts`.** Purpose: thin shell. Caller: the host's hook
  entry (e07s03). Contract: no logic of its own.
- **`runEngine(request, signal?)`.** Resolves for every expected failure.
  An abort kills the command's process group with SIGKILL and answers
  `killed` (`src/process.ts`). Unchanged here.
- **`src/cli.ts`.** Its 1 MiB stdin cap (`maxInputBytes`) is the pattern
  the hook's cap copies.

`assess-impact` is not needed: nothing outside the two adapter files has
a caller that changes.

## 3. Requirements

#### ADDED: timeouts, in `src/claude-hook.ts`

- `engineTimeoutMs = 600000` and `hookTimeoutSeconds = 660`, exported.
  `hookRequest` sets `timeoutMs: engineTimeoutMs` on the request. A test
  asserts `hookTimeoutSeconds * 1000 - engineTimeoutMs >= 60000`.

#### MODIFIED: the `failed` answer wording

- **Before:** every `failed` reason ends "Make that command pass before
  you stop."
- **After:** the line depends on the reason. `exit-nonzero` and `signal`
  keep the old line. `timeout` says the command ran past the limit and to
  make it finish or tell the owner. `tree-changed` says the command passed
  but changed the working tree, so the result is not trusted. `no-tree`,
  `no-ledger`, `not-started` and any other reason say weftwork could not
  check, name what failed, and tell the owner. All stay exit 2. The reason
  `switch` is exhaustive over `Reason`.

#### ADDED: bounded stdin

- `readHookInput(stream, maxBytes, deadlineMs)` returns the text, or
  `{ ok: false, error }` for input over `maxHookInputBytes` (1 MiB), a
  stream error, or no end of input within `stdinDeadlineMs` (10 s). It
  never rejects. **Reason for Depth:** the cap and the deadline need a
  stream to test against, and the CLI may hold no logic.

#### ADDED: one place that fails closed

- `failClosed(work)` runs the async `work` and returns its `HookOutput`. A
  throw or rejection becomes `blockStop('adapter fault: <message>')`.
  **Reason for Depth:** one catch guarantees that no path ends in exit 1,
  and a function can be tested with a throwing `work`; inline in the CLI
  it could not.

#### ADDED: signals, in `src/claude-hook-cli.ts`

- SIGTERM and SIGINT abort a controller whose signal goes to `runEngine`,
  so the command's process group is killed. The CLI then exits 2 with
  `weftwork: terminated before it could check`. A hung command does not
  outlive the hook.

#### ADDED: the fail-open residual, written down and pinned

- The header of `claude-hook-cli.ts` says that exit 1, a crash before the
  code runs (a missing file, a Node that is too old) and a `SIGKILL` allow
  the stop, and that e07s04 is the check. A test runs the CLI under a
  broken entry path and asserts the exit code is not 2.

## 17. Acceptance criteria (Gherkin)

```gherkin
Feature: The adapter fails closed

  # AC-e07s02-01
  Scenario: The engine times out before the host does
    Then the hook's timeout exceeds the engine's by at least 60 seconds
    And hookRequest gives the engine the engine timeout

  # AC-e07s02-02
  Scenario Outline: A failed run says what is wrong
    Given a failed answer with reason "<reason>"
    When hookAnswer maps it
    Then the exit code is 2
    And stderr contains "<words>"
    Examples:
      | reason       | words                                   |
      | exit-nonzero | Make that command pass                  |
      | timeout      | ran past                                |
      | tree-changed | changed the working tree                |
      | no-tree      | could not check                         |
      | no-ledger    | could not check                         |
      | not-started  | could not check                         |

  # AC-e07s02-03
  Scenario: Input over the cap is refused
    When stdin holds more than 1 MiB
    Then the CLI exits 2 and says the input is too large

  # AC-e07s02-04
  Scenario: A host that never closes stdin does not stall the hook
    When stdin stays open past the deadline
    Then the CLI exits 2 and says the input did not end

  # AC-e07s02-05
  Scenario: Empty input is refused
    When stdin is empty
    Then the CLI exits 2

  # AC-e07s02-06
  Scenario: A throw becomes a block
    Given work that throws or rejects
    When failClosed runs it
    Then the exit code is 2 and stderr says "adapter fault"

  # AC-e07s02-07
  Scenario: A project directory that is not a git tree blocks
    Given CLAUDE_PROJECT_DIR is a directory with no git tree
    When the CLI runs "true"
    Then it exits 2 and stderr says weftwork could not check

  # AC-e07s02-08
  Scenario: A declared command that cannot start blocks
    When the command is one the shell cannot run
    Then the CLI exits 2

  # AC-e07s02-09
  Scenario: SIGTERM kills the command and blocks
    Given the CLI is running "sleep 60"
    When it gets SIGTERM
    Then it exits 2 and the sleep is gone

  # AC-e07s02-10
  Scenario: A bad argument list exits 2 without reading stdin
    When the CLI gets no command and stdin stays open
    Then it exits 2 within a few seconds

  # AC-e07s02-11
  Scenario: The residual is pinned
    When the CLI is started on a path that does not exist
    Then its exit code is not 2
    And the CLI header names e07s04
```

## Steps

1. RED then GREEN: add the AC-01 and AC-02 tests to
   `src/claude-hook.test.ts`, record the failure, then add the two
   constants, the `timeoutMs` in `hookRequest` and the reason wording in
   `hookAnswer`
   → verify: `node --test src/claude-hook.test.ts && npm run typecheck`
2. RED then GREEN: write `src/claude-hook.fault.test.ts` for AC-03 to
   AC-06 (stream tests with `PassThrough`) and record the failure. Add
   `readHookInput` and `failClosed` to `claude-hook.ts`
   → verify: `node --test src/claude-hook.fault.test.ts
   src/claude-hook.test.ts && npm run typecheck`
3. RED then GREEN: add the AC-03 to AC-05 and AC-07 to AC-10 tests that
   start the real CLI in temporary directories to
   `src/claude-hook-cli.fault.test.ts`, record the failure, then wire the
   CLI through `failClosed`, `readHookInput` and the signal controller
   → verify: `node --test src/claude-hook.fault.test.ts
   src/claude-hook-cli.fault.test.ts src/claude-hook-cli.test.ts &&
   npm run typecheck`
4. Write the residual in the CLI header and pin it (AC-11), then run the
   AGENTS.md Preflight line
   → verify: `grep -q 'e07s04' src/claude-hook-cli.ts && yamllint specs
   && bash tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh
   && npm run typecheck && npm test`

Red-flag check: I caught two. First, I nearly wrote an injectable engine
to test "the engine throws"; `failClosed` takes the work as a parameter,
which tests it with no mock of the engine. Second, I nearly allowed the
stop for faults Claude cannot fix, to stop it looping; that is fail-open,
so the message says "tell the owner" and the host's cap ends the loop.

## 4. Dependencies (slopcheck)

No new packages. Node built-ins only. `[OK]`

## 5. Out of scope

- The `timeout` on the settings entry and the trust step: e07s03 (it
  reads `hookTimeoutSeconds`).
- The live check, the worktree limit and the `GIT_DIR` note: e07s04.
- Making the ledger unreadable to switch the stop rules off (F5): e08 or
  e09. Authorship of override.json is not proof (T4). `setsid` escape (T6).
- A kill by SIGKILL, or a crash before any code runs: only the e07s04
  check can see these.

## 6. Risks

- **The host's cap ends a loop on faults Claude cannot fix.** A project
  with no git tree blocks eight times, then the host overrides. The
  message says "tell the owner" each time.
- **A slow filesystem can eat the 60 s margin.** The fingerprint on a
  huge tree could pass 60 s. Then the host cuts the hook first and the
  stop goes ahead. e07s04's live check is the detector.
- **SIGTERM handling covers the host's timeout kill only if the host sends
  SIGTERM first.** The docs do not say. The command's process group is
  killed on SIGTERM; on SIGKILL it can outlive the hook (T6 residual).
- **10 s stdin deadline.** A host that writes slowly under load could
  trip it. The Stop input is a few hundred bytes written at once, so the
  risk is low. The deadline is one constant.

## Verification Script (human)

1. `npm test`. All pass, including the fault tests.
2. In a directory that is not a git repository, run
   `echo '{}' | CLAUDE_PROJECT_DIR="$PWD" node <weftwork>/src/claude-hook-cli.ts -- true; echo $?`.
   Expect `2` and "could not check".
3. `head -c 2000000 /dev/zero | CLAUDE_PROJECT_DIR="$PWD" node <weftwork>/src/claude-hook-cli.ts -- true; echo $?`.
   Expect `2` and "too large".
