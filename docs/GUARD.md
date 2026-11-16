# The guard

<!-- story: e11s01 -->

An unattended agent must not raise its own limits or turn off the hooks
that hold it. The guard is a Claude Code `PreToolUse` hook that blocks a
tool call that would change one of these:

| What | Path |
| --- | --- |
| Repository budget file | `weftwork.yaml` at the project root |
| User budget file | `$XDG_CONFIG_HOME/weftwork/config.yaml`, or `$HOME/.config/weftwork/config.yaml` |
| Project Claude Code settings | `.claude/settings.json` and `.claude/settings.local.json` |
| User Claude Code settings | `$CLAUDE_CONFIG_DIR/settings.json`, or `~/.claude/settings.json` |
| The engine's folder | `<git dir>/weftwork/`: the ledger, the decision log, the state file, the call record and `override.json` |

One file in the engine's folder stays writable: `BACKLOG.md`, the local
backlog. In a main checkout the backlog's folder is the engine's folder.

## Install

The install command registers the guard together with the Stop hook:

```bash
weftwork claude-install -- 'npm test'
```

It adds one group last in `hooks.PreToolUse` of `.claude/settings.json`,
with the matcher `Edit|Write|MultiEdit|NotebookEdit|Bash`, a 30 s timeout
and this command:

```sh
command -v weftwork >/dev/null 2>&1 || { echo 'weftwork: the weftwork command is not on PATH, so this hook cannot run. Install it: npm install -g weftwork' >&2; exit 2; }; weftwork guard
```

The Stop entry starts the same way and ends with
`weftwork claude-hook -- '<declared command>'`. Running `weftwork` from
PATH keeps the entries working after an npm upgrade, a moved checkout or a
new Node. The check in front matters: a hook that cannot start is a
non-blocking error, so without it a missing `weftwork` would let every tool
call through. With it, the call is blocked (exit 2) and the message says
what to install. A second run changes nothing. An entry an older install
wrote, `node '<file>/guard-cli.ts'` (or `.js`), is replaced; other
`PreToolUse` items stay as they are.

## How it decides

- **Edit, Write, MultiEdit, NotebookEdit.** The path the tool writes is
  resolved against the tool's working directory and through symlinks, then
  compared with each protected path resolved the same way. A file inside
  the engine's folder is blocked, except `BACKLOG.md`.
- **Bash.** The match is by the text of the command. The command is
  blocked when it holds a protected absolute path or one of these names:
  `weftwork.yaml`, `.claude/settings`, `.git/weftwork`,
  `weftwork/config.yaml`, `weftwork/state.yaml`, `ledger.jsonl`,
  `decisions.jsonl`, `override.json`, `last-call.json`,
  `claude-install-cli`. The install command is on the list because it rewrites the hook entries.
- **Any other tool** is allowed. An input the guard cannot read is blocked.

A block exits 2, and Claude Code shows the agent the reason. Exit 2 blocks
in every permission mode, `bypassPermissions` too (Claude Code hooks docs,
read 2026-11-15). Every block adds one line to the ledger:

```json
{"at":"2026-11-15T12:00:00.000Z","guard":"blocked","tool":"Write","target":"/repo/weftwork.yaml"}
```

The stop rules and the counts do not read guard lines.

## Ask triggers

<!-- story: e11s04 -->

In a git worktree the guard also blocks the two mechanical ask triggers:
a file tool that writes outside the worktree, and a Bash `git push` that
would update `main`, `master` or the remote's default branch. `docs/ASK.md` says how they decide and
what they do not see.

## The engine still writes

The engine's own CLIs (`state-cli.ts`, `handoff-cli.ts`, the Stop hook)
write these files from their own process. No tool call names the path, so
the guard does not see them.

## What it does not stop

The Bash match is a known partial guard. It reads text, not intent:

- A command can build a path the text does not show: a variable, a glob,
  `cd .git && ...`, a script file the agent wrote first, or another
  program that writes the file.
- A command that only reads or mentions a protected path is blocked too.
  Use the Read tool to read the file. To put the path in a commit message
  or a pull request body, write the text to a file and pass the file.
- A missing `weftwork` command blocks (see Install), but a crash after it
  starts and before the guard's code runs (a Node that is too old, a
  broken install) is a non-blocking error, and the call goes ahead.
- The entries run whatever `weftwork` comes first on the PATH Claude Code
  gives hooks. A program that can write a `weftwork` into an earlier PATH
  folder, or replace the installed package's files, can replace the guard.
  Both are outside the project: in a git worktree the guard blocks a file
  tool that writes outside it (`docs/ASK.md`), but not a Bash command that
  does.
- The guard protects only these paths. A protected-paths list beyond the
  engine's own files is backlog item e10.
