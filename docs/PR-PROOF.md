# The PR proof

<!-- story: e11s02 -->

The proof in a pull request comes from the engine, not from the agent's
report. The agent runs the verify command through the engine, then asks
the engine for the proof block:

```bash
echo '{"command":"npm test"}' | node src/cli.ts
echo '{"command":"npm test"}' | node src/pr-proof-cli.ts
```

The proof CLI never runs the command and never writes. It reads the ledger
in `<git dir>/weftwork/` and fingerprints the working tree, then prints
plain lines for the Proof block of the PR template:

```text
weftwork done gate: ready
command: npm test
last run: done, exit 0, passed, at 2026-11-15T10:00:00.000Z
budget: 3 runs in this loop, 1 failed run of this command before the pass
```

| Exit | First line | Meaning | What to do |
| ---- | ---------- | ------- | ---------- |
| 0 | `ready` | The last run of the command is done, no stop state after it, and the tree is the one that run saw | Open the PR for review |
| 1 | `draft` | No run, a last run that is not done (failed, blocked, stalled, exhausted, killed, overridden), or a tree that changed after the run; a `why:` line says which | Write the handoff, open a draft PR with the block |
| 2 | none | Bad input, no git working tree, or a ledger it cannot read; the reason is on stderr | Fix the cause and run it again |

The command must be the exact string the engine ran: the ledger matches
commands by text. When the engine logged a stop state for the
command after its last run (blocked, stalled, exhausted, killed,
overridden), a `stopped:` line names it and a `detail:` line shows the
stop rule's detail, such as the ceiling that was reached. A refusal logs a
state and no run, so the two lines are never merged.

Each engine call writes a run id (`runId`) on its run line and its state
line. A refusal writes no run line, so its state line also names the last
run of the command that the engine read before it (`after`). The proof
pairs the last run with a stop state by these ids: the run's own state
line, or a refusal that names the run. A ledger line from before run ids
has no `runId`, so for such a run the proof uses time: a state at or after
the run's time. A wall clock that steps back can make that pairing wrong;
the ids do not depend on the clock. On `ready`, `budget:`
counts the runs of any command since the `done` before the pass, and the
failed runs of this command before it; on `draft`, it counts up to now.
It reads the last 1 MiB of the ledger, as the stop rules do (F3). Tokens are
shown only by the Claude Code Stop hook (`docs/BUDGET.md`).

A commit does not change the fingerprint: it covers file contents, not
HEAD. Any edit to a tracked or untracked file after the run does, so the
proof is `draft` until the engine runs again.

The ledger is the agent's to read and the guard's to protect: the guard
blocks tool calls that write it (`docs/GUARD.md`). Its Bash match is by
path text, so this proof is as strong as that guard.
