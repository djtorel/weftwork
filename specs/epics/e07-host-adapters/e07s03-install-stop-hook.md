# e07s03 — Install registers the Stop hook in the project's Claude Code settings

**type:** feat
**risk:** P1
**context:** adapter
**bcps:** 5
**epic:** e07 (Host adapters, B3)
**research story:** none (R2 found an unregistered guard hook; R13 [S25]
gives the hook contract)
**branch:** e07s03-install-stop-hook

## 1. Purpose

The Stop hook from e07s01 and e07s02 does nothing until a settings file
names it. R2 found a guard hook in this repository that was never
registered and so never ran. This story adds an install command. It
writes one Stop entry into the project's `.claude/settings.json`, keeps
everything else in that file, and is safe to run twice.

Host facts, read 2026-11-12 from the Claude Code docs through Context7
`/websites/code_claude` (installed Claude Code 2.1.322):

- `.claude/settings.json` is the shared project file. "In a git
  repository, commit it so teammates get it." `.claude/settings.local.json`
  is personal and kept out of git
  (https://code.claude.com/docs/en/settings, "Settings files and who
  they affect").
- A Stop entry has the shape `{"hooks": {"Stop": [{"hooks": [{"type":
  "command", "command": "...", "timeout": 10}]}]}}`. `timeout` is in
  seconds (https://code.claude.com/docs/en/self-hosted-environments-testing,
  Stop hook example; https://code.claude.com/docs/en/hooks).
- **Trust.** Claude Code has no per-hook trust step. "Claude Code checks
  workspace trust before it runs any hook from a settings file." In an
  interactive session it holds back hooks until the user accepts the
  workspace trust dialog for the folder or a parent. In `-p` or SDK
  sessions it never shows the dialog and treats the folder as trusted
  (https://code.claude.com/docs/en/hooks, "Security considerations >
  Workspace trust"). So the trust step is the dialog, and the install
  prints it.
- **Not found in the docs:** whether a running session picks up a hook
  added to a settings file. The install tells the owner to start a new
  session, and the verify script (task 3) records what happens.

Owner decisions (2026-11-12, plan-work; "approve" to all four
recommendations):

1. **The install writes `.claude/settings.json`.** A stop gate is a rule
   for the project, not a personal setting.
2. **The entry names this checkout's adapter by absolute path:**
   `node '<weftwork>/src/claude-hook-cli.ts' -- '<command>'`, each part
   quoted for the shell. weftwork is not installed into other projects
   yet, so the path works only on this machine. The install says so. A
   portable entry waits for the entry command (e11).
3. **A second run with a different command replaces weftwork's entry.**
   There is at most one. An entry is weftwork's when it is a command
   hook whose command starts with `node '<adapter path>' -- ` (changed
   after review round 1, 2026-11-12: a match on the path anywhere in
   the command deleted owner hooks that only mentioned it).
4. **The file is re-printed as JSON with 2-space indents.** Key order is
   kept (JSON.parse keeps the insertion order of string keys). The first
   install can change the spacing of an existing file; after that a
   second run changes nothing.

## 2. Zoom-out

New modules only: `src/claude-install.ts` (library) and
`src/claude-install-cli.ts` (thin shell). They read one constant from
an existing module and change no existing code.

- **`hookTimeoutSeconds` in `src/claude-hook.ts`** (660, e07s02).
  Purpose: the host's timeout for the hook entry. Callers today: the
  hook's own deadline (`hookDeadlineMs`) and its tests. Contract: it is
  at least 60 s longer than `engineTimeoutMs` (a test asserts it).
  This story adds one reader.
- **`src/claude-hook-cli.ts`.** Purpose: the program the entry runs.
  Contract: exactly one argument after `--` is the declared command; the
  command runs in `CLAUDE_PROJECT_DIR`, which the host sets. Unchanged.

`assess-impact` is not needed: no existing caller changes.

## 3. Requirements

#### ADDED: the entry text, in `src/claude-install.ts`

- `shellQuote(text)` wraps text in single quotes and writes each `'` as
  `'\''` (POSIX). `stopHookCommand(cliPath, command)` returns
  `node <quoted cliPath> -- <quoted command>`. The adapter then gets the
  command as one argument, as e07s01 decided.

#### ADDED: the settings edit, in `src/claude-install.ts`

- `installStopHook(text, cliPath, command)` takes the file's text, or
  `null` when there is no file, and returns `{ ok: true, text, changed,
  action }`
  or `{ ok: false, error }`. It is pure.
- The result has exactly one weftwork entry under `hooks.Stop`:
  `{ "type": "command", "command": <stopHookCommand>, "timeout":
  hookTimeoutSeconds }`. If a weftwork entry exists, the first one is
  replaced in place and any others are removed, with their group if it
  becomes empty. If none exists, a new group `{ "hooks": [entry] }` is
  appended to `hooks.Stop`.
- Every other key, every other event and every other Stop hook stay as
  they were, in the same order.
- The output is `JSON.stringify(value, null, 2)` plus a newline.
  `changed` is false when that equals the input text.
- Errors, with no output text: text that is not JSON; a top-level value
  that is not an object; `hooks` that is not an object (`null` too);
  `hooks.Stop` that is not an array (`null` too); a Stop group that is
  not an object or whose `hooks` is not an array; a blank command. A
  file that is empty or only blank reads as no settings (round 2, after
  review: `touch` leaves such a file).
- **Reason for Depth:** the edit has nine cases to test, and the CLI may
  hold no logic (CONVENTIONS.md).

#### ADDED: the install command, `src/claude-install-cli.ts`

- Usage: run in the project's root,
  `node <weftwork>/src/claude-install-cli.ts -- '<command>'`.
- The project is the current directory. It must contain `.git` (a
  directory or, in a worktree, a file); otherwise exit 1 with a reason.
- `.claude/settings.json` is checked with `lstat`. Missing means
  `null`. Anything but a regular file (a symlink, a FIFO, a directory)
  is refused: the same class as BUG-007, and the file is untrusted input
  (e10).
- When `changed`, it makes `.claude` if needed, writes a temporary file
  in `.claude` and renames it over `settings.json`, so a crash never
  leaves half a file. When not changed, it writes nothing.
- It prints what it did (`added`, `replaced`, `reformatted` or
  `unchanged` with the path), then three notes: the entry names this machine's weftwork path;
  if Claude Code shows the workspace trust dialog, accept it, or the hook
  does not run; start a new Claude Code session; commit
  `.claude/settings.json` to share the hook.
- Exit 0 on success, 1 on any error. It is not a hook, so exit 2 has no
  meaning here.

## 17. Acceptance criteria (Gherkin)

```gherkin
Feature: Install registers the Stop hook

  # AC-e07s03-01
  Scenario: No settings file
    Given no settings text
    When installStopHook runs with command "npm test"
    Then the result has one Stop group with one command entry
    And its timeout is hookTimeoutSeconds
    And its command is node, the quoted adapter path, "--" and the
      quoted command

  # AC-e07s03-02
  Scenario: Other keys and hooks are kept
    Given settings with "env", a PreToolUse hook and another Stop hook
    When installStopHook runs
    Then all three are unchanged and in the same order
    And the weftwork entry is added after the other Stop group

  # AC-e07s03-03
  Scenario: A second run changes nothing
    Given the text one install produced
    When installStopHook runs again with the same command
    Then changed is false and the text is the same

  # AC-e07s03-04
  Scenario: A new command replaces the old entry
    Given settings with a weftwork entry for "npm test"
    When installStopHook runs with "npm run check"
    Then there is exactly one weftwork entry, for "npm run check", in the
      same place

  # AC-e07s03-05
  Scenario Outline: Bad settings are refused
    Given settings text <text>
    When installStopHook runs
    Then the result is an error and has no text
    Examples:
      | text                                   |
      | not JSON                               |
      | a JSON array                           |
      | hooks is a string                      |
      | hooks.Stop is an object                |
      | a Stop group whose hooks is not a list |

  # AC-e07s03-06
  Scenario: Quotes in the command survive the shell
    Given the command echo "it's done" and an adapter path with a space
    When the entry's command is run by sh with the adapter replaced by a
      script that prints its arguments
    Then the script gets "--" and the command, unchanged

  # AC-e07s03-07
  Scenario: The CLI installs in a temporary repository
    Given a git repository with no .claude directory
    When the install CLI runs there with "-- 'npm test'"
    Then it exits 0, says "added", and .claude/settings.json holds the
      entry
    And it prints the trust and new-session notes

  # AC-e07s03-08
  Scenario: The CLI keeps an existing file and is idempotent
    Given a repository whose settings.json has other hooks
    When the install CLI runs twice
    Then the other hooks are kept
    And the second run says "unchanged" and leaves the file's bytes and
      modification time as they were

  # AC-e07s03-09
  Scenario: The CLI refuses and never overwrites
    Given a settings.json that is not JSON, or one that is a symlink
    When the install CLI runs
    Then it exits 1 with a reason and the file is unchanged

  # AC-e07s03-10
  Scenario: The CLI refuses a directory that is not a repository
    When the install CLI runs in a directory with no .git
    Then it exits 1 and writes no .claude directory

  # AC-e07s03-11
  Scenario: A real session is blocked (owner run, task 3)
    Given the hook is installed in a scratch copy with a failing command
    When a real Claude Code session there tries to stop
    Then the stop is blocked and Claude gets the engine's reason
```

## Steps

1. RED then GREEN: write `src/claude-install.test.ts` for AC-01 to
   AC-06 and record the failure. Then write `src/claude-install.ts`
   → verify: `node --test src/claude-install.test.ts && npm run
   typecheck`
2. RED then GREEN: write `src/claude-install-cli.test.ts` for AC-07 to
   AC-10, using temporary repositories from `src/test-helpers.ts`, and
   record the failure. Then write `src/claude-install-cli.ts`
   → verify: `node --test src/claude-install.test.ts
   src/claude-install-cli.test.ts && npm run typecheck`
3. Write `specs/epics/e07-host-adapters/e07s03-verify-script.md` from
   the Verification Script below, then run the AGENTS.md Preflight line.
   The owner runs the script (AC-11); it spends model tokens, so CI does
   not
   → verify: `test -f
   specs/epics/e07-host-adapters/e07s03-verify-script.md && yamllint
   specs && bash tools/validate-specs-yaml.sh && bash
   tools/check-gate-ignores.sh && npm run typecheck && npm test`

Red-flag check: I caught two. First, I nearly matched weftwork's entry
by the string `claude-hook-cli.ts` alone; that would also replace an
entry from another checkout of weftwork, so the match is the full
absolute path. Second, I nearly made the install edit this repository's
own settings in a verify line; every test uses a temporary repository,
and installing here is the owner's choice, not part of this story.

## 4. Dependencies (slopcheck)

No new packages. Node built-ins only (`node:fs`, `node:path`). `[OK]`

## 5. Out of scope

- Reporting whether the hook is live, `disableAllHooks`, managed
  settings and the heartbeat line: e07s04.
- Protecting `.claude/settings.json` from the agent: e10.
- A portable entry that does not name this machine's path: e11 (entry
  command).
- Uninstall. Delete the entry by hand, or add a story when needed.
- Writing `settings.local.json`, or a `--project` option.
- Installing the hook in this repository.

## 6. Risks

- **A hand-written entry in another form is not matched.** The install
  matches the exact text it writes. An entry the owner wrote by hand
  (double quotes, other spacing around `--`) gets a second, weftwork
  entry beside it, so two Stop hooks run. Better a duplicate than a
  deleted hook. `reformatted` is the action when weftwork's entry was
  already right and only the spacing of the file changed.
- **Owner fields on weftwork's entry are dropped on replace.** The
  entry is replaced whole by `{type, command, timeout}`, so a key the
  owner added to it (for example `statusMessage`) is lost.
- **Two small races are accepted.** An edit made between the read and
  the rename is lost (last writer wins), and `.claude` could be swapped
  for a symlink between the check and the write. Both need something
  else running in the project during the install. Node has no
  `openat`; protecting the file is e10's job.
- **The temp file's mode is not unit-tested.** The temp file is created
  with the target's mode so it is never wider than the file it
  replaces, but a test cannot see the file while it exists.
- **The file is re-printed through JSON.** Numbers that do not survive
  a round trip change (`1.50` becomes `1.5`, an integer past 2^53 loses
  digits). Unlikely in a settings file; comments and a BOM make it
  invalid JSON, which the install refuses.
- **The path is machine-specific.** A teammate who pulls the committed
  file gets an entry that points at a path they do not have. Node fails
  to start, which is exit 1, so the stop goes ahead (the e07s02
  residual). The install says so; e07s04's check finds it; e11 removes
  it.
- **The first install can re-space an existing file.** Data and key
  order are kept. Comments are not possible in JSON, so none are lost.
- **The agent can edit the entry.** It runs as the owner's command (T1).
  e10 protects the file.
- **A running session may not see the new hook.** The docs read do not
  say. The install tells the owner to start a new session; task 3
  records what the real host does.

## Verification Script (human)

1. Copy this repository to a scratch directory, for example
   `git clone . /tmp/weftwork-e07s03 && cd /tmp/weftwork-e07s03`.
2. Run `node <weftwork>/src/claude-install-cli.ts -- 'false'`. Expect
   `added` and the notes. `cat .claude/settings.json` shows the entry
   with `"timeout": 660`.
3. Run it again. Expect `unchanged`.
4. Start `claude` in the scratch directory. Accept the trust dialog if
   it appears. Run `/hooks` and see the Stop entry from project
   settings.
5. Ask Claude for a one-line reply, so it tries to stop. Expect the stop
   to be blocked, with the engine's reason ("Make that command pass").
   The host's cap of eight blocks ends the loop; press Esc to stop
   sooner.
6. Record the result, and whether a session that was already running
   before step 2 saw the hook, in `specs/verifications/e07s03-verify.yaml`.
