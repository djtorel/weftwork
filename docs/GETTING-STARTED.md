# Getting started

<!-- story: e12s04 -->

This page takes you from nothing to a first weft-ready run in your own project:
install weftwork, set up a new project or convert one planned with
bigpowers, GSD, GSD 2, spec-kit or BMAD, give the agent its first task, and
undo it all if you change your mind. Each step links to the page that has the
detail.

## 1. Install

You need git and Node 26 or later with npm. For the first weft-ready run you also
need Claude Code, the GitHub CLI `gh` signed in, and the Codex CLI (the
default reviewer, from another model family).

```bash
npm install -g weftwork
weftwork --version
```

`--version` prints the version, which means `weftwork` is on your PATH. The
skills setup copies into your project call `weftwork <command>` (`weftwork
engine`, `weftwork review`, `weftwork pr-proof`) and find the docs under
`$(weftwork path)`. The Claude Code Stop hook and guard run `weftwork` from
PATH too; where it is missing they block and say to install it. If npm says
it cannot write to its global folder, set a prefix you own first (`npm
config set prefix ~/.local`, with `~/.local/bin` on your PATH). Upgrade:
`npm install -g weftwork@latest`. Undo: `npm uninstall -g weftwork`.

**From a checkout instead** (to work on weftwork, or to use a change that is
not released yet), you also need Python 3 for weftwork's own Preflight:

```bash
git clone https://github.com/djtorel/weftwork.git
cd weftwork
bash tools/setup.sh
npm link
weftwork path
```

`setup.sh` prints `setup: OK` when every tool is there. It installs PyYAML,
yamllint and the npm packages; it never installs Node. `npm link` points the
`weftwork` command at this checkout, and `weftwork path` prints it. If you
move the checkout, run `npm link` again there. Undo: `npm unlink -g
weftwork`.

## 2a. Set up a new or plain project

A plain project is one with no other planning system. In the project folder,
run:

```bash
cd /path/to/project
weftwork init
```

With no path, `init` sets up the current folder. Add `--stop-hook` for the
Claude Code Stop hook and guard, and `--no-run` for a project you do not
trust (`weftwork init --help` lists every option). From a weftwork checkout
you can also open Claude Code there and say "Set up weftwork in
/path/to/project"; the `weft-setup` skill runs the same setup.

Setup:

1. Reads the folder and runs its test, lint, typecheck and build commands,
   once each time it is called, so that AGENTS.md names only commands that
   resolve. A command that fails is listed as `(fails today)` and left out
   of the Preflight. Say "do not run its commands" for a project you do not
   trust; then no command is written.
2. Asks up to five questions (what the project is, the words that matter,
   what the agent must never do, code rules, first tasks), each with a
   recommended answer; press Enter to keep it.
3. Shows every file it would write, as a diff, and changes nothing.
4. Writes only when you answer `y` to `Write these files? [y/N]` (or you
   passed `--yes`). It never overwrites a file you changed
   unless you name it, and then it moves the old file to
   `<path>.weftwork-old` first.

It writes AGENTS.md (with CLAUDE.md as a symlink), the `weft-ready`,
`weft-review`, `weft-pr` and `weft-improve` skills under `.claude/skills/`, lines for
`.gitignore`, the local backlog, and, if you ask for it, the Claude Code Stop
hook and guard in `.claude/settings.json`. It commits nothing. Commit the
result yourself, or as the first task.

Every option, and the JSON form agents use, is in [`SETUP.md`](SETUP.md).
[`DETECT.md`](DETECT.md) says what it reads.

## 2b. Convert a bigpowers, GSD, GSD 2, spec-kit or BMAD project

A bigpowers project has `specs/state.yaml`; a GSD project has `.planning/`;
a GSD 2 project has `.gsd/` (when git does not track it, only the backlog is
written);
a spec-kit project has `.specify/`; a BMAD v6 project has `_bmad/` and
`_bmad-output/`; a BMAD v4 project has `.bmad-core/` and `docs/stories/`. On a new branch of the project, with its Preflight passing:

```bash
cd /path/to/project
echo '{}' | weftwork convert               # the plan; changes nothing
echo '{"apply":true}' | weftwork convert   # convert
weftwork init                              # a new AGENTS.md (step 2a)
```

If the project already has an AGENTS.md, `init` keeps it as a conflict; run
`weftwork init --overwrite AGENTS.md` to replace it. From a weftwork checkout
you can instead open Claude Code there and say "Convert /path/to/project to
weftwork": the `weft-convert` skill checks the Preflight, shows the plan
and waits for your yes, and opens the pull request. Either way, it:

1. Tags the last commit that tracks `specs/` as `bigpowers-era` (GSD:
   `.planning/` as `gsd-era`; GSD 2: a tracked `.gsd/` as `gsd2-era`;
   spec-kit: `specs/` as `speckit-era`; BMAD: `_bmad-output/` as `bmad-era`;
   BMAD v4: `docs/stories/` as `bmad-era`).
2. Moves the files that code or docs cite (and every bigpowers ADR) into
   `docs/`, and rewrites the citations.
3. Moves the rest to a gitignored `.specs/` (GSD: `.gsd-planning/`; GSD 2:
   `.gsd2-plans/`; spec-kit: `.speckit-specs/`; BMAD: `.bmad-output/`;
   BMAD v4: `.bmad-stories/`). Nothing is deleted.
4. Adds the open work to the local backlog with its ids: bigpowers epics and
   stories, GSD roadmap phases, spec-kit features with their open tasks, or
   BMAD epics and stories.
5. Then setup (step 2a) writes a new AGENTS.md. The skill also opens one
   pull request with Preflight green; from the terminal, commit and open it
   yourself.

Detail and what it refuses: [`CONVERT.md`](CONVERT.md).

## 3. Your first weft-ready run

The backlog is `"$(git rev-parse --git-common-dir)/weftwork/BACKLOG.md"` in
your project (`.git/weftwork/BACKLOG.md` in a plain clone). It is local, so
it is never committed. Open Claude Code in your project and name a task:

> Add a README. Weft ready.

The `weft-ready` skill takes it to a pull request that is ready to merge,
without asking you more than it must. It branches from `main`, makes the
change, proves it with the Preflight through the engine's done gate, has
Codex review it (at most 3 rounds), opens the pull request with a Proof block
and a list of the decisions it made alone, and waits for CI. It never merges.
You read the pull request and merge it.

It stops and asks you only on a fixed list of triggers, such as a write
outside the project, a push to `main`, or a check it cannot make pass
([`ASK.md`](ASK.md)). On a hard stop it opens a draft pull request and
leaves a handoff note; the next session picks it up with the resume check
([`STATE.md`](STATE.md)).

To change the reviewers or the round limit, add `review` to a
`weftwork.yaml` in your project ([`REVIEW.md`](REVIEW.md)).

To have weftwork learn from your tasks, add `history: local` to the same
file. Each pull request it files then adds a record on your machine. Nothing
is sent anywhere. Later, `echo '{}' | weftwork history` shows the failures
that keep coming back, and "Weft improve." asks the agent to propose one small
fix for the most common one, in a pull request you can merge or close
([`HISTORY.md`](HISTORY.md)).

## 4. Undo

The commands below are for a bigpowers project. For another system, put its
tag, its plans folder and its local copy (step 2b names each) in place of
`bigpowers-era`, `specs/` and `.specs`; the plan prints the tag as `tag`.

**After the pull request is merged:** revert it. For a conversion, also
delete the tag:

```bash
git tag -d bigpowers-era
```

If the tag was pushed, also run `git push origin :refs/tags/bigpowers-era`.

**Before you commit a setup:** undo what it wrote. Setup records each write,
so one command reverses them (`docs/SETUP.md` § Undo):

```bash
echo '{"path":"/path/to/project","undo":true}' | weftwork setup
```

It removes the files setup created, gives `.gitignore` back its old lines,
and moves each `<path>.weftwork-old` back. A file you changed since setup is
kept and listed in `kept`; undo it by hand, or run undo again after.

**Before you commit a conversion:**

```bash
cd /path/to/project
git restore .           # specs/ and the rewritten files come back
git status --short      # the new files: the copies in docs/, maybe .gitignore
rm -r .specs            # a copy of specs/, which is back
git tag -d bigpowers-era
```

Then delete the new files that `git status --short` lists, and the
`## Converted from bigpowers` section of the local backlog (the section is
named after the system: `## Converted from GSD`, and so on).
