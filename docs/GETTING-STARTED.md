# Getting started

<!-- story: e12s04 -->

This page takes you from nothing to a first "full stop" in your own project:
install weftwork, set up a new project or convert a bigpowers one, give the
agent its first task, and undo it all if you change your mind. Each step links
to the page that has the detail.

## 1. Install

You need git, Node 26 or later with npm, and Python 3 (only for weftwork's own
Preflight). For the first full stop you also need Claude Code, the GitHub CLI
`gh` signed in, and the Codex CLI (the default reviewer, from another model
family).

```bash
git clone https://github.com/djtorel/weftwork.git
cd weftwork
bash tools/setup.sh
```

`setup.sh` prints `setup: OK` when every tool is there. It installs PyYAML,
yamllint and the npm packages; it never installs Node.

weftwork is not a package yet. Your project uses this checkout by its
absolute path, so keep it where it is. If you move it, set up each project
again (step 2).

## 2a. Set up a new or plain project

A plain project is one with no other planning system. Open Claude Code in the
weftwork checkout and say:

> Set up weftwork in /path/to/project

The `setup-project` skill runs `src/setup-cli.ts` on that folder. It:

1. Reads the folder and runs its test, lint, typecheck and build commands,
   once each time it is called, so that AGENTS.md names only commands that
   resolve. A command that fails is listed as `(fails today)` and left out
   of the Preflight. Say "do not run its commands" for a project you do not
   trust; then no command is written.
2. Asks up to five questions (what the project is, the words that matter,
   what the agent must never do, code rules, first tasks), each with a
   recommended answer.
3. Shows every file it would write, as a diff, and changes nothing.
4. Writes only when you say yes. It never overwrites a file you changed
   unless you name it, and then it moves the old file to
   `<path>.weftwork-old` first.

It writes AGENTS.md (with CLAUDE.md as a symlink), the `full-stop`,
`review-loop` and `file-pr` skills under `.claude/skills/`, lines for
`.gitignore`, the local backlog, and, if you ask for it, the Claude Code Stop
hook and guard in `.claude/settings.json`. It commits nothing. Commit the
result yourself, or as the first task.

To run it without Claude Code, and for every option, see
[`SETUP.md`](SETUP.md). [`DETECT.md`](DETECT.md) says what it reads.

## 2b. Convert a bigpowers or GSD project

A bigpowers project has `specs/state.yaml`; a GSD project has `.planning/`.
spec-kit and BMAD cannot be converted yet. Open Claude Code in the weftwork checkout and say:

> Convert /path/to/project to weftwork

The `convert-project` skill checks that the project's Preflight passes on a
new branch, then runs `src/convert-cli.ts`. It shows the plan first and
changes nothing until you say yes. Then it:

1. Tags the last commit that tracks `specs/` as `bigpowers-era` (GSD:
   `.planning/` as `gsd-era`).
2. Moves the files that code or docs cite (and every bigpowers ADR) into
   `docs/`, and rewrites the citations.
3. Moves the rest to a gitignored `.specs/` (GSD: `.gsd-planning/`). Nothing
   is deleted.
4. Adds the open work to the local backlog with its ids: bigpowers epics and
   stories, or GSD roadmap phases.
5. Runs setup (step 2a) for a new AGENTS.md, and opens one pull request with
   Preflight green.

Detail and what it refuses: [`CONVERT.md`](CONVERT.md).

## 3. Your first full stop

The backlog is `"$(git rev-parse --git-common-dir)/weftwork/BACKLOG.md"` in
your project (`.git/weftwork/BACKLOG.md` in a plain clone). It is local, so
it is never committed. Open Claude Code in your project and name a task:

> Add a README. Full stop.

The `full-stop` skill takes it to a pull request that is ready to merge,
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

## 4. Undo

**After the pull request is merged:** revert it. For a conversion, also
delete the tag:

```bash
git tag -d bigpowers-era
```

If the tag was pushed, also run `git push origin :refs/tags/bigpowers-era`.

**Before you commit a setup:** undo what it wrote. Setup records each write,
so one command reverses them (`docs/SETUP.md` § Undo):

```bash
echo '{"path":"/path/to/project","undo":true}' | node src/setup-cli.ts
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
`## Converted from bigpowers` section of the local backlog.
