# The budget setting

<!-- story: e09s01, e09s02, e09s03, e09s04 -->

The engine has three stop rules and a handover reserve. You set them in a
plain YAML file, with the time limit of the Claude Code Stop hook's command
(The Stop hook's time limit, below).

| Key | What it limits | Answer when reached | Range | Built-in |
| --- | --- | --- | --- | --- |
| `max_failures` | Failed runs in a row of one command | `exhausted` (exit 5) | 1 to 1000 | 5 |
| `stall_after` | Failed runs in a row on the same tree, with the same reason and exit code | `stalled` (exit 4) | 2 to 1000 | 3 |
| `max_runs` | Runs of any command since the last `done` (the loop ceiling) | `exhausted` (exit 5) | 1 to 1000 | off |
| `reserve_runs` | Runs left under `max_runs` when the agent is told to write the handoff | `failed` (exit 1) with a `detail` | 0 to 1000 | 1 when `max_runs` is set |
| `stop_hook_timeout_seconds` | Seconds the Claude Code Stop hook lets the declared command run | `failed` (exit 2 on the hook), reason `timeout` | 60 to 86400 | 1800 |

The file keys are snake_case, as in every other setting. The engine's JSON
request and its `budget` answer name the same limits in camelCase:
`maxFailures`, `stallAfter` and `maxRuns`. Before 0.2.0 the file keys were
camelCase too; a file that still uses one is refused with an error that
names the new key.

## The files

| File | Where | Symlink |
| --- | --- | --- |
| Repository | `weftwork.yaml` at the repository root | Refused |
| User | `$XDG_CONFIG_HOME/weftwork/config.yaml`, or `$HOME/.config/weftwork/config.yaml` when `XDG_CONFIG_HOME` is unset, empty or not absolute | Followed |

Both files hold a top-level `budget` mapping:

```yaml
---
budget:
  max_failures: 3
  stall_after: 2
  max_runs: 40
  reserve_runs: 2
  stop_hook_timeout_seconds: 2400
```

The engine ignores other top-level keys here. The `review` key sets the
reviewers (`docs/REVIEW.md`), and `history` turns the local history on
(`docs/HISTORY.md`).

The engine reads both files on every run: from the engine CLI
(`node src/cli.ts`) and from the Claude Code Stop hook
(`node src/claude-hook-cli.ts`). Outside a git repository there is no
repository file, and the engine runs no command there either: it cannot
fingerprint the tree, so it answers `no-tree` (not done).

## Which value wins

1. The built-in value.
2. The user file overrides it.
3. The repository file overrides the user file, key by key.
4. A request value (the JSON `maxFailures`, `stallAfter` or `maxRuns` on
   the engine CLI) is used only when it is lower. An agent that writes
   the request cannot raise your limit. The loop ceiling has no built-in
   value, so when no file sets `max_runs`, any request `maxRuns` is lower
   and turns the loop ceiling on. A request can never turn it off.
5. The reserve is not a request key. Only the files set it, with
   `reserve_runs`, so the agent cannot turn the handover warning off
   through the request. A `reserveRuns` in the request JSON is ignored. A
   lower request `maxRuns` moves the reserve window with the ceiling; that
   only lets the agent stop sooner.

## A file that cannot be used

The engine does not run and logs nothing. It does not fall back to the
built-in values. The error names the file and, where there is one, the
key. The engine CLI exits 2. The hook lets the stop go ahead as not done
(`blocked`), with the error in its message to you. It does not block:
the agent cannot fix a setting file, because the guard protects both
files, so a block would only repeat at every stop. Claude Code's own cap
on repeated blocks resets each time the agent calls a tool, so it does
not end that loop. Not done is never done: the gate makes no false claim.

The engine refuses a file that:

- cannot be read, is not a regular file, or is larger than 64 KiB
  (65536 bytes)
- is not valid UTF-8, or not valid YAML (duplicate keys and more than one
  document count); the error is the first line of the YAML error, with its
  line and column where the YAML parser gives one (an unresolved alias has
  none), cut to 200 characters
- declares a YAML version other than 1.2 (`%YAML 1.0`, `1.1`, `2.0`), more
  than one `%YAML` line, or a directive other than `%YAML` and `%TAG`
- uses a tag the YAML parser cannot resolve (`!custom`, `!!seq` on a
  mapping, `!foo 2`, and a tag made with a `%TAG` handle too)
- has a top level that is not a plain mapping
- has a `budget` that is not a plain mapping (an empty `budget:`, a
  `!!set` and an `!!omap` too)
- has a key under `budget` other than `max_failures`, `stall_after`,
  `max_runs`, `reserve_runs` and `stop_hook_timeout_seconds` (a long key is
  cut to 200 characters in the error); a camelCase key from before 0.2.0, such as `maxRuns`, is refused
  with `budget.maxRuns was renamed to budget.max_runs; rename the key`
- has a value out of its range, or a value that is not an integer
  (an untagged `"2"` and `2.5` are refused; a plain YAML 1.2 number that is whole,
  such as `2.0` or `0x2`, counts as that number)

An empty file, or one with only comments, sets nothing.

## The loop ceiling

`max_failures` counts the failures of one exact command, so an agent that
changes the command, or passes another one, starts again from zero.
`max_runs` counts every run of any command since the last `done` run of any
command, or since the start of the ledger when there is none. Each `done`
opens a new loop.

- Before a run: when the count is `max_runs` or more, the engine answers
  `exhausted` (exit 5) and does not run the command, even one that would
  pass. The failure ceiling is checked first.
- After a run: when the run is not `done` and not `killed`, and the count
  is `max_runs` or more, the answer is `exhausted`. A run that passes is
  `done`, unless its ledger line cannot be written (see A loop that
  cannot be counted).
- The detail names the ceiling: `3 runs since the last done, the loop
  ceiling is 3`. The state line has the loop ceiling as its threshold. Its
  `runs` and `failStreak` fields count the one command of that call, not
  the loop; only the detail gives the loop count.
- A `blocked` answer and a refused call add no run. An `overridden` run
  is one run, as the failed run it is.

It is off by default. Turn it on with `max_runs` in a file.

### How the loop ceiling is reset

At the ceiling the engine refuses every call before it runs, even a command
that would pass, so no new `done` can open a new loop. The answer stays
`exhausted` until you change something:

- raise or remove `max_runs` in the setting file, or
- move the ledger aside, for example
  `mv .git/weftwork/ledger.jsonl .git/weftwork/ledger.old.jsonl`. The
  engine then starts a new, empty ledger.

The agent can also do the second one, since it can delete the ledger (T3,
under Limits of this setting).

### A loop that cannot be counted

The ledger is `.git/weftwork/ledger.jsonl`. A missing ledger is an empty
one. The count reads the last 1 MiB of the ledger. With `max_runs` set,
the engine answers `exhausted` when it cannot count the loop:

| Case | When it is checked | Detail starts with |
| --- | --- | --- |
| The ledger exists but cannot be read (a directory, no read permission, a FIFO) | Before the run (the command does not run) and after it | `the ledger cannot be read` |
| The run's ledger line cannot be written (a read-only ledger, a full disk) | After the run | `the run could not be written to the ledger` |
| The 1 MiB tail was cut and holds no `done` (very long commands, junk lines), and the runs in it are fewer than `max_runs` | Before the run (the command does not run) and after it | `the ledger tail was cut with no done in it` |

After a run, these cases apply only to a run that is not `done` and not
`killed`. A `killed` run answers `killed`.

Without `max_runs`, these cases change nothing: the stop rules are off for
a call whose ledger cannot be read, and the engine writes a note to
stderr. This is residual F5 in `docs/security/REVIEW.md`. Set `max_runs`
to close it.

`done` is never read from the ledger. It comes only from running the
command. A run that passes but whose ledger line cannot be written is not
done: its reason is `no-ledger`. Without `max_runs` it answers `failed`
(exit 1). With `max_runs` set it answers `exhausted` (exit 5), on purpose:
every later pass would also be `no-ledger`, so `failed` would make the
Claude Code hook block the stop again and again, and the loop would never
end.

Outside a git repository there is no ledger and no count. The engine runs
no command there: it answers `no-tree` (not done).

## The handover reserve

At the loop ceiling the answer is `exhausted`, and the Claude Code hook lets
the stop go ahead. The agent then has no turn left to write a handoff. The
reserve warns it first.

With `max_runs` set, after a run that answers `failed`, the engine counts the
runs since the last `done` (this run included) and the runs left before the
ceiling. When the runs left are more than 0 and no more than the reserve, the
answer has a `detail`:

```text
3 runs since the last done, 1 left before the loop ceiling of 4: write the handoff now with node "/path/to/weftwork/src/handoff-cli.ts" (JSON on stdin: next_skill, branch, note)
```

The path is the absolute path of `src/handoff-cli.ts` in the weftwork
checkout (`dist/handoff-cli.js` in the npm package), in double quotes, so it pastes from any directory and from a
checkout path with spaces. A checkout path with `$`, a backtick or `!` does
not paste as is, since the shell expands those inside double quotes. The
handoff CLI reads one JSON object on stdin with `next_skill`, `branch` and
`note` (docs/STATE.md). It writes the state file of the worktree it runs in,
`<git dir>/weftwork/state.yaml`, and creates the file when it is missing. The Claude Code
hook adds the detail as the last line of the reason with which it blocks the
stop. The exit code stays 1 on the engine CLI and 2 on the hook. The answer
is `failed`, not a new state, and it writes no state line.

- The reserve is `reserve_runs`, or 1 when no file sets it. The engine uses
  at most `max_runs - 1`, so `max_runs: 1` has no reserve, and a large
  `reserve_runs` warns from the first run of the loop. No mix of files is an
  error.
- `reserve_runs: 0` turns the warning off.
- Without `max_runs` there is no reserve, and no answer changes.
- Only a `failed` answer carries the warning. A run in the window that
  answers `killed`, or a failed run that takes the owner's override record
  (`overridden`), still counts and uses up that run's warning. With the
  default reserve of 1 the agent then gets no warning; set `reserve_runs: 2`
  or more for a second chance.
- The reserve applies only to the loop ceiling. The failure ceiling
  (`max_failures`) and the stall rule still end the loop with no warning.
- At the ceiling the answer is `exhausted`, as before. The engine does not
  check that the agent wrote the handoff.

## The Stop hook's time limit

The Claude Code Stop hook runs the declared command for at most
`stop_hook_timeout_seconds`, 1800 s (30 minutes) when no file sets it.
Before 0.7.0 the limit was a fixed 600 s, which a long check such as
`make lint && make test` on a shared machine could not meet: the hook then
answered `not done (failed, timeout)` at every stop and never recorded a
pass to reuse. To change it, the owner sets the key in `weftwork.yaml` (or
in the user file) and writes the new timeout into the hook entry:

```bash
weftwork update --yes      # or: weftwork claude-install -- '<declared command>'
```

How it fits the host's timeout:

- Claude Code cancels a hook that runs past the entry's `timeout` and lets
  the stop go ahead with no decision (hooks docs, read 2026-11-26). The
  install therefore writes `timeout` as the limit plus 60 s (1860 for the
  default), as it wrote 660 for the old 600 s. The docs set no upper bound
  on a command hook's `timeout`; the 86400 s cap here only keeps the value
  sane.
- The hook stops waiting by itself 15 s before the host's timeout, so a hang
  it cannot abort still ends in its own block.
- An entry whose `timeout` is too short for the setting, such as the 660 an
  older weftwork wrote, still blocks: the hook reads the entry from
  `.claude/settings.json` and `.claude/settings.local.json` and lowers the
  limit to fit it (660 gives 600 s, as before). The timeout message then
  names the entry and the repair. `weftwork claude-install` writes the full
  entry, `weftwork update` raises only the timeout of each weftwork Stop
  entry that is too short, and `weftwork claude-live` warns about such an
  entry, with both commands.
- The agent cannot raise its own limit. The hook takes no request from it,
  and the guard protects both setting files and `.claude/settings.json`
  (`docs/GUARD.md`). A `timeoutMs` in a request to the engine CLI is the
  CLI's own limit and does not change the hook's.
- A command that runs past the limit is killed with its process group, and
  the hook blocks: `The command ran past the 1800 s limit.
  budget.stop_hook_timeout_seconds in weftwork.yaml sets it`. The setting
  changes how long the command may run, not what counts as done: the done
  gate and the reused pass are as before.

## The budget report

Every engine answer, done or not, has a `budget` object. It is on even when
no stop rule is on, since an agent that cannot see the count guesses the
budget it has left too high (R15). It is a report: it never changes a
verdict.

```json
{"state":"failed", "...": "...", "budget":{"runs":2,"maxRuns":null,"failures":2,"maxFailures":5}}
```

| Field | What it counts |
| --- | --- |
| `runs` | Runs of any command since the last `done`: the count of the loop ceiling. A `done` answer opens a new loop, so it shows 0. |
| `maxRuns` | The loop ceiling in force, or `null` when it is off. |
| `failures` | Failed runs in a row of this command: the count of the failure ceiling. |
| `maxFailures` | The failure ceiling in force. |

The counts come from the same ledger read that decided the answer: before
the run for a refused call (`exhausted` before the run, `blocked`), so it
adds no run, and after the run otherwise. They count the lines in the 1 MiB
tail the engine reads, so a cut tail can show fewer. `runs` and `failures`
are `null` when the ledger cannot be read, and outside a git repository,
where there is no ledger. They are never 0 for a count that was not made.

### Tokens in Claude Code

The Claude Code hook adds the session's token use: input, output, cache
read and cache write, summed from the transcript file that the host names
in `transcript_path` of the Stop input. Each assistant message counts once,
since the host writes one message streamed in parts as several lines with
the same id. There are no dollars: a price table per model goes stale.
The PR proof shows the same counts when it is given the transcript path
(`docs/PR-PROOF.md`, Tokens).

The hook shows one line:

```text
budget: 2 runs in this loop (no ceiling), 2 failed in a row (ceiling 5), tokens 7 input, 222 output, 74918 cache read, 22705 cache write
```

| Answer | Where the line goes |
| --- | --- |
| `failed` (the stop is blocked) | The second line of the reason on stderr, which the agent reads. A handover detail stays the last line. |
| `done` | The `systemMessage` on stdout: `weftwork: done. budget: ...`, or `weftwork: done, reused the pass of <time> on this tree. budget: ...` for a reused pass |
| Any other state | The second line of the `systemMessage` warning. |

The `systemMessage` is shown to the user, not to the agent (Claude Code hooks
docs, JSON output, read 2026-11-15). After an allowed stop the agent has no
turn left, so the user is the reader.

The tokens are `not counted`, with the reason, when the Stop input has no
`transcript_path`, the path is not absolute, there is no file there, or the
file is not a regular file (a symlink is not followed), is larger than
64 MiB (67108864 bytes) or is not valid UTF-8. The answer is the same
either way. Lines that are not JSON, such as a last line the host has not
finished writing, are skipped. That last line can end inside a multi-byte
character; the file is then still read, and only that line is skipped. The host writes the transcript while the
session runs, so the last turn can be missing from the count.

### A reused pass

The Stop hook runs at every stop. When the tree has not changed since its
own last pass, it does not run the command again. It allows the stop and
says `reused the pass of <time> on this tree`. All of these must be true:

- The last run of the exact command string in the ledger is `done`.
- No stop state other than `done` follows that run (the PR proof's rule,
  `docs/PR-PROOF.md`).
- The run saw the tree as it is now: the fingerprint of the tracked and
  the untracked, not ignored, files is the same.
- The Stop hook itself ran that pass, in the same project directory and
  the same environment. The run line keeps `hookKey`, a SHA-256 of the
  directory and every environment variable. A pass from the engine CLI has
  no key and is never reused: the agent sets its environment and its
  `cwd`. A hook call the agent starts itself, such as with a fake check
  first on `PATH`, has another environment, so its pass is not reused
  either.

Any doubt runs the command as before: no ledger, a ledger or a tree that
cannot be read, a changed file, another command, a later failure, or a
change to any environment variable of the hook. The
stop rules still answer first: a ceiling that is reached answers
`exhausted`, not the reused pass.

A reused pass is not a run. It writes no line, so `runs` and `failures`
stay as the ledger has them, and the budget line counts from the ledger as
read before the check. The engine CLI never reuses a pass: it runs the
command every time.

The fingerprint does not cover ignored files (such as `node_modules` or
build output), the git `HEAD`, or anything outside the tree. A change there
alone does not run the command again.

## Limits of this setting

- The guard blocks the agent's edits to `weftwork.yaml` and to the user
  file (`docs/GUARD.md`), so it cannot set `reserve_runs: 0` or raise
  `max_runs` there. Where the guard does not run (another host, or hooks
  turned off), it can.
- The agent can edit or delete the ledger. A forged `done` line, or a
  deleted ledger, opens a new loop, as erasing failures resets the
  failure ceiling (T3, e10). A forged pass line with the current
  fingerprint and `hookKey`, or a hook call with the host's exact
  environment rebuilt on purpose, also lets the Stop hook allow a stop
  without a run (A reused pass), so the stop is as strong as the guard that protects
  the ledger (`docs/GUARD.md`), as the PR proof is.
- Any `done` opens a new loop, whatever its command. On the engine CLI the
  agent writes the request, so it can send a command that passes, such as
  `true`, between failures and start the count again. This is the same
  limit as T1: on the CLI the agent picks the command, so the engine cannot
  judge whether it is a good check. Through the Claude Code hook you fix
  the command, so the agent cannot do this.
- Calls that run at the same time are checked at the same time. On the
  engine CLI, several calls made together just under the ceiling can all
  run before any of them is counted; each then answers `exhausted`. The
  Claude Code hook runs one call at a time, so it is not affected. On the
  CLI the agent picks the command anyway (T1).
- There is no `timeoutMs` key. The engine CLI's limit is the request's
  `timeoutMs`; the Stop hook's is `stop_hook_timeout_seconds` (The Stop
  hook's time limit). A file can only lower the limit of a hook entry
  whose `timeout` is shorter, never make the host wait longer than the
  entry says.
