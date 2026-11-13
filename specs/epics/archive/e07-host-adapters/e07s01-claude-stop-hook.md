# e07s01 — A Claude Code Stop hook calls the engine and blocks the stop

**type:** feat
**risk:** P1
**context:** adapter
**bcps:** 5
**epic:** e07 (Host adapters, B3)
**research story:** none (B3 rests on R5 and R13 through
docs/research/SYNTHESIS.md; the hook contract is R13 [S25])
**branch:** e07s01-claude-stop-hook

## 1. Purpose

The engine (e06) answers "done or not" with an exit code, but no host
calls it yet. An agent in Claude Code can still say "done" and stop, and
nothing runs the declared command. This story is the tracer bullet for B3:
the thinnest path from a real host event to the engine and back. Claude
Code fires a Stop hook when the agent tries to end its turn. The hook
reads the host's JSON on stdin, asks the engine to run the owner's
declared command, and answers in the host's terms. A failed run blocks the
stop, and Claude gets the reason so it can keep working.

Host contract, read on 2026-11-12 from the Claude Code hooks docs
(https://code.claude.com/docs/en/hooks, through Context7
`/websites/code_claude`; installed Claude Code 2.1.322):

- Stop hook input is one JSON object on stdin with the common fields
  (`session_id`, `transcript_path`, `cwd`, `permission_mode`,
  `hook_event_name`) plus `stop_hook_active`, `last_assistant_message`,
  `background_tasks` and `session_crons`.
- "Blocking error: your hook exits 2. On events that can block, Claude
  Code stops the action." For Stop, "Claude receives the stderr message
  as the explanation for why it should continue."
- Exit 0 applies any JSON output fields. `systemMessage` is a "Warning
  message shown to the user". Stdout counts as JSON only when it is one
  JSON object with nothing else around it.
- Any other exit code, a hook that does not start, or invalid JSON is a
  non-blocking error, so the stop goes ahead (fail-open; e07s02 and
  e07s04).
- Claude Code overrides a Stop block after eight consecutive
  continuations with no tool call (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`).

Owner decisions (2026-11-12; 1 to 3 in plan-work, 4 after review round 1; each took the
recommended option):

1. **The declared command is an argument of the hook entry.** The
   settings entry runs `node <repo>/src/claude-hook-cli.ts -- '<command>'`.
   The agent can edit `.claude/settings.json`. Protecting that file is
   e10's job (protected paths), and the engine already treats the command
   as the owner's (threat model T1).
2. **blocked, stalled, exhausted and killed allow the stop with a
   warning.** The engine has said the run is over. Blocking would make the
   agent retry a run the engine already ended, until the host's cap of
   eight overrode it. The warning says "not done" and names the state.
3. **overridden allows the stop with a warning.** That is what the
   owner's record is for. The warning says "overridden" and "not done",
   never "done".
4. **The command runs in `CLAUDE_PROJECT_DIR`, not in the Stop input's
   `cwd`** (owner, 2026-11-12, after review round 1; recommended option).
   The hooks docs say `cwd` follows the agent's `cd`, and
   `${CLAUDE_PROJECT_DIR}` "stays put". With `cwd`, an agent could write
   a passing check in a sub directory, `cd` into it and stop. The
   variable unset, empty or relative blocks the stop. In a worktree
   session the gate checks the main checkout (section 6).

## 2. Zoom-out

This story adds two files and changes none. It calls one library
function.

- **Module used: `runEngine` in `src/engine.ts`.**
  - Purpose: decide how one run ends, and log every terminal state.
  - Callers today: `src/cli.ts` and the engine tests.
  - Contracts: it resolves and never rejects for an expected failure. It
    returns an `Answer` (`Verdict` plus `state` and an optional
    `detail`). `done` comes only from `runGate`. The declared command's
    own stdout and stderr go to the process's stderr
    (`src/process.ts`, `stdio: ['ignore', 2, 2]`), so the hook's stdout
    stays free for the host's JSON.
- **Type used: `State` in `src/states.ts`.** There are eight states. The
  mapping below is an exhaustive `switch`, so a ninth state fails
  `tsc`.

No existing module changes, so `assess-impact` is not needed. The only
existing file this story edits is AGENTS.md (Architecture section).

## 3. Requirements

#### ADDED: the host answer, `src/claude-hook.ts`

- `parseHookInput(text)` returns `{ ok: true }` for a JSON object and
  `{ ok: false, error }` otherwise. No field is read from it. `cwd`
  follows the agent's `cd` (see AC-11), `last_assistant_message` is the
  agent's own text, and `stop_hook_active` is ignored: the engine's stop
  rules and the host's cap end a loop, not this hook.
- `projectDir(env)` returns the directory the command runs in:
  `CLAUDE_PROJECT_DIR`, which the host sets and the agent cannot change.
  It is `{ ok: false, error }` when the variable is unset, empty or not an
  absolute path, and the stop is blocked (fail-closed).
- `hookRequest(args, dir)` returns the engine request for exactly
  `['--', <command>]`, built by `parseRequest` from gate.ts, so a blank
  command is refused by the same rule as the engine CLI. Anything else is
  `{ ok: false, error }` with a usage line.
- `hostBlockExitCode` is 2, the one code the host reads as a block.
  `blockStop(message)` builds every blocking answer from it.
- `hookAnswer(answer)` maps an engine `Answer` to
  `{ exitCode, stdout, stderr }`:

  | state | exit | stdout | stderr |
  |---|---|---|---|
  | done | 0 | empty | empty |
  | failed | 2 | empty | `weftwork: not done (failed, <reason>): <command>` and a line asking Claude to make it pass before it stops |
  | blocked, stalled, exhausted, killed | 0 | `{"systemMessage":"weftwork: not done (<state>): <detail or reason>"}` | empty |
  | overridden | 0 | `{"systemMessage":"weftwork: overridden by the owner's record, not done: <command>"}` | empty |

- No text for any state other than done may say the work is done. The
  word "done" appears only after "not" in a not-done message.
- Bad hook input is not a state. It answers exit 2 with
  `weftwork: unreadable hook input: <error>` on stderr. This blocks the
  stop, which is the fail-closed answer. e07s02 owns the full fault list.

#### ADDED: the thin CLI, `src/claude-hook-cli.ts`

- It reads stdin, takes exactly one argument after `--` as the declared
  command, calls `runEngine` in `CLAUDE_PROJECT_DIR`, not in the Stop
  input's `cwd`, writes `stdout` and `stderr` as `hookAnswer` says, and sets the exit
  code. It has no logic of its own (CONVENTIONS.md, TypeScript code
  style).
- A header comment says: the command is shell code from the owner's hook
  entry, never from the agent (T1); exit 2 is the only block; a crash
  before the code runs is fail-open (e07s02 records it, e07s04 checks
  for it).
- No argument, or more than one argument, answers exit 2 with a usage
  line. This is the minimum here; e07s02 tests it.

#### ADDED: AGENTS.md, Architecture section

- It names `src/claude-hook.ts` and `src/claude-hook-cli.ts` as the
  Claude Code adapter.

## 17. Acceptance criteria (Gherkin)

```gherkin
Feature: Claude Code Stop hook

  # AC-e07s01-01
  Scenario: A done run lets the agent stop
    Given an engine answer with state "done"
    When hookAnswer maps it
    Then the exit code is 0 and stdout and stderr are empty

  # AC-e07s01-02
  Scenario: A failed run blocks the stop
    Given an engine answer with state "failed", reason "exit-nonzero",
      command "npm test"
    When hookAnswer maps it
    Then the exit code is 2
    And stderr names the state, the reason and the command
    And stdout is empty

  # AC-e07s01-03
  Scenario Outline: A stop rule ends the run and the stop is allowed
    Given an engine answer with state "<state>" and a detail
    When hookAnswer maps it
    Then the exit code is 0
    And stdout is one JSON object whose only key is "systemMessage"
    And the message contains "not done" and "<state>"
    Examples:
      | state     |
      | blocked   |
      | stalled   |
      | exhausted |
      | killed    |

  # AC-e07s01-04
  Scenario: An overridden run is allowed and never reads as done
    Given an engine answer with state "overridden"
    When hookAnswer maps it
    Then the exit code is 0
    And the systemMessage contains "overridden" and "not done"

  # AC-e07s01-05
  Scenario: Hook input is checked, not read
    Given the Stop input from the docs, with stop_hook_active true
    When parseHookInput reads it
    Then it returns ok
    And input that is not JSON, or not an object, returns not ok

  # AC-e07s01-11
  Scenario: The agent's cd does not move the owner's command
    Given a repository whose root check fails and whose sub directory has
      a check of the same name that passes
    And CLAUDE_PROJECT_DIR is the root
    When the CLI gets a Stop input whose cwd is the sub directory
    Then the root check runs and the stop is blocked
    And a missing, empty or relative CLAUDE_PROJECT_DIR blocks the stop

  # AC-e07s01-12
  Scenario: A blank or malformed command never answers done
    When the CLI gets "--" and a command of only spaces, or no command, or
      more than one
    Then it exits 2 and stdout is empty

  # AC-e07s01-06
  Scenario: The real CLI blocks on a failing command
    Given a temporary git repository
    When the CLI gets that repository's Stop input and the command "false"
    Then it exits 2 and stderr contains "not done (failed"
    And stdout is empty

  # AC-e07s01-07
  Scenario: The real CLI allows a passing command
    Given a temporary git repository
    When the CLI gets that repository's Stop input and the command "true"
    Then it exits 0 and stdout is empty

  # AC-e07s01-08
  Scenario: The command's output does not reach the host's stdout
    Given a temporary git repository
    When the CLI runs the command "echo hello; exit 1"
    Then stdout is empty and stderr contains "hello"

  # AC-e07s01-09
  Scenario: Unreadable input and a bad argument list block the stop
    When the CLI gets "not json" on stdin, or no command argument
    Then it exits 2 and stderr says why

  # AC-e07s01-10
  Scenario: AGENTS.md stays true
    Then the Architecture section names claude-hook
    And the AGENTS.md Preflight line passes
```

## Steps

1. RED: write `src/claude-hook.test.ts` for AC-01 to AC-05, run it, and
   record the failure. GREEN: write `src/claude-hook.ts`
   (`parseHookInput`, `hookAnswer`, exhaustive switch over `State`)
   → verify: `node --test src/claude-hook.test.ts && npm run typecheck`
2. RED: write `src/claude-hook-cli.test.ts` for AC-06 to AC-09. It
   starts the real CLI as a child process against `makeTestRepo()` from
   `src/test-helpers.ts`. Record the failure. GREEN: write
   `src/claude-hook-cli.ts` as a thin shell
   → verify: `node --test src/claude-hook.test.ts
   src/claude-hook-cli.test.ts && npm run typecheck`
3. Update the AGENTS.md Architecture section (AC-10), then run the
   AGENTS.md Preflight line
   → verify: `grep -q 'claude-hook' AGENTS.md && yamllint specs && bash
   tools/validate-specs-yaml.sh && bash tools/check-gate-ignores.sh &&
   npm run typecheck && npm test`

The CLI tests use temporary repositories, so the `false` runs never land
in this repository's own ledger. If they did, they would trip its stop
rules and later runs would answer `stalled` (exit 0) instead of exit 2.

Red-flag check: I caught one rationalization. I nearly put
`echo '{"cwd":"."}' | node src/claude-hook-cli.ts -- false` in a verify
line, as the slice did. Run against this repository, it would add a
failure to the real ledger on every verify run, and after a few runs the
answer would change. The verify lines run only tests that use temporary
repositories.

## 4. Dependencies (slopcheck)

No new packages. It uses Node built-ins and `typescript` and
`@types/node`, which are already installed. `[OK]`

## 5. Out of scope

- The fault list (stdin too large, an engine that throws, the hook
  timing out, signals) is e07s02. Writing the residual down is also
  e07s02.
- Writing the hook entry into `.claude/settings.json`, the `timeout` on
  the entry, and the trust step are e07s03.
- The live check and the heartbeat line are e07s04.
- Protecting `.claude/settings.json` from the agent is e10.
- PreToolUse hooks, SubagentStop, and the pi wrapper.
- Reading `stop_hook_active`, `last_assistant_message` or
  `background_tasks`. A session waiting on background work is still
  gated. Revisit if that blocks real use.

## 6. Risks

- **The host's timeout can make the gate fail open.** A Stop hook killed
  by the host's timeout is a non-blocking error, so the stop goes ahead.
  The engine's default command timeout is 600000 ms. The host's default
  for a command hook was not confirmed in this session. e07s02 must keep
  the engine's timeout under the hook's, and e07s03 must write an
  explicit `timeout` on the entry. Both task files carry this note.
- **Long command output on stderr.** On exit 2, Claude gets all of
  stderr, which includes the declared command's output. A large test log
  costs context. The command's output and the engine's notes go to
  stderr while the command runs, so the reason line comes last, after
  them (AC-08 asserts this order; the review of round 1 found the first
  draft of this spec had it backwards). If the host ever keeps only the
  start of stderr, the reason is what gets lost. Revisit with the cap in
  e07s02, or when a real session shows the cost.
- **The gate checks the project root, not a worktree.** The command runs
  in `CLAUDE_PROJECT_DIR`, which stays at the root where the session
  started (hooks docs, read 2026-11-12). In a Claude Code worktree
  session the Stop input's `cwd` is the worktree and the gate would still
  check the main checkout. This project uses plain branches, so it does
  not hit this. e07s04 must say so in its live check.
- **Some `failed` reasons cannot be fixed by Claude.** `no-tree`,
  `no-ledger` and `tree-changed` all answer "Make that command pass".
  With no git tree there is no ledger, so no stop rule can trip and only
  the host's cap ends the loop. e07s02 owns the non-git case and these
  reasons.
- **The host contract can change.** The exit codes and the stdout JSON
  shape come from the docs on 2026-11-12. The hook reads no field of the
  Stop input, so no field rename can break it. The exit-2 rule and the
  `systemMessage` shape are not tested against the real host here: only
  the live check in e07s04 can catch a change in them.
- **The eight-continuation cap.** Claude Code overrides the ninth
  consecutive block with no tool call. The engine's stall rule ends a
  same-tree loop sooner, so the cap is a backstop, not the stop rule.

## Verification Script (human)

1. `npm test`. All tests pass, including `claude-hook*`.
2. In a scratch git repository, run
   `echo "{\"cwd\":\"$PWD\"}" | CLAUDE_PROJECT_DIR="$PWD" node <weftwork>/src/claude-hook-cli.ts -- false; echo $?`.
   Expect `2` and a `weftwork: not done (failed` line.
3. Run the same with `-- true`. Expect `0` and no stdout.
4. A real Claude Code session waits for e07s03, which registers the hook.
