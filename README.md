# weftwork

A workflow engine for coding agents: an agent takes a task from a short request
to a pull request that is ready to merge, and the engine holds it to the parts
prose cannot (a done gate it cannot fake, counted ceilings, a handoff on a hard
stop).

Status: the engine core, the Claude Code Stop-hook adapter, the state and
handoff files, and the budget setting are built. Next is the auto run, one
command from a task to a ready PR. Start with [`AGENTS.md`](AGENTS.md); the
research is in [`docs/research/`](docs/research/), with the synthesis in
[`SYNTHESIS.md`](docs/research/SYNTHESIS.md).

Plans, tasks and agent state are local and untracked; see "Where things are" in
`AGENTS.md`. The bigpowers-era planning tree is at the tag `bigpowers-era`.

Predecessor (archived, reference only): `../pi-flow-legacy`.
