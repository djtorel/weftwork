# Set up a project

<!-- story: e12s02 -->

The second step of backlog e12: put weftwork into a new or plain project
folder (one with no other planning system). It detects the project
(`docs/DETECT.md`), asks the owner only what detection cannot answer, shows
the full plan as a dry run, and writes only when told to. The
`setup-project` skill drives it in Claude Code.

## Run it

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
   characters (`src/setup-about.ts`).

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
| `.claude/skills/` | `full-stop`, `review-loop` and `file-pr`, with each `node src/<name>-cli.ts` rewritten to `weftwork <name>` (and `node src/cli.ts` to `weftwork engine`), and each engine doc (`docs/*.md`) and the PR template to `$(weftwork path)/<path>` |
| `.gitignore` | `.env`, `.env.*` and each stack's folders (`node_modules/`, `__pycache__/`, `.venv/`, `target/`), appended only when missing |
| `<git common dir>/weftwork/BACKLOG.md` | The local backlog, seeded with the first tasks |
| `.claude/settings.json` | With `stopHook`: the Stop hook declaring the Preflight, and the guard, as `claude-install-cli.ts` writes them; an existing file that would change is a conflict |

Commands in AGENTS.md: only those whose check ran, so each one resolves
today (H3); one that ran and failed is marked `(fails today)`. The Preflight
joins the lint, typecheck and test commands that passed. With none, the
letter says so and there is no Stop hook.

The skills call the `weftwork` command (`src/weftwork-cli.ts`, installed with
`npm link`; `docs/GETTING-STARTED.md` § 1), so they work from any project and
from a moved checkout once it is linked again. When `weftwork path` does not
print this checkout, the plan has a note. The Stop hook and the guard still
name this checkout by absolute path: a hook that cannot find `weftwork` on
the PATH of the shell Claude Code runs it in would let every stop and tool
call through, so set up again after moving the checkout.

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
