# The budget setting

<!-- story: e09s01 -->

The engine has two stop rules. You set their limits in a plain YAML file.

| Key | What it limits | Answer when reached | Range | Built-in |
| --- | --- | --- | --- | --- |
| `maxFailures` | Failed runs in a row of one command | `exhausted` (exit 5) | 1 to 1000 | 5 |
| `stallAfter` | Failed runs in a row on the same tree, with the same reason and exit code | `stalled` (exit 4) | 2 to 1000 | 3 |

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
```

The engine ignores other top-level keys. Later stories add them.

The engine reads both files on every run: from the engine CLI
(`node src/cli.ts`) and from the Claude Code Stop hook
(`node src/claude-hook-cli.ts`). Outside a git repository, only the user
file applies.

## Which value wins

1. The built-in value.
2. The user file overrides it.
3. The repository file overrides the user file, key by key.
4. A request value (the JSON `maxFailures` or `stallAfter` on the
   engine CLI) is used only when it is lower. An agent that writes the
   request cannot raise your limit.

## A file that cannot be used

The engine does not run and logs nothing. It does not fall back to the
built-in values. The error names the file and, where there is one, the
key. The engine CLI exits 2. The hook blocks the stop with the error as
the reason.

The engine refuses a file that:

- cannot be read, is not a regular file, or is larger than 64 KiB
  (65536 bytes)
- is not valid UTF-8, or not valid YAML (duplicate keys and more than one
  document count)
- has a top level that is not a mapping
- has a `budget` that is not a mapping (an empty `budget:` too)
- has a key under `budget` other than `maxFailures` and `stallAfter`
- has a value out of its range, or a value that is not an integer
  (`"2"` and `2.5` are refused)

An empty file, or one with only comments, sets nothing.

## Limits of this setting

- The agent can edit `weftwork.yaml`. Protecting it is a later story
  (e10, protected paths).
- There is no `timeoutMs` key. The hook sets its timeout to fit the
  host's hook deadline.
