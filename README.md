# weftwork

A workflow engine for coding agents: an agent takes a task from a short request
to a pull request that is ready to merge, and the engine holds it to the parts
prose cannot (a done gate it cannot fake, counted ceilings, a handoff on a hard
stop).

Status: the engine, the Claude Code adapter and the auto run ("full stop",
one request to a ready PR) are built, and so are setting up a new project and
converting a bigpowers, GSD or spec-kit one. Converting BMAD comes next. To
work on weftwork itself, start with [`AGENTS.md`](AGENTS.md); the research is
in [`docs/research/`](docs/research/), with the synthesis in
[`SYNTHESIS.md`](docs/research/SYNTHESIS.md).

## Getting started

```bash
git clone https://github.com/djtorel/weftwork.git
cd weftwork
bash tools/setup.sh
npm link
```

Then open Claude Code in this checkout and say "Set up weftwork in
/path/to/project", or "Convert /path/to/project to weftwork" for a bigpowers,
GSD or spec-kit project. In that project, name a task and add "Full stop."
[`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md) has each step, what you
need installed, and how to undo it.

Plans, tasks and agent state are local and untracked; see "Where things are" in
`AGENTS.md`. The bigpowers-era planning tree is at the tag `bigpowers-era`.

Predecessor (archived, reference only): `../pi-flow-legacy`.
