# weftwork — Seed Spec

**Status:** seed. A direction, not a contract. Everything below is provisional until the research
stories in §8 report back; expect sections to be rewritten, not just amended.

## 1. Thesis

Agentic coding on big projects fails in predictable ways: agents re-investigate the codebase for every
task, mark their own work done, drift from conventions, stall on questions nobody is there to answer,
and run one at a time when the work could run in parallel.

weftwork is a workflow for coding agents that runs **many threads of work in one codebase** and holds
them together with a structure that is **enforced, not just suggested**: evidence-backed "done",
agent-to-agent review and decisions, conventions checked by tools, and the right model for each job.
It runs in **pi** and **Claude Code** from one source of truth.

The name: the weft is the thread woven across the warp. The warp is the fixed structure (conventions,
gates, the plan); the weft is the agents' work passing through it.

## 2. Goals

1. **One workflow, two hosts.** pi and Claude Code first, with portable artifacts (`AGENTS.md`, Agent
   Skills `SKILL.md`, plain markdown/YAML) so leaving either host loses nothing.
2. **A modern end-to-end loop:** discuss → research → plan → build → verify → review → integrate.
3. **Parallel by design.** Independent tasks run concurrently in isolated worktrees, with declared file
   scopes and an integration step.
4. **Agents can unblock agents.** A question from a worker can be answered by a decider agent, and code
   can be reviewed by reviewer agents in rounds — each an *option* the owner can turn on, off, or
   restrict to low-stakes classes.
5. **Right model for the job.** Roles and tasks map to cost/capability tiers; the mapping is config.
6. **Good code is checked, not hoped for.** Conventions, decisions, and "done" are verified by tools
   and recorded evidence wherever a tool can do it.
7. **Ceremony proportional to risk.** A small fix should not pay for a release-sized process.

## 3. Non-goals (for now)

- Not a new agent runtime. Compose the hosts' own subagent/worktree machinery.
- No UI beyond terminal output and files.
- No large skill catalog. Target a small set of skills plus one entry command per host.
- No bespoke spec schema that only this tool can read.
- No hard gate without an observed failure that justifies it.

## 4. Principles carried over from pi-flow (see `../pi-flow-legacy`)

- **Evidence over claims.** "Done" is a verification command the harness watched exit 0, after the
  last source edit, matching the command the task declared. A self-report is not evidence.
- **Deterministic where possible.** Stack facts, commands, versions, and gate verdicts come from code,
  never from the model.
- **We lint our own output.** Every command or version written into `AGENTS.md` must resolve to the
  repo.
- **Gates earn their keep.** Every block has a one-shot, logged escape hatch; a gate overridden
  repeatedly without catching anything is proposed for retirement.
- **Merge-safe generated files.** Managed blocks with hashes; human edits are never overwritten.

Also carried over as a lesson: build the workflow first and the enforcement second. pi-flow hardened
gates before there was a loop worth gating.

## 5. Architecture sketch

```
            ┌──────────── skills + prompts (portable markdown) ────────────┐
            │  discuss · research · plan · build · verify · review · decide │
            └──────────────────────────────┬────────────────────────────────┘
                                           │ drive
   ┌──────────────┐    hooks/commands   ┌──┴───────────────┐   hooks/commands   ┌──────────────┐
   │ pi adapter   │ ──────────────────► │  weftwork engine │ ◄───────────────── │ Claude Code  │
   │ (extension)  │                     │  (CLI + library) │                    │ adapter      │
   └──────────────┘                     └──┬───────────────┘                    │ (plugin/hooks)│
                                           │ reads/writes                       └──────────────┘
                                   .weft/  state · plan · ledger · decisions · config
```

- **Engine:** host-agnostic TypeScript CLI + library. Owns state, the plan/task graph, the evidence
  ledger, gate evaluation, model routing, and the decision log. No host API inside it.
- **Adapters:** thin. Translate host events (tool calls, tool results, subagent start/stop, a question
  to the user) into engine calls, and engine verdicts back into blocks/allows/injections.
- **Skills:** the workflow itself, written once as portable `SKILL.md` files.

Whether the adapters can be this thin depends on research story R3.

## 6. Multi-agent shape

- **Roles** (provisional): scout, planner, worker, verifier, reviewer, decider, integrator. Dispatch is
  per subsystem, not per task, so agents don't re-learn the codebase for every task.
- **Parallelism:** one git worktree per worker. Each task declares its file scope; the planner checks
  scopes are disjoint before dispatch; overlapping tasks are serialized. An integrator merges and
  re-runs verification on the combined result.
- **Decision protocol:** when an agent would ask a question, it writes a decision request (question,
  options, context, reversibility). A decider answers from conventions, ADRs, and the plan, or
  escalates to the owner. Every answer goes in a decision log. Auto-answering is limited to classes
  the owner allows (e.g. reversible, in-scope).
- **Review rounds:** reviewers check evidence (tests run, mutations tried, conventions checked), not
  just opinion. Review and decisions run on a different model and a fresh context than the worker, to
  avoid two copies of one model agreeing with each other.

## 7. Model routing

The workflow names **tiers**, never models. Config maps tiers to concrete models per host.

```yaml
# .weft/config.yaml (repo)  overrides  ~/.config/weftwork/config.yaml (user)
hosts:
  claude-code: { fast: haiku, standard: sonnet, deep: opus }
  pi:          { fast: anthropic/claude-haiku-5-5, standard: anthropic/claude-sonnet-5-5, deep: anthropic/claude-opus-5-5 }
roles:
  scout:    { tier: fast }
  worker:   { tier: standard, may_escalate_to: deep }
  verifier: { tier: fast }
  reviewer: { tier: deep, must_differ_from: worker }
  decider:  { tier: deep, must_differ_from: worker }
limits:
  max_parallel: 3
  escalate_after_failures: 2
  budget: { per_task: null, per_story: null }
```

- The planner may raise or lower a task's tier from its risk/complexity tag, within owner-set floors
  and ceilings.
- A task that fails verification N times at its tier escalates one tier; every escalation is logged
  with its reason, so the config can be tuned from data later.
- Budget ceilings stop the run and ask, rather than escalating forever.

Precedence: invocation flag > repo config > user config. The mappings above are placeholders; R5
settles them.

## 8. Research stories (first)

Each is timeboxed, and each produces one short brief in `docs/research/` with dated sources.

| ID | Question | Feeds |
| --- | --- | --- |
| R1 | What do bigpowers and GSD actually do — which parts earn their place, which are ceremony? | §2, §6 |
| R2 | What are current practices for agentic coding on large projects (Claude Code's own patterns, Spec Kit, OpenSpec, BMAD, Kiro, orchestrator–worker setups, review loops, background agents)? | the loop in §2 |
| R3 | pi vs Claude Code capability matrix: hooks, subagents, skills, plugins, worktrees, the ask-user path, per-dispatch model choice. | §5, §7 |
| R4 | Agent-answered decisions and agent review: what works, what fails, how to avoid self-agreement? | §6 |
| R5 | Model routing: which tiers suit which work, and how cost and quality trade off in practice? | §7 |
| R6 | Evaluation: a small task set to compare a plain agent with weftwork variants on pass rate and cost per accepted task. | everything |

## 9. Open questions

- Is the engine a separate npm CLI the adapters shell out to, or a library each adapter imports?
- Where does the workflow's state live when two hosts touch the same repo?
- How much of the loop is skills (advisory) vs engine (enforced) at each ceremony level?
- What is the minimum useful first release: one host, one loop, no parallelism?
