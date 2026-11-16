# Skills

`weft-ready`, `weft-review` and `weft-pr` are adapted from Theo Browne's
[tstack](https://github.com/t3dotgg/tstack) at commit 11e37a7 (MIT licence,
see `TSTACK-LICENSE`), where they are `full-stop`, `sol-loop` and `file-pr`.
They have their own names here so that they do not clash with tstack when both
are installed, and because they do not do the same things. Changes: they
follow this repository's rules (`AGENTS.md`), `weft-ready` never merges and
carries `full-send`'s steps itself, `weft-review` runs the reviewers through
the engine (the Codex CLI by default), and `weft-pr` adds no model line,
because a squash merge can carry the PR body into the commit.
weftwork's research brief R17 (practitioner autonomy) explains why.

`weft-improve` is our own: it reads the report of `node src/history-cli.ts`
and proposes one small fix for a recurring failure (`docs/HISTORY.md`).

`weft-setup` and `weft-convert` are our own too. They stay in the weftwork
repository, and setup does not copy them into a project. They run
`node src/setup-cli.ts` (`docs/SETUP.md`) and `node src/convert-cli.ts`
(`docs/CONVERT.md`).
