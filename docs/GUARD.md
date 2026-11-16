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

The local history, `history.jsonl` (`docs/HISTORY.md`), lives in the
backlog's folder but is not left writable. A file tool that writes it is
blocked by `.git/` on the protected-paths list below, from a main checkout
and from a linked worktree. A Bash command is blocked when its text names
`.git/weftwork`, but not when it builds the path another way (see "What it
does not stop"). The engine's own CLI writes it.

The guard also blocks the paths on the protected-paths list below.

## Protected paths

<!-- story: e10s01 -->

The hosts protect different paths inside the worktree, so weftwork keeps
its own list, the same in every host. Codex keeps `.git`, `.agents`,
`.codex` and `.aws` read-only; the Claude Code sandbox denies writes to
its settings files, `.claude/skills`, `.claude/hooks`, `.mcp.json`, shell
startup files and `hooks` and `config` inside `.git`
(`docs/research/R11-security-permissions.md` [S29][S26]). R11 says to keep
a portable list of `.git`, skill and agent folders, settings and hook
files and credential files, and to enforce it with a hook, not with deny
rules, because a Bash deny rule matches text only [S27].

The built-in list (`builtInProtected` in `src/guard.ts`):

| What | Patterns |
| --- | --- |
| Git internals | `.git/` |
| Host hook and settings files | `.claude/hooks/`, `.mcp.json` (Claude Code, R11 S26); `.codex/` (Codex, R11 S29); `.gemini/settings.json` (Gemini CLI, R5); `opencode.json`, `opencode.jsonc`, `.opencode/plugins/` (opencode, R5, R13); `.pi/extensions/` (pi, R13); `.kiro/hooks/` (Kiro, R13) |
| Shell startup files | `.bashrc`, `.bash_profile`, `.zshrc`, `.profile` (R11 S26) |
| Credential files | `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `id_rsa*`, `id_dsa*`, `id_ecdsa*`, `id_ed25519*`, `.npmrc`, `.netrc`, `.pypirc`, `.aws/`, `.ssh/` (R11 S29, S30) |

Each built-in entry can leave some paths writable, and the exception holds
for that entry only:

- `.env.*` leaves `.env.example`, `.env.sample` and `.env.template`
  writable, since they hold no secret. `.git/hooks/.env.example` is still
  blocked by `.git/`.
- `.git/` leaves `.git/weftwork/BACKLOG.md`, the local backlog, writable.
- `.codex/` leaves `.codex/skills/` and `.codex/agents/` writable, as the
  skill and agent folders of the other hosts are.

An exception never takes a path off the owner's list.

A pattern matches at any depth. A trailing `/` protects the whole folder.
`*` and `?` match inside one name. A file tool's path is matched from the
project root when it is inside the project, so a project kept under a
folder such as `~/.codex/worktrees/` is not protected whole. A path outside
the project is matched as a whole, so `~/.ssh/id_rsa` is protected.

Skill and agent folders (`.claude/skills/`, `.claude/agents/`,
`.claude/commands/`, `.agents/`, `.gemini/skills/`, `.codex/skills/`,
`.codex/agents/`) are not on the
built-in list. A skill is an instruction, not a limit or a hook, and
normal pull requests in a project edit them (in this repository, PR #111
renamed the skills). To protect them, the owner adds them to
`guard.protected`.

### The owner's paths

The owner adds paths with the `guard.protected` list in `weftwork.yaml`,
or in the user file `$XDG_CONFIG_HOME/weftwork/config.yaml`:

```yaml
---
guard:
  protected:
    - '.claude/skills/'
    - '.agents/'
    - 'docs/security/'
```

Each entry is a pattern as above: a relative path, with no `..`. The list
holds 1 to 100 entries. Both files add to the built-in list; no key takes
a path off it, and both files are protected themselves, so the agent cannot
shrink the list. A setting file the guard cannot use (bad YAML, an unknown
key under `guard`, a bad entry) blocks every call the guard watches, and
the reason names the file, until the owner fixes it.

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

A project can run its own copy of the engine, as this repository does,
so that each worktree runs its own `src/`:

```sh
node "$CLAUDE_PROJECT_DIR/src/guard-cli.ts"
node "$CLAUDE_PROJECT_DIR/src/claude-hook-cli.ts" -- '<declared command>'
```

The install reads these entries as registered and keeps that form. It
adds no second entry; a new declared command is written into the same
entry. Only a path after `$CLAUDE_PROJECT_DIR/` with no `"`, `$`,
backquote or backslash counts, so the shell expands nothing but the
project folder.

## Live check

`weftwork claude-live`, run in the project root, also reports the guard,
after the Stop hook. It reads the settings and Claude Code's session
transcripts only; it does not change the guard. The answer is one of:

| Answer | Meaning |
| --- | --- |
| `not registered` | No guard entry in `.claude/settings.json`, its file or the `weftwork` command is missing, or the entry was changed by hand |
| `registered, not seen` | The entry is right, and no transcript shows a guard call |
| `ran` | The newest guard event in the transcripts is a call it blocked |
| `failing` | The newest guard event is a hook error: the guard did not run, and the call went ahead. Or `weftwork` was not on PATH, and the hook blocked the call without the guard |

The guard leaves a trace only when it blocks a call or fails to run, so
`registered, not seen` is a normal answer. The check reads the three
newest transcripts in `<config dir>/projects/<project folder>/`, where
each character of the folder that is not a letter or a digit is `-`. It
does not read subagent transcripts. The agent's tool calls put text in
the transcripts too, so they are evidence, not proof. The check exits 0
only when the Stop hook is live and the guard is not `not registered` or
`failing`.

## How it decides

- **Edit, Write, MultiEdit, NotebookEdit.** The path the tool writes is
  resolved against the tool's working directory and through symlinks, then
  compared with each protected path resolved the same way. A file inside
  the engine's folder is blocked, except `BACKLOG.md`. Then the path is
  matched against the protected-paths list.
- **Bash.** The match is by the text of the command. The command is
  blocked when it holds a protected absolute path or one of these names:
  `weftwork.yaml`, `.claude/settings`, `.git/weftwork`,
  `weftwork/config.yaml`, `weftwork/state.yaml`, `ledger.jsonl`,
  `decisions.jsonl`, `override.json`, `last-call.json`,
  `claude-install-cli`. The install command is on the list because it rewrites the hook entries.
  The command is also blocked when one of its path-like words (split at
  spaces, quotes, `;`, `|`, `&`, `(`, `)`, `<`, `>`, `=` and `$`) is on the
  protected-paths list. A word that starts with the project root is matched
  from the root.
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
- The protected-paths match on Bash words gives false positives too: a
  word such as `x.key` in a `node -e` script, or `.env` in a commit
  message, blocks the command. Write the script or the message to a file
  and pass the file. `grep --exclude-dir=.git` is blocked; use `git grep`
  or the Grep tool.
- The guard protects only the paths on these lists. It does not stop a
  read of a credential file: Read is not a tool it watches.
