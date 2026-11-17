# Set up a project

<!-- story: e12s02 -->

The second step of backlog e12: put weftwork into a new or plain project
folder (one with no other planning system). It detects the project
(`docs/DETECT.md`), asks the owner only what detection cannot answer, shows
the full plan as a dry run, and writes only when told to. The
`bootstrap` skill drives it in Claude Code.

## From the terminal: `weftwork init`

```bash
cd /path/to/project
weftwork init
```

`weftwork init [path]` is the same setup for a person: the folder is the
current one unless you name it. In a terminal it asks the five questions
below (Enter keeps the recommended answer), prints the plan, and asks
`Write these files? [y/N]` before it writes. With no terminal to ask in
(a pipe, CI) it takes the recommended answers and prints the plan only.

| Option | Meaning |
| --- | --- |
| `-y`, `--yes` | Take the recommended answers and write without asking |
| `--stop-hook` | Also register the Claude Code Stop hook and guard |
| `--no-run` | Do not run the project's commands (as `"run": false`) |
| `--overwrite <path>` | Replace this conflict; repeat for more |

It exits 0 when it wrote or you chose not to, 1 when detection, the plan or
the write is refused, and 2 for a bad option. Logic: `src/setup/init.ts`.

## Run it with JSON (agents)

```bash
echo '{"path":"/path/to/project"}' | node src/setup-cli.ts
```

| Key | Default | Meaning |
| --- | --- | --- |
| `path` | the current folder | The project folder |
| `answers` | none | The owner's answers; without them the CLI prints the questions |
| `apply` | `false` | Write the plan; needs `answers` |
| `overwrite` | `[]` | Paths of conflicts to overwrite |
| `stopHook` | `false` | Also register the Claude Code Stop hook and guard |
| `run`, `timeoutSeconds` | `true`, `120` | As for detect: check each command once |
| `undo` | `false` | Undo the recorded setup (below); takes only `path` |

**The run executes the project's own scripts**, as detect does. Pass
`"run": false` for a project you do not trust; then no command is checked,
so none is written into AGENTS.md.

It prints one JSON line and exits 0. It exits 1, with the reason on stderr,
when the plan or a write is refused (a folder on the way is a symlink, an
`overwrite` path that is not a conflict), and 2 for bad input.

## The three calls

1. **No `answers`**: `{"ok":true,"report":{...},"questions":[...]}`. Each
   question has an `id` and a `recommended` answer:

   | `id` | Answer | Becomes |
   | --- | --- | --- |
   | `about` | One line: what the project is and who it is for | AGENTS.md, About |
   | `words` | Lines of `word: meaning` | AGENTS.md, Words |
   | `never` | Lines: what the agent must never do | AGENTS.md, Rules |
   | `rules` | Lines: code rules beyond the linters | CONVENTIONS.md; none means no file |
   | `tasks` | Lines: first tasks | The local backlog |

   The recommended `about` is the folder name and the languages, then what
   the project says it is: the `description` in `package.json`, in the
   package table of `pyproject.toml` (`[project]`, `[tool.poetry]`) or
   `Cargo.toml` (`[package]`), else the first paragraph of prose in
   `README.md` (not a heading, badge, HTML, list or code), cut to 300
   characters (`src/setup/setup-about.ts`).

2. **`answers`**: `{"ok":true,"plan":{"changes":[...],"notes":[...]}}`, a
   dry run. Each change has a `path`, an `action` and a `diff` (lines marked
   ` `, `-` and `+`).
3. **`answers` and `"apply":true`**: `{"ok":true,"written":[...],"kept":[...],"notes":[...]}`.

## What it writes

| Path | What |
| --- | --- |
| `AGENTS.md` | A short letter: about, words, the commands whose check ran, the Preflight, the rules |
| `CLAUDE.md` | A symlink to `AGENTS.md` |
| `CONVENTIONS.md` | Only when the owner gives rules |
| `.claude/skills/` | `all-ready`, `all-in`, `second-opinion`, `pr-it` and `retro`, with each `node src/<name>-cli.ts` rewritten to `weftwork <name>` (and `node src/cli.ts` to `weftwork engine`), and each engine doc (`docs/*.md`) and the PR template to `$(weftwork path)/<path>` |
| `.gitignore` | `.env`, `.env.*` and each stack's folders (`node_modules/`, `__pycache__/`, `.venv/`, `target/`), appended only when missing |
| `<git common dir>/weftwork/BACKLOG.md` | The local backlog, seeded with the first tasks |
| `.claude/settings.json` | With `stopHook`: the Stop hook declaring the Preflight, and the guard, as `claude-install-cli.ts` writes them; an existing file that would change is a conflict |

Commands in AGENTS.md: only those whose check ran, so each one resolves
today (H3); one that ran and failed is marked `(fails today)`. In a
monorepo each package's commands are checked in the package's folder, and a
`## Packages` section lists, one line per package, those that resolve; a
package with none is left out. It lists at most 20 packages, in path order,
then one line that says how many more are not listed. The Preflight
joins the lint, typecheck and test commands that passed. With none, the
letter says so and there is no Stop hook.

The skills call the `weftwork` command (installed with `npm install -g
weftwork`, into the clone with `npx weftwork install`, as a dev dependency,
or `npm link` from a checkout; `docs/INSTALL.md`), so they work from any
project and from a moved checkout once it is linked again. When the
`weftwork` the project finds does not run this engine, the plan has a note.
The Stop hook and the guard run `weftwork claude-hook` and `weftwork guard`
the same way, so an npm upgrade, a moved checkout or a new Node needs no new
setup. A hook that cannot start is a non-blocking error in Claude Code, so
each entry first looks for `weftwork` (WEFTWORK_BIN, the clone's own
install, the dev dependency, PATH) and exits 2 when there is none: the stop
or the tool call is blocked with a message that says how to install it
(`docs/GUARD.md`). With the hooks, setup also writes a SessionStart entry
that gives the session's Bash commands the same lookup, so the skills find
a weftwork that is not on PATH; `weftwork init --local` writes it with or
without the Stop hook (`docs/INSTALL.md`).

A folder that is not the root of a git repository gets no backlog and no
Stop hook; a note says so.

## Re-running

Setting up again is safe. Each file is `create`, `unchanged` or
`conflict`: a file that exists and differs from what setup would write is
a conflict, shown as a diff and kept. It is written only when `overwrite`
names it, and then the old file is first moved to `<path>.weftwork-old`
(setup refuses if that exists). Nothing is deleted. `.gitignore` is only
appended to (`append`); `link` is the symlink. A file that changed between
the plan and the write is kept and listed in `kept`, `CLAUDE.md` included:
a file edited, a symlink pointed elsewhere, or a file created where the plan
saw none, even when `overwrite` names it.

The skills were renamed twice: `full-stop`, `review-loop` and `file-pr` (0.1.0)
became `weft-ready`, `weft-review` and `weft-pr`, and those, with
`weft-improve`, are now `all-ready`, `second-opinion`, `pr-it` and `retro`. Setting up again writes the new
folders and leaves the old ones, and the plan has a note that names each old
folder still there. `weftwork update` deletes an old folder you never changed.

Setting up again cannot tell a skill file you changed from one an older
weftwork wrote, so after an upgrade each changed skill is a conflict. Use
`weftwork update` for that.

## Update

```bash
weftwork upgrade          # the latest weftwork from npm
cd /path/to/project
weftwork update           # the plan; writes nothing without a yes
```

A new weftwork reaches a project in two parts. The hooks run the `weftwork`
they find and the skills read the docs under `$(weftwork path)`, so they
change as soon as the command does: `weftwork upgrade` asks npm for the latest
version and installs exactly that one (`npm install -g weftwork@<version>`;
`--check` only says whether one is out). In a project with its own install
(`docs/INSTALL.md`), it installs into the clone instead and moves the pin
in `weftwork.yaml`. The skills are copied into the
project, so they stay as they were until `weftwork update [path]` brings
them up:

| In the plan | What it means | Written? |
| --- | --- | --- |
| `update` | The file holds a text an older weftwork wrote: you never changed it | Replaced in place |
| `create` | A skill this version adds | Created |
| `delete` | A folder of an old skill name holds only a text weftwork wrote | Deleted, and the folder with it |
| `edited` | You changed the file | Kept; `weftwork init --overwrite <path>` replaces it |
| `keep-old` | A folder of an old skill name that you changed, or that holds other files | Kept |

Update knows the texts weftwork wrote by their sha256 in
`src/setup/skill-hashes.ts`: every text setup has written since the skills began
to call the `weftwork` command, so it works in a fresh clone too, with no
record of the setup. It never touches AGENTS.md, CONVENTIONS.md, the backlog
or `.claude/settings.json`. In a terminal it shows the plan and asks `Write
these changes? [y/N]`; `--yes` writes without asking; with no terminal to ask
in it shows the plan only. A file that changed between the plan and the
write is kept. It refuses a folder weftwork did not set up, and a
`.claude/skills` that is a symlink. It exits 0 when it wrote, found nothing
to do or you chose not to, 1 when it is refused, and 2 for a bad option. The
changes are ordinary edits in your working tree: review them with `git
diff` and commit them, or `git restore` them.

`weftwork claude-live` notes when the skills are behind the installed
weftwork. A checkout linked with `npm link` is not upgraded with `weftwork
upgrade`: run `git pull` there.

## Undo

Apply records each write in the engine's folder of the repository,
`<absolute git dir>/weftwork/setup-record.json` (not tracked), and
`{"undo":true}` reverses them, newest first, without detecting anything
(`src/setup/setup-undo.ts`):

```bash
echo '{"path":"/path/to/project","undo":true}' | node src/setup-cli.ts
```

- A file or symlink setup created, still as setup wrote it, is removed, and
  so is each folder it leaves empty.
- An appended file (`.gitignore`) gets its old text back. If the owner
  edited it since, and it still ends with what setup added, only those lines
  are removed.
- An overwritten file is removed and `<path>.weftwork-old` moves back.
- Anything changed since setup is kept and listed in `kept`; it stays in the
  record, so undo can run again after the owner looks.
- A recorded path that leaves the project folder, goes through a symlinked
  folder, or (for the backlog) lies outside the engine's folder in the git
  common dir is not touched, and is kept.

The record names the folder setup wrote into; undo with another `path` is
refused, and so is a new setup of another folder before the old one is
undone.

It prints `{"ok":true,"undone":[...],"kept":[...]}`, and exits 1 when there is
no record. A setup outside a git repository is not recorded; a note says so.
