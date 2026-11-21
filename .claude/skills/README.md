# Skills

`all-ready`, `second-opinion` and `pr-it` are adapted from Theo Browne's
[tstack](https://github.com/t3dotgg/tstack) at commit 11e37a7 (MIT licence,
see `TSTACK-LICENSE`), where they are `full-stop`, `sol-loop` and `file-pr`.
They have their own names here so that they do not clash with tstack when both
are installed, and because they do not do the same things. Changes: they
follow this repository's rules (`AGENTS.md`), `all-ready` never merges and
carries `full-send`'s steps itself, `second-opinion` runs the reviewers through
the engine (Claude Opus, Codex and Gemini Neon by default), and `pr-it` adds no model line,
because a squash merge can carry the PR body into the commit.
weftwork's research brief R17 (practitioner autonomy) explains why.

`all-in` takes `full-send`'s merge gate and merge onto `all-ready`: it runs
`all-ready`'s steps, then squash-merges the commit it proved when the gate
holds. It never uses `--admin` or auto-merge.

`retro` is our own: it reads the report of `node src/history-cli.ts`
and proposes one small fix for a recurring failure (`docs/HISTORY.md`).

`bootstrap` and `migrate` are our own too. They stay in the weftwork
repository, and setup does not copy them into a project. They run
`node src/setup-cli.ts` (`docs/SETUP.md`) and `node src/convert-cli.ts`
(`docs/CONVERT.md`).
