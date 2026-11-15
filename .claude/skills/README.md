# Skills

`full-stop`, `review-loop` and `file-pr` are adapted from Theo Browne's
[tstack](https://github.com/t3dotgg/tstack) at commit 11e37a7 (MIT licence,
see `TSTACK-LICENSE`). Changes: they follow this repository's rules
(`AGENTS.md`), `full-stop` never merges and carries `full-send`'s steps
itself, `review-loop` is tstack's `sol-loop` run through the Codex CLI, and
`file-pr` adds no model line, because a squash merge can carry the PR body into
the commit. `docs/research/R17-practitioner-autonomy.md` explains why.

`setup-project` is our own: it drives `src/setup-cli.ts` (`docs/SETUP.md`).
