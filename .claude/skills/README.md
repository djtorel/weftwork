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
`docs/research/R17-practitioner-autonomy.md` explains why.

`weft-setup` is our own: it drives `src/setup-cli.ts` (`docs/SETUP.md`).

`weft-convert` is our own too: it drives `src/convert-cli.ts`
(`docs/CONVERT.md`).

`weft-improve` is our own too: it reads `src/history-cli.ts`'s report and proposes
one small fix for a recurring failure (`docs/HISTORY.md`).
