# The budget setting

<!-- story: e09s01, e09s02, e09s03, e09s04 -->

The engine has three stop rules and a handover reserve. You set them in a
plain YAML file.

| Key | What it limits | Answer when reached | Range | Built-in |
| --- | --- | --- | --- | --- |
| `maxFailures` | Failed runs in a row of one command | `exhausted` (exit 5) | 1 to 1000 | 5 |
| `stallAfter` | Failed runs in a row on the same tree, with the same reason and exit code | `stalled` (exit 4) | 2 to 1000 | 3 |
| `maxRuns` | Runs of any command since the last `done` (the loop ceiling) | `exhausted` (exit 5) | 1 to 1000 | off |
| `reserveRuns` | Runs left under `maxRuns` when the agent is told to write the handoff | `failed` (exit 1) with a `detail` | 0 to 1000 | 1 when `maxRuns` is set |

## The files

| File | Where | Symlink |
| --- | --- | --- |
| Repository | `weftwork.yaml` at the repository root | Refused |
| User | `$XDG_CONFIG_HOME/weftwork/config.yaml`, or `$HOME/.config/weftwork/config.yaml` when `XDG_CONFIG_HOME` is unset, empty or not absolute | Followed |

Both files hold a top-level `budget` mapping:

```yaml
---
budget:
  maxFailures: 3
  stallAfter: 2
  maxRuns: 40
  reserveRuns: 2
```

The engine ignores other top-level keys here. The `review` key sets the
review council (`docs/REVIEW.md`).

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
   the request cannot raise your limit. `maxRuns` has no built-in value,
   so when no file sets it, any request value is lower and turns the
   loop ceiling on. A request can never turn it off.
5. `reserveRuns` is not a request key. Only the files set it, so the agent
   cannot turn the handover warning off through the request. A
   `reserveRuns` in the request JSON is ignored. A lower request `maxRuns`
   moves the reserve window with the ceiling; that only lets the agent
   stop sooner.

## A file that cannot be used

The engine does not run and logs nothing. It does not fall back to the
built-in values. The error names the file and, where there is one, the
key. The engine CLI exits 2. The hook blocks the stop with the error as
the reason.

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
- has a key under `budget` other than `maxFailures`, `stallAfter`,
  `maxRuns` and `reserveRuns` (a long key is cut to 200 characters in the
  error)
- has a value out of its range, or a value that is not an integer
  (an untagged `"2"` and `2.5` are refused; a plain YAML 1.2 number that is whole,
  such as `2.0` or `0x2`, counts as that number)

An empty file, or one with only comments, sets nothing.

## The loop ceiling

`maxFailures` counts the failures of one exact command, so an agent that
changes the command, or passes another one, starts again from zero.
`maxRuns` counts every run of any command since the last `done` run of any
command, or since the start of the ledger when there is none. Each `done`
opens a new loop.

- Before a run: when the count is `maxRuns` or more, the engine answers
  `exhausted` (exit 5) and does not run the command, even one that would
  pass. The failure ceiling is checked first.
- After a run: when the run is not `done` and not `killed`, and the count
  is `maxRuns` or more, the answer is `exhausted`. A run that passes is
  `done`, unless its ledger line cannot be written (see A loop that
  cannot be counted).
- The detail names the ceiling: `3 runs since the last done, the loop
  ceiling is 3`. The state line has `maxRuns` as its threshold. Its
  `runs` and `failStreak` fields count the one command of that call, not
  the loop; only the detail gives the loop count.
- A `blocked` answer and a refused call add no run. An `overridden` run
  is one run, as the failed run it is.

It is off by default. Turn it on with `maxRuns` in a file.

### How the loop ceiling is reset

At the ceiling the engine refuses every call before it runs, even a command
that would pass, so no new `done` can open a new loop. The answer stays
`exhausted` until you change something:

- raise or remove `maxRuns` in the setting file, or
- move the ledger aside, for example
  `mv .git/weftwork/ledger.jsonl .git/weftwork/ledger.old.jsonl`. The
  engine then starts a new, empty ledger.

The agent can also do the second one, since it can delete the ledger (T3,
under Limits of this setting).

### A loop that cannot be counted

The ledger is `.git/weftwork/ledger.jsonl`. A missing ledger is an empty
one. The count reads the last 1 MiB of the ledger. With `maxRuns` set,
the engine answers `exhausted` when it cannot count the loop:

| Case | When it is checked | Detail starts with |
| --- | --- | --- |
| The ledger exists but cannot be read (a directory, no read permission, a FIFO) | Before the run (the command does not run) and after it | `the ledger cannot be read` |
| The run's ledger line cannot be written (a read-only ledger, a full disk) | After the run | `the run could not be written to the ledger` |
| The 1 MiB tail was cut and holds no `done` (very long commands, junk lines), and the runs in it are fewer than `maxRuns` | Before the run (the command does not run) and after it | `the ledger tail was cut with no done in it` |

After a run, these cases apply only to a run that is not `done` and not
`killed`. A `killed` run answers `killed`.

Without `maxRuns`, these cases change nothing: the stop rules are off for
a call whose ledger cannot be read, and the engine writes a note to
stderr. This is residual F5 in `docs/security/REVIEW.md`. Set `maxRuns`
to close it.

`done` is never read from the ledger. It comes only from running the
command. A run that passes but whose ledger line cannot be written is not
done: its reason is `no-ledger`. Without `maxRuns` it answers `failed`
(exit 1). With `maxRuns` set it answers `exhausted` (exit 5), on purpose:
every later pass would also be `no-ledger`, so `failed` would make the
Claude Code hook block the stop again and again, and the loop would never
end.

Outside a git repository there is no ledger and no count. The engine runs
no command there: it answers `no-tree` (not done).

## The handover reserve

At the loop ceiling the answer is `exhausted`, and the Claude Code hook lets
the stop go ahead. The agent then has no turn left to write a handoff. The
reserve warns it first.

With `maxRuns` set, after a run that answers `failed`, the engine counts the
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

- The reserve is `reserveRuns`, or 1 when no file sets it. The engine uses
  at most `maxRuns - 1`, so `maxRuns: 1` has no reserve, and a large
  `reserveRuns` warns from the first run of the loop. No mix of files is an
  error.
- `reserveRuns: 0` turns the warning off.
- Without `maxRuns` there is no reserve, and no answer changes.
- Only a `failed` answer carries the warning. A run in the window that
  answers `killed`, or a failed run that takes the owner's override record
  (`overridden`), still counts and uses up that run's warning. With the
  default reserve of 1 the agent then gets no warning; set `reserveRuns: 2`
  or more for a second chance.
- The reserve applies only to the loop ceiling. The failure ceiling
  (`maxFailures`) and the stall rule still end the loop with no warning.
- At the ceiling the answer is `exhausted`, as before. The engine does not
  check that the agent wrote the handoff.

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

The hook shows one line:

```text
budget: 2 runs in this loop (no ceiling), 2 failed in a row (ceiling 5), tokens 7 input, 222 output, 74918 cache read, 22705 cache write
```

| Answer | Where the line goes |
| --- | --- |
| `failed` (the stop is blocked) | The second line of the reason on stderr, which the agent reads. A handover detail stays the last line. |
| `done` | The `systemMessage` on stdout: `weftwork: done. budget: ...` |
| Any other state | The second line of the `systemMessage` warning. |

The `systemMessage` is shown to the user, not to the agent (Claude Code hooks
docs, JSON output, read 2026-11-15). After an allowed stop the agent has no
turn left, so the user is the reader.

The tokens are `not counted`, with the reason, when the Stop input has no
`transcript_path`, the path is not absolute, there is no file there, or the
file is not a regular file (a symlink is not followed), is larger than
64 MiB (67108864 bytes) or is not valid UTF-8. The answer is the same
either way. Lines that are not JSON, such as a last line the host has not
finished writing, are skipped. The host writes the transcript while the
session runs, so the last turn can be missing from the count.

## Limits of this setting

- The agent can edit `weftwork.yaml`. Protecting it is a later story
  (e10, protected paths). The agent can set `reserveRuns: 0` there, as it
  can raise `maxRuns`.
- The agent can edit or delete the ledger. A forged `done` line, or a
  deleted ledger, opens a new loop, as erasing failures resets the
  failure ceiling (T3, e10).
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
- There is no `timeoutMs` key. The hook sets its timeout to fit the
  host's hook deadline.
