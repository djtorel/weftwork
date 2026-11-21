# UI changes checked from screenshots

<!-- story: e11s05, e11s06, e11s07 -->

A change to the UI is reviewed from screenshots as well as from the diff.
The engine runs the owner's screenshot command, keeps the PNG files it
wrote, and the reviewers read them under the same must-fix rule as
the code (`docs/REVIEW.md`). The reviewers review the change as a design
audit, against the project's design reference when one is set. A model's
score is reported, never a gate.

## The setting

A `ui` mapping in the same two files as the budget (`docs/BUDGET.md`):
`weftwork.yaml` at the repository root wins over the user file, key by key.
With no `ui` mapping in either file, UI checks are off.

```yaml
---
ui:
  screenshot: npx playwright test e2e/screenshots.spec.ts
  paths:
    - 'web/**'
    - '**/*.css'
  timeout_seconds: 600
  max_shots: 50
  design: DESIGN.md
```

| Key | What it is | Range | Built-in |
| --- | --- | --- | --- |
| `screenshot` | A command that writes PNG files into the folder named by `$WEFTWORK_SHOTS` | a non-empty command | none |
| `paths` | Glob patterns from the repository root (`path.matchesGlob`); a change that touches one is a UI change | 1 to 50 | none |
| `timeout_seconds` | Time for the screenshot command | 1 to 3600 | 600 |
| `max_shots` | The most PNG files one phase may write. Every reviewer reads each before and after screenshot, so more shots cost more review time and tokens. `WEFTWORK_IMAGES` holds all their paths, and Linux allows one variable 128 KiB: at the ceiling, a path longer than about 320 bytes makes a reviewer fail to start | 1 to 200 | 50 |
| `design` | The design reference: a path from the repository root to a file of colours, type, spacing and component rules (a DESIGN.md; bigpowers `extract-design` can make one) | a path inside the repository | none |

`screenshot` and `paths` go together: a file that leaves one unset is an
error. The guard blocks the agent from editing either setting file
(`docs/GUARD.md`).

## Taking screenshots

```bash
echo '{"phase":"before"}' | node src/ui-cli.ts
echo '{"phase":"after"}' | node src/ui-cli.ts
```

`base` is optional in both: the commit the change is measured from. By
default it is the merge base of HEAD with `origin/HEAD`, `origin/main` or
`main`, the first that exists.

When `ui.design` is set, the engine first checks that file under the rules
of the review (below). A file that is missing or cannot be used stops it
with exit 2 before the command runs, so a bad path fails here and not at
review time.

The engine empties `<git dir>/weftwork/ui/<phase>/`, runs `screenshot` in
the working tree with `WEFTWORK_SHOTS` set to that folder, and checks what
it wrote: at least one and at most `ui.max_shots` `.png` files, each with the PNG
signature and at most 20 MiB. It keeps a manifest with each file's size and
SHA-256, the branch, the base commit, and the fingerprint of the tree they show.

| Exit | First line | Meaning |
| --- | --- | --- |
| 0 | `weftwork ui: taken` | The screenshots are kept; one line each, with its path and hash |
| 0 | `weftwork ui: off` | No `ui` mapping; nothing ran |
| 1 | `weftwork ui: refused` | Before screenshots, but the tree already changes `ui.paths`, so they would show the change. The command does not run. |
| 1 | `weftwork ui: failed` | The command failed or timed out, wrote no PNG or more than `ui.max_shots`, wrote a file that is not one, or changed the tree |
| 2 | none | Bad input, no git working tree, a bad setting file, a `ui.design` file the review cannot use; the reason is on stderr |

Take the before screenshots before the first edit to a UI file, and the
after ones once the done gate passed on the final tree.

Name each screenshot by screen, viewport and state, so a reviewer knows what
it shows: `<screen>.<viewport>.<state>.png`, for example `home.mobile.png`,
`home.desktop.png` or `login.mobile.error.png`. Take the viewports the
project supports and the states the change touches. A name may not hold a
comma, since `WEFTWORK_IMAGES` joins the paths with commas.

## In the review

When `ui` is set and the change from the base touches `ui.paths`, the review
needs after screenshots of this branch and this exact tree. Without them it
answers `weftwork review: not run` (exit 4) and no reviewer runs. With them,
the engine adds the screenshot paths to the brief, before and after, and
asks each reviewer to open them. A reviewer may reply with one
`UI-SCORE: <0 to 10>` line. The report shows each score as
`ui score (<reviewer>): <n> of 10, reported, not a gate`, and lists every
screenshot with its path and hash, so the pull request shows them when the
report is pasted in. Only a must-fix blocks.

Before screenshots are optional in the review. When none were taken on this
branch and base, the brief says so and the reviewers read the after ones alone.

Before it hands the screenshots to the reviewers, the review reads each PNG
file again and checks its size and SHA-256 against the manifest. When a file
is gone or changed, it answers `weftwork review: not run` (exit 4), names the
file, and no reviewer runs. Take the after screenshots again. For a before
screenshot, take them again on the base tree, or remove the before folder to
review without them.

### The design audit

The brief for a UI change also holds a design checklist and a severity rule
(e11s06). The checklist: consistency with the design reference and the
existing screens; hierarchy; spacing and alignment; typography; colour and
contrast; states (hover, focus, disabled, error, empty, loading).

A design finding is MUST-FIX only for an objective break: the change breaks
the design reference, text fails WCAG 2 AA contrast, or the layout is broken
at a viewport the screenshots show. A judgement call is SHOULD-FIX: it is
listed in the pull request and does not block.

A design MUST-FIX names its evidence: the rule of the design reference and
the value that breaks it, the two colours and their ratio, or the screenshot
and the element that is broken. A contrast or exact-colour finding seen only
in a screenshot is SHOULD-FIX, and names the programmatic check that would
settle it, since a vision model does not measure colour from pixels
reliably (e11s07, `docs/research/R18-vision-design-judging.md`).

When `ui.design` is set, the engine reads that file and puts it in the brief
between two marker lines. It must be a regular file (not a symlink), inside
the repository once its folders are resolved, valid UTF-8, at most 64 KiB. A file that is missing or cannot be used stops the
review with exit 2, and no reviewer runs; `ui-cli` checks the same file
before it takes screenshots. Without `ui.design`, the brief says
there is no design reference, and the reviewers judge consistency against the
existing screens.

### The images

For a UI change, each reviewer runs with `WEFTWORK_IMAGES` set to the
absolute paths of the screenshots, before then after, joined by commas, and
`WEFTWORK_IMAGES_DIR` set to the folder that holds them. These are copies
in a new private folder in the system's temporary folder, outside the git
dir, removed after the round: Claude Code 2.1.329 does not read a file
under `.git` in `dontAsk` mode, even in an added folder with an allow rule
(checked by hand on 2026-11-21: the same screenshot was read from a folder
outside `.git` and refused inside it). The brief names the copies; the
report and the PR name the screenshots in `<git dir>/weftwork/ui/`. A reviewer that can attach images uses
`WEFTWORK_IMAGES`, so the model gets the images and not only their paths.
The built-in Codex reviewer does this:

```bash
codex exec --ignore-user-config --sandbox read-only --ephemeral ${WEFTWORK_IMAGES:+--image "$WEFTWORK_IMAGES"} -
```

`${WEFTWORK_IMAGES:+...}` adds `--image` only for a UI change. Write a
`reviewers` entry in `weftwork.yaml` the same way. For a change that is not a UI
change, neither variable is set, even when the caller had set it. A
screenshot path with a comma of its own (in the git directory's path, say)
stops the review with exit 2.

### Claude Code, Antigravity and Gemini CLI reviewers

Neither `claude -p`, `agy -p` nor `gemini -p` has a flag that attaches an
image. Each has a file tool that reads an image and gives it to the model,
and the brief tells each reviewer to open each screenshot. The screenshots
are outside the working tree in a git worktree, so the entry adds their
folder for a UI change only. The first two lines are built-in reviewers
(`docs/REVIEW.md` § The built-in reviewers):

```bash
claude -p --model opus --effort high --setting-sources "" --tools Read,Grep,Glob,Bash --permission-mode dontAsk ${WEFTWORK_IMAGES_DIR:+--add-dir "$WEFTWORK_IMAGES_DIR"}
agy --model gemini-4-neon-high --mode plan --settings '{"permissions":{"deny":["command(*)","write_file(*)","read_url(*)","execute_url(*)","mcp(*)"]}}' ${WEFTWORK_IMAGES_DIR:+--add-dir "$WEFTWORK_IMAGES_DIR"} ${WEFTWORK_DIFF:+--add-dir "${WEFTWORK_DIFF%/*}"} -p "$(cat)"
gemini --approval-mode plan ${WEFTWORK_IMAGES_DIR:+--include-directories "$WEFTWORK_IMAGES_DIR"} -p 'Do the review above.'
```

Put a line in `review.reviewers` as it is. `src/review/review-cli.test.ts`
runs the three lines from this file with a fake `claude`, `agy` and
`gemini`, checks that the folder they get holds every path in
`WEFTWORK_IMAGES`, and checks that the first two are the built-in ones.

- **Claude Code** (`claude --help`, 2.1.325; code.claude.com/docs/en/cli-reference
  and the Agent SDK's Read tool, through Context7; both read 2026-11-15).
  The brief comes on stdin. `--model opus` is the alias for the latest
  Opus. `--tools` keeps only the read tools and Bash;
  `dontAsk` denies each call that would ask for permission; and
  `--setting-sources ""` loads no user or project settings that could
  allow more. Checked by hand with 2.1.325 on 2026-11-15: the reviewer ran
  `git status` and `git diff --stat`, Write, `touch` and
  `git diff --output=<file>` were denied, and it read a screenshot in an
  added folder (and could not read it without `--add-dir`). With 2.1.329 it
  reads one only outside `.git`, hence the copies above. `--effort high`
  sets its reasoning effort.
- **Antigravity CLI** (`agy --help` and `agy models`, 1.5.14;
  antigravity.google/docs/permissions.md and docs/sandbox.md; all read
  2026-11-21). `agy -p` does not read stdin, so the shell reads the brief
  into the `-p` argument; Linux caps one argument at 128 KiB, so a larger
  brief fails this reviewer. agy has no flag that skips the user's
  `settings.json`; the deny rules keep it read-only, since a deny rule wins
  over any allow rule there. `plan` mode is a second layer (do not add
  `--disable-slash-commands`: agy then warns that `--mode plan` has no
  effect). It runs no shell command, so it reads the change from the diff
  file the engine writes (`WEFTWORK_DIFF`, `docs/REVIEW.md`), and the
  design brief gives each image's path. Checked by hand with Gemini 4 Neon
  on 2026-11-21: `git diff --output=<file>`, `curl`, `write_file` and
  `edit_file` were denied, also in a subagent it started, and the reply
  went on; it read a file and described a screenshot in an added folder.
  An allow rule is not enough: with `command(git diff)` allowed,
  `git diff --output=<file>` wrote the file, and a command no rule allowed
  ended the run with no reply and exit 0. What the rules cannot turn off
  (agy ignores a deny rule on a tool name): `search_web`, which sends a
  query to Google search, not to a site of the brief's choosing; subagents,
  which keep the deny rules; and a schedule, which ends with the session.
  A subagent the reviewer waits on can hold the round until
  `timeout_seconds`.
- **Gemini CLI** (`gemini --help`, 0.68.0; github.com/google-gemini/gemini-cli
  `docs/cli/cli-reference.md`, `docs/tools/file-system.md` and
  `docs/reference/commands.md`, through Context7; all read 2026-11-15).
  `-p` adds its text after the brief on stdin. `plan` is the read-only
  mode: it runs no shell command, so this reviewer reads the files but
  cannot run `git diff`. This entry does not open the folder of the
  engine's diff file; with it, put the diff in the brief yourself.
  `read_file` reads images. This entry is NOT
  checked with a real model: the docs say git-aware filtering hides `.git/`
  from `@` paths, and if it hides the screenshots from `read_file` too,
  this reviewer reviews the diff without them.

## A programmatic check wins

Where a test can check the UI (a visual regression test with a stored
baseline, an accessibility check, a contrast ratio, a colour that is not a
design token, a layout assertion), put it in the verify command. The done gate runs it and it gates; a model's view of a screenshot
does not.

## Limits

- The images stay in the engine's folder; the pull request lists them by
  path and hash, it does not embed them.
- A reviewer that cannot take `WEFTWORK_IMAGES` must open the image files by
  path, as the Claude Code, Antigravity and Gemini CLI entries above do. One that can do
  neither reviews the diff alone, and should say so.
- Vision models judge visual design weakly: absolute scores rarely match
  people, zero-shot critiques are often wrong, and fine colour and spatial
  detail is misread; comparing two screens works better
  (`docs/research/R18-vision-design-judging.md`). Hence the severity rule
  above, and the score never gates. Those measurements are of 2024 and 2025
  models; none of today's reviewers.
- The screenshot command comes from the setting files, so a repository's
  `weftwork.yaml` can name any command, as it can for the reviewers.
