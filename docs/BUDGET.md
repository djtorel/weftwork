# The budget setting

<!-- story: e09s01, e09s02 -->

The engine has three stop rules. You set their limits in a plain YAML file.

| Key | What it limits | Answer when reached | Range | Built-in |
| --- | --- | --- | --- | --- |
| `maxFailures` | Failed runs in a row of one command | `exhausted` (exit 5) | 1 to 1000 | 5 |
| `stallAfter` | Failed runs in a row on the same tree, with the same reason and exit code | `stalled` (exit 4) | 2 to 1000 | 3 |
| `maxRuns` | Runs of any command since the last `done` (the loop ceiling) | `exhausted` (exit 5) | 1 to 1000 | off |

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
```

The engine ignores other top-level keys. Later stories add them.

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
- has a key under `budget` other than `maxFailures`, `stallAfter` and
  `maxRuns` (a long key is cut to 200 characters in the error)
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
  `done`.
- The detail names the ceiling: `3 runs since the last done, the loop
  ceiling is 3`. The state line has `maxRuns` as its threshold.
- The count reads the last 1 MiB of the ledger. When that tail holds no
  `done`, only the runs in it count.

It is off by default. Turn it on with `maxRuns` in a file.

### A ledger that cannot be read

The ledger is `.git/weftwork/ledger.jsonl`. A missing ledger is an empty
one. A ledger that exists but cannot be read (a directory, no read
permission):

- with `maxRuns` set: the loop cannot be counted, so the engine answers
  `exhausted` and does not run the command. When the ledger becomes
  unreadable during a run that is not `done`, that run answers
  `exhausted` too.
- without `maxRuns`: the stop rules are off for that call, and the
  engine writes a note to stderr. The run goes on. This is residual F5
  in `specs/security/REVIEW.md`. Set `maxRuns` to close it.

`done` never depends on the ledger. A run that passes but whose ledger
line cannot be written answers `no-ledger`, not done.

## Limits of this setting

- The agent can edit `weftwork.yaml`. Protecting it is a later story
  (e10, protected paths).
- The agent can edit the ledger. A forged `done` line opens a new loop,
  as erasing failures resets the failure ceiling (T3).
- There is no `timeoutMs` key. The hook sets its timeout to fit the
  host's hook deadline.
