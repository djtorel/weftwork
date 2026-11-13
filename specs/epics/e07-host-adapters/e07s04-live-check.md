# e07s04 — Check that the hook is live, and fail loudly when it is not

**type:** feat
**risk:** P1
**context:** adapter
**bcps:** 5
**epic:** e07 (Host adapters, B3)
**research story:** none (SYNTHESIS "Engine and adapters": the adapter
"checks that it is live; the engine fails loudly when its own hook is
missing", because R2 found a guard hook that was never registered [S5][S13])
**branch:** e07s04-live-check

## 1. Purpose

A Stop hook that never starts blocks nothing, and no host option makes
Claude Code block a stop because a hook failed to start (R13 [S25]; the
e07s02 fail-open residual). e07s03 writes the entry, but nothing says
whether Claude Code runs it. This story adds a check command. It reads the
settings and a record that the adapter writes on each call, and answers
one of three things: `live`, `registered, not seen` or `not registered`.
It spends no model tokens and never starts a session.

Host facts, read 2026-11-12 from the Claude Code docs through Context7
`/websites/code_claude` (installed Claude Code 2.1.322):

- **Precedence.** Settings layers, highest first: managed policy, the
  `--settings` flag, `.claude/settings.local.json`, `.claude/settings.json`,
  `~/.claude/settings.json`. "Arrays merge across layers; scalars at a
  higher layer override lower ones"
  (https://code.claude.com/docs/en/glossary, "Settings layers").
- **`disableAllHooks`.** "Claude Code reads the value left after settings
  precedence applies, so a `"disableAllHooks": false` in a project's
  `.claude/settings.json` overrides a `true` in your user settings." Outside
  managed settings it disables user, project, local and plugin hooks
  (https://code.claude.com/docs/en/hooks, "Disable or remove hooks";
  https://code.claude.com/docs/en/settings-reference, `disableAllHooks`).
- **`allowManagedHooksOnly`** (managed only): "Hooks in your user, project,
  and local settings files don't run and aren't listed"
  (https://code.claude.com/docs/en/hooks-guide, "/hooks shows no hooks
  configured").
- **User settings path.** `CLAUDE_CONFIG_DIR` overrides the configuration
  directory (default `~/.claude`); "All settings ... are stored under this
  path" (https://code.claude.com/docs/en/env-vars).
- **A running session sees an edit.** "File edits are normally picked up
  automatically. If they haven't appeared after a few seconds, the file
  watcher may have missed the change: restart your session to force a
  reload" (https://code.claude.com/docs/en/hooks-guide, same section). This
  answers the open point from e07s03 step 6, but "normally" is not a
  promise, so the check still never calls a hook live for a session it has
  not seen call it.

Owner decisions (2026-11-12, plan-work; all three recommendations taken):

1. **The adapter records each call in its own small file,**
   `<git dir>/weftwork/last-call.json`, overwritten on each call. It is not
   a ledger line: the ledger and its readers do not change, the stop rules'
   1 MiB read cap is not spent on it, and `ledger.ts` (289 of 300 lines)
   does not grow. Only the last call is kept.
2. **Live means the same entry was called.** The answer is `live` only
   when the last recorded call used the same adapter path and the same
   command as an entry in the settings now. Its age is printed, not judged.
   An edited entry reads `registered, not seen` until the host calls it.
3. **The check reads local, project and user settings** and applies
   precedence for `disableAllHooks`. Managed settings and the `--settings`
   flag cannot be seen, so the report names them as not read.

## 2. Zoom-out

- **`src/claude-install.ts`** (e07s03, 299 lines). Purpose: the settings
  edit that registers the Stop hook. Callers: `claude-install-cli.ts`
  (`installInProject`) and `claude-install.test.ts` (`installStopHook`,
  `shellQuote`, `stopHookCommand`). Contracts: `installStopHook` is pure; an
  entry is weftwork's only when it is a command hook whose text is exactly
  `node '<this adapter>' -- ` and one single-quoted argument; the write is
  atomic and only when the text changes; wrong shapes are refused. This
  story moves the file half out and adds one parser. All contracts stay.
- **`src/claude-hook-cli.ts`** (e07s01, e07s02). Purpose: the program the
  entry runs. Callers: Claude Code, through the entry. Contracts: exit 2 is
  the only block; every fault of its own ends in exit 2; the command runs in
  `CLAUDE_PROJECT_DIR`. This story adds one write before the engine runs. A
  failure of that write must not change any answer.
- **`src/ledger.ts`** (e06s03). Purpose: the counts ledger in the git dir.
  Callers: the engine, the gate, the CLIs. Contract: files open without
  blocking and only as regular files (BUG-007). This story exports
  `openRegular` and `ledgerPath` stays as it is; nothing else changes.

`assess-impact` is not run as a separate skill: the only existing callers
that change are the install CLI's import (task 1) and the adapter's one
added call (task 2), and both have tests through the real CLI.

## 3. Requirements

#### ADDED: one parser for weftwork's entry, in `src/claude-install.ts`

- `parseStopHookCommand(text)` returns `{ cliPath, command }` when `text` is
  exactly `node <quoted> -- <quoted>` in the form `shellQuote` writes, else
  `null`. `isOurs(hook, cliPath)` becomes: a command hook whose command
  parses and whose `cliPath` is equal. The install and the check then use
  one rule (handoff point 1).
- **Reason for Depth:** two callers must agree on what an entry is; a copy
  would drift.

#### MODIFIED: where the install's file code lives

- **Before:** `src/claude-install.ts` held the pure edit and the file I/O
  (`readSettings`, `isGitRoot`, `writeAtomic`, `installInProject`), 299
  lines.
- **After:** the file I/O moves unchanged to `src/claude-settings-file.ts`,
  which exports `readSettings`, `isGitRoot` and `installInProject`.
  `claude-install.ts` keeps the pure edit and also exports
  `parseSettings` and `stopListOf` for the check. No behaviour changes.

#### ADDED: the call record, `src/last-call.ts`

- `lastCallPath(cwd)`: `last-call.json` beside the ledger
  (`dirname(ledgerPath(cwd))`), or null when there is no git dir.
- `writeLastCall(path, { at, cliPath, command })`: makes the directory
  0700, opens with `openRegular` (no FIFO, no symlink target that is not a
  regular file), truncates, writes one JSON object, mode 0600 (the command
  may hold a secret, T8). Returns a result, never throws.
- `readLastCall(path)`: `{ ok: true, call }` where `call` is null when
  there is no file; `{ ok: false, error }` for a file that is not regular,
  not JSON, or has a field of the wrong type. Never throws.
- **Reason for Depth:** the adapter writes it and the check reads it; the
  shape and the safe open are one rule.

#### MODIFIED: the adapter records each call

- **Before:** `claude-hook-cli.ts` checks the project directory and the
  arguments, reads the input, then runs the engine. It writes nothing of
  its own.
- **After:** right after the arguments are accepted and before the input
  is read, it writes the call record (its own absolute path, the command,
  the time). A failed write is ignored: the answer, the exit code and the
  ledger are the same as without it. A call refused for bad arguments or a
  bad project directory writes no record.

#### ADDED: the live check, `src/claude-live.ts`

- `liveReport(input)` is pure. Input: the read results of the local,
  project and user settings files (text, null for no file, or an error);
  the adapter-exists predicate; the call record read result; `now`.
  Output: `{ answer: 'live' | 'not-seen' | 'not-registered', reason,
  notes }`.
- Order, first match wins:
  1. Project settings that cannot be read or have the wrong shape:
     `not-registered`, with the error.
  2. No Stop hook in the project settings parses as weftwork's:
     `not-registered`. The reason counts the other Stop hooks.
  3. Every weftwork entry names an adapter that does not exist:
     `not-registered`, naming the path ("run the install again").
  4. Local or user settings cannot be read, or `disableAllHooks` is `true`
     after precedence (local over project over user): `not-seen`, naming
     the file that decides it.
  5. No call record, or one that cannot be read: `not-seen`.
  6. No weftwork entry with its adapter present is exactly what the
     install writes (`{type, command, timeout}`, nothing more):
     `not-seen`, "run the install again". A hand edit such as
     `"async": true`, an `if` or a short `timeout` runs the hook but
     cannot block a stop (Claude Code hooks docs, read 2026-11-12;
     review round 1, B-F1).
  7. The call record's adapter path and command equal such an entry's:
     `live`, with the command, the record's time and age ("in the
     future" for a time after now). Otherwise `not-seen` ("the last call
     ran another command or adapter").
- Notes, always printed: managed settings and `--settings` were not read,
  and `allowManagedHooksOnly` there would stop the hook; when two weftwork
  entries exist, two Stop hooks run; the hook runs in
  `CLAUDE_PROJECT_DIR`, so a session that works in a git worktree is gated
  on the project directory's tree, not the worktree's; `GIT_DIR`,
  `GIT_WORK_TREE` and `GIT_INDEX_FILE` in the hook's environment would move
  the fingerprint; a crash or SIGKILL after the record is written still
  reads as seen, and one before it reads as not seen.
- **Reason for Depth:** six ordered cases plus precedence, and the CLI may
  hold no logic (CONVENTIONS.md).

#### ADDED: the check command, `src/claude-live-cli.ts`

- Usage: run in the project's root, `node <weftwork>/src/claude-live-cli.ts`.
  No arguments.
- The current directory must contain `.git` (`isGitRoot`), else exit 1.
- Reads `.claude/settings.local.json`, `.claude/settings.json` and the user
  file (`$CLAUDE_CONFIG_DIR/settings.json`, else `$HOME/.claude/settings.json`;
  neither set: reported as not read) with `readSettings`, and the call
  record with `readLastCall`.
- Prints the answer, the reason, the notes and what to do next (run the
  install; accept the trust dialog; turn `disableAllHooks` off; let a
  session stop once). Exit 0 only for `live`, 1 otherwise.

## 17. Acceptance criteria (Gherkin)

```gherkin
Feature: Check that the Stop hook is live

  # AC-e07s04-01
  Scenario: The install and the check agree on what an entry is
    Given the command text stopHookCommand writes, with a quote in the
      command and a space in the path
    When parseStopHookCommand reads it
    Then it returns the same path and command
    And it returns null when shell text follows the quoted argument
    And every claude-install test still passes after the file split

  # AC-e07s04-02
  Scenario Outline: Not registered
    Given <settings>
    When liveReport runs
    Then the answer is not-registered and the reason says why
    Examples:
      | settings                                              |
      | no project settings file                              |
      | project settings that are not JSON                    |
      | a Stop list with only another command's hook          |
      | a weftwork entry whose adapter path does not exist    |

  # AC-e07s04-03
  Scenario Outline: disableAllHooks follows precedence
    Given a weftwork entry and a matching call record
    And disableAllHooks <values>
    When liveReport runs
    Then the answer is <answer>
    Examples:
      | values                                  | answer   |
      | true in the project file                | not-seen |
      | true in the user file                   | not-seen |
      | true in user, false in project          | live     |
      | false in project, true in local         | not-seen |

  # AC-e07s04-04
  Scenario Outline: Registered, not seen
    Given a weftwork entry and <record>
    When liveReport runs
    Then the answer is not-seen
    Examples:
      | record                                     |
      | no call record                             |
      | a call record that is not JSON             |
      | a call record for another command          |
      | a call record from another adapter path    |
      | an unreadable user settings file           |

  # AC-e07s04-05
  Scenario: Live
    Given a weftwork entry and a call record for the same path and command
    When liveReport runs
    Then the answer is live and the reason holds the record's time
    And with two weftwork entries a note says two Stop hooks run

  # AC-e07s04-06
  Scenario: The adapter records a call and still answers the same
    Given a temporary repository
    When the adapter CLI runs once with a passing command
    Then last-call.json holds its path, the command and a time
    And the exit code and the ledger lines are as before
    And when last-call.json is a directory, the exit code and the ledger
      are the same, and the adapter writes no record

  # AC-e07s04-07
  Scenario: Bad arguments write no record
    When the adapter CLI runs with no command
    Then it exits 2 and no last-call.json exists

  # AC-e07s04-08
  Scenario: The check command through the real CLI
    Given a temporary repository and a temporary home with no settings
    Then the check exits 1 and says "not registered"
    When the install runs there
    Then the check exits 1 and says "registered, not seen"
    When the adapter is called once as the host would call it
    Then the check exits 0 and says "live"
    When disableAllHooks is true in .claude/settings.local.json
    Then the check exits 1 and names that file

  # AC-e07s04-09
  Scenario: The check refuses a directory that is not a repository
    When the check runs in a directory with no .git
    Then it exits 1 and writes nothing

  # AC-e07s04-10
  Scenario: A real session makes the hook live (owner run, task 5)
    Given the hook is installed in a scratch clone
    Then the check says "registered, not seen"
    When a real Claude Code session there ends one reply
    Then the check says "live"
```

## Steps

1. Refactor, no behaviour change: move the file I/O of
   `src/claude-install.ts` to `src/claude-settings-file.ts`, point
   `claude-install-cli.ts` at it, and add `parseStopHookCommand` with its
   test (AC-01, RED first for the parser) → verify: `node --test
   src/claude-install.test.ts src/claude-install-cli.test.ts && npm run
   typecheck`
2. RED then GREEN: `src/last-call.test.ts`, then `src/last-call.ts`; then
   the adapter test (AC-06, AC-07) in `src/claude-hook-cli.test.ts`, then
   the one call in `claude-hook-cli.ts` → verify: `node --test
   src/last-call.test.ts src/claude-hook-cli.test.ts src/ledger.test.ts &&
   npm run typecheck`
3. RED then GREEN: `src/claude-live.test.ts` for AC-02 to AC-05, then
   `src/claude-live.ts` → verify: `node --test src/claude-live.test.ts &&
   npm run typecheck`
4. RED then GREEN: `src/claude-live-cli.test.ts` for AC-08 and AC-09, with
   a temporary repository and `HOME` and `CLAUDE_CONFIG_DIR` set to
   temporary directories, then `src/claude-live-cli.ts` → verify: `node
   --test src/claude-live.test.ts src/claude-live-cli.test.ts && npm run
   typecheck`
5. Write `specs/epics/e07-host-adapters/e07s04-verify-script.md` from the
   Verification Script below, then run Preflight. The owner runs the
   script (AC-10); it spends model tokens, so CI does not → verify: `test
   -f specs/epics/e07-host-adapters/e07s04-verify-script.md && yamllint
   specs && bash tools/validate-specs-yaml.sh && bash
   tools/check-gate-ignores.sh && npm run typecheck && npm test`

Red-flag check: I caught three. First, I nearly had the heartbeat give a
time window ("seen in the last day"); the owner chose the same-entry rule,
which needs no number. Second, I nearly read only the project settings,
which misses a `disableAllHooks` in the personal local file. Third, I nearly
let the check read the real `~/.claude`; every test sets `HOME` and
`CLAUDE_CONFIG_DIR` to temporary directories, and the CLI reads them from
its environment.

## 4. Dependencies (slopcheck)

No new packages. Node built-ins only (`node:fs`, `node:path`). `[OK]`

## 5. Out of scope

- Managed settings files and `allowManagedHooksOnly` values: named as not
  read. The per-host boundary report is e10.
- Telling a crash after the record from a normal call (a start-and-end
  pair). The adapter's own fault answers leave no ledger line either, so a
  missing end line would raise false alarms.
- A hook entry in `settings.local.json` or user settings: the install
  writes only the project file, so the check looks there.
- Changing the install's "start a new session" note now that the docs say
  edits are picked up: a later story, or the e11 entry command.
- The pi wrapper (after e07s04, only if it stays small).
- Installing the hook in this repository.

## 6. Risks

- **The agent can forge the record.** It can write `last-call.json` as it
  can write the ledger (T3), so `live` is evidence, not proof. The check
  says so. e10 protects the git dir paths.
- **The check's environment is not the session's.** `HOME`,
  `CLAUDE_CONFIG_DIR` or the `--settings` flag in the shell that started
  Claude Code can differ from the shell that runs the check. The report
  names the user file it read.
- **Path spelling.** The record holds the adapter's `import.meta.filename`,
  and the entry holds the path the install wrote. A checkout reached
  through a symlink can spell them differently, and then the check says
  `not-seen` when the hook runs. It fails toward "not live", never toward
  "live". The test asserts that the install's path and the adapter's own
  path are equal for a normal checkout.
- **A torn record.** Two hooks writing at once, or a crash mid-write, can
  leave a file that is not JSON. It reads as `not-seen`. With two weftwork
  entries both write on every stop, so a torn file can recur (review round
  1 reproduced 8 in 200 concurrent writes). It errs toward "not live". A
  temp file and a rename would fix it; deferred to e10 with the git-dir
  paths.
- **A symlinked `.git/weftwork` directory.** `O_NOFOLLOW` covers only the
  file name, so the record (and the ledger) can be written in a directory
  the agent links to. Deferred to e10, which owns the git-dir paths (review
  round 1, A-F9 and B-F4).
- **A hook run by hand counts as called.** Running the adapter with
  `CLAUDE_PROJECT_DIR` set writes a matching record. The notes say so
  (review round 1, A-F8).
- **Extra work on every call.** One `git rev-parse` and one small write
  before the input is read. The engine runs the same `git` call, and both
  fall under the hook's own deadline (e07s02).
- **The precedence rule is read from the docs, not measured.** AC-03
  tests our reading of it; the owner run checks the real host once.

## Verification Script (human)

1. Make a scratch clone: `git clone /home/domtorr/Dev/personal_projects/weftwork
   /tmp/weftwork-e07s04 && cd /tmp/weftwork-e07s04`.
2. Run `node /home/domtorr/Dev/personal_projects/weftwork/src/claude-live-cli.ts;
   echo "exit=$?"`. Expect `not registered` and `exit=1`.
3. Run `node /home/domtorr/Dev/personal_projects/weftwork/src/claude-install-cli.ts
   -- 'true'`, then the check again. Expect `registered, not seen` and
   `exit=1`.
4. Start `claude` there. Accept the trust dialog if it appears. Ask for a
   one-line reply. The command is `true`, so the stop goes ahead.
5. Run the check again. Expect `live`, with the time of step 4, and
   `exit=0`.
6. With that session still open, put `"disableAllHooks": true` in
   `.claude/settings.local.json`. Run the check: expect `not seen` naming
   that file. Delete the line.
7. Record the results in `specs/verifications/e07s04-verify.yaml`, then
   delete `/tmp/weftwork-e07s04`.
