# When the agent asks

<!-- story: e11s04 -->

An unattended run asks the owner only on a fixed list of triggers. Every
other question the agent answers itself, logs, and lists in the pull
request. A question that is asked too often stops the run for nothing; a
question that is not asked can do harm that a review cannot undo.

## The triggers

| Trigger | Held by |
| --- | --- |
| A file write outside the worktree | The guard (PreToolUse), for Edit, Write, MultiEdit and NotebookEdit |
| A push to `main` or `master` | The guard (PreToolUse), for Bash `git push` |
| An irreversible or destructive action (delete data, rewrite shared history, deploy, publish) | The `full-stop` skill |
| A security-sensitive change (auth, secrets, permissions, the guard itself) | The `full-stop` skill |
| Any other effect outside the worktree (another repository, a service, a message) | The `full-stop` skill |
| A task or plan too broken or ambiguous to follow | The `full-stop` skill |
| Spend past the budget (the engine answers exhausted) | The engine (`docs/BUDGET.md`) |
| A change the agent cannot prove, or a check it cannot make pass | The `full-stop` skill |

On a trigger the run ends blocked: the agent writes the handoff
(`node src/handoff-cli.ts`), runs the engine with `"blocked":"<why>"`,
opens a draft pull request with the proof and the handoff note, and then
asks the owner with the question tool.

## The guard's two triggers

The guard (`docs/GUARD.md`) runs them when the hook's project folder is in
a git worktree. Outside a repository they are off.

- **A write outside the worktree.** The path is resolved as for the
  protected files (against the tool's cwd and through symlinks) and must
  be inside the worktree root (`git rev-parse --show-toplevel`). Two places
  outside it stay writable: the temp folder (`$TMPDIR` and Node's
  `os.tmpdir()`, where the session scratchpad is), and the clone's backlog
  `<git common dir>/weftwork/BACKLOG.md`. A write under `~/.claude/` (for
  example memory) is outside the worktree and is blocked.
- **A push to main.** The command is split at `;`, `&&`, `||`, `|`, `&`
  and newlines, and quotes are dropped. A part that starts with `git` (after
  `VAR=value` words and git's own options such as `-C`) and runs `push` is
  blocked when a refspec updates `main` or `master` (`main`, `HEAD:main`,
  `+x:refs/heads/main`, `--delete main`, the matching refspec `:` or a
  wildcard), when it has `--all` or `--mirror`, or when it has no refspec, or pushes `HEAD`, from `main` or
  `master`. A `git checkout` or `git switch` earlier in the same command
  changes the branch for the parts after it.

A block exits 2 with the reason, as every guard block does, and adds a
guard line to the ledger; the target of a push block is `git push`.

What they do not see: a Bash command that writes outside the worktree
(`cp`, `>`, `tee`) is not checked; a push from a script, an alias, a
variable or `sh -c` is not seen; a default branch with another name is not
protected. The skill text holds these, and GitHub branch protection on
`main` is the wall behind them.

## The decision log

Every choice the agent makes without the owner is one line in
`<git dir>/weftwork/decisions.jsonl`, with the branch it was made on:

```bash
echo '{"question":"Split engine.ts?","choice":"Yes, into two files","reason":"It passed 300 lines."}' \
  | node src/decision-cli.ts
node src/decision-cli.ts list
```

`list` prints the current branch's decisions, oldest first, one line each,
for the Decisions section of the pull request, or `None`:

```text
- Split engine.ts? Choice: Yes, into two files. Reason: It passed 300 lines.
```

Each field is required and at most 500 characters. `list` reads the
last 1 MiB of the log; when the log is longer it says older decisions
were left out. On a detached HEAD the
CLI refuses: a decision belongs to a branch. Exit 0 done, 2 when it cannot
run, with the reason on stderr. The file is in the engine's folder, so the
guard blocks a tool call that writes it, and the CLI writes it from its own
process. A question whose text names a protected path is blocked by the
guard's Bash text match; write the JSON to a file in the temp folder and
pass it with `< file`.
