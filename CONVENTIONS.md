# Conventions

Shared rules for every agent working in weftwork. Written from the bigpowers base, trimmed to a project with no product code yet.
Add the code-style and test sections when the stack is chosen (see R8, `docs/research/`).

## Conventional Commits

- ALWAYS write commits as [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
- Format: `<type>(<scope>): <description>` with a space after the colon.
- Types: `feat` (minor), `fix` and `perf` (patch), `docs`, `chore`, `style`, `refactor`, `test` (no bump).
- Research and planning work uses `docs`. Tooling uses `chore`.
- NEVER add `Co-authored-by` or any AI attribution footer to a commit.
- Every commit on a story branch carries a `Story: <story-id>` trailer, for
  example `Story: e02s04`, after a blank line in the body. It is not an
  attribution footer. `scripts/record-cycle-time.sh` attributes effort by
  this trailer and refuses to record a story whose commits lack it.
- The cycle-time ledger is `specs/metrics/cycle-times.md`. Always pass
  `--file specs/metrics/cycle-times.md` to `record-cycle-time.sh`: its
  default name, `cycle-times.yaml`, holds front matter plus a Markdown
  body, which `validate-specs-yaml.sh` rejects. Take the branch SHA range
  before the squash merge; the merge hides it.

## Git

- NEVER work on `main`. Start every task on a feature branch.
- A guard hook blocks direct commits to `main`.
- NEVER commit, push, or land a branch without the owner's go-ahead.
- Landing is currently a decision for the owner.

## Boundaries

- NEVER read or write files outside this repository without asking the owner.
- Exception: the owner names a path, for example `../pi-flow-legacy` for R14.
- `scripts/` is a symlink to a global install. NEVER commit it. NEVER edit through it.
- NEVER run more than 2 subagents at once.

## Evidence

- Every task has a runnable `verify:` command.
- Run the command after the last edit. Show its output.
- A self-report is not evidence.
- Every brief cites dated sources: access date and publication date.
- Cite papers wherever literature exists. Practitioner opinion alone is not enough there.
- Secondary sources (blogs, comparison pages, curated lists) find candidates. They prove nothing.
- Every hypothesis gets a verdict: confirmed, refined, or refuted.
- NEVER state a claim as a decision without a cited source.

## Always Green and Discovered Defects

- Preflight is `yamllint specs && bash scripts/validate-specs-yaml.sh &&
  bash tools/check-gate-ignores.sh`.
- Preflight MUST pass before forward work.
- A reproducible gate failure needs `quick-fix` or `fix-bug`, in a separate commit.
- Banned dismissive phrases: "pre-existing", "unrelated to this session", "not introduced by my changes", "out of scope".

## specs/ and docs/

- `specs/` holds planning output: scope, epics, release plan, state, checkpoints.
- `docs/research/` holds one brief per research story.
- `docs/SEED-SPEC.md` is provisional. Archive it to `docs/archive/` when the v1 spec replaces it.
- Write YAML with a `---` start and lines of 80 columns or fewer.
- Use `todo`, `in_progress`, `done` for task and story status.

## Generated and Managed Files

- Edit `AGENTS.md` only inside `bigpowers:` fences, or outside them.
- `CLAUDE.md` is a symlink to `AGENTS.md`. NEVER edit it separately.
- Every command written into `AGENTS.md` MUST resolve in this repository today.

## Provisional Rules

- The bigpowers workflow mandate applies now. Research stories R1 and R2 evaluate it.
- Add gates only after an observed failure justifies them.
- Each gate needs a logged, one-shot escape hatch.
