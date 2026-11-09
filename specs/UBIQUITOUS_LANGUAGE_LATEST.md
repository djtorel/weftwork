# Ubiquitous Language

Written by `define-language` on 2026-11-07 from the planning sessions. Terms the research
phase may change are marked (provisional).

## Work structure

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Research story** | A timeboxed question R0-R14 that produces one brief | ticket, task, topic |
| **Story** | A bigpowers work item `eNNsYY` with a `-tasks.yaml`; each research story is delivered as one story | issue |
| **Epic** | A bigpowers capsule of stories; here one epic per wave (e01-e04) | phase, milestone |
| **Wave** | The informal name for an epic's place in the research order | stage |
| **Task** | A step inside a story, with a runnable `verify:` command | step, todo |
| **Brief** | The markdown deliverable of a research story, in `docs/research/` | report, memo |
| **Synthesis** | The final document collecting every hypothesis verdict | summary, conclusion |
| **Checkpoint** | The recorded re-plan decision after e01 (`specs/checkpoints/e01-replan.md`) | review gate |

## Evidence

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Hypothesis** | A numbered claim H1-H23 from the seed spec, the routing discussion or the R11 plan, awaiting a verdict | assumption, requirement |
| **Verdict** | A hypothesis outcome: **confirmed**, **refined**, or **refuted**, with sources | conclusion, finding |
| **Evidence** | A `verify:` command that was seen to exit 0 after the last edit | proof, confirmation |
| **Verify command** | The runnable command declared on a task | test, check |
| **Primary source** | A paper, official doc, or code from the tool's own authors | |
| **Secondary source** | A blog, comparison page, or curated list; it finds candidates and proves nothing | reference |
| **Prior art** | Existing work found by `research-first`, with an adopt, extend, compose, or build verdict | competitors |

## Workflow design (provisional)

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Host** | The program that runs the agent: pi, Claude Code, opencode, Codex CLI, Gemini CLI | harness, client, runtime |
| **Adapter** | The thin per-host layer that maps host events to engine calls | plugin, connector |
| **Engine** | The host-agnostic core that owns state, gates, and the ledger | server, backend |
| **Skill** | A portable `SKILL.md` that tells an agent how to do one step | prompt, command |
| **Role** | A job an agent plays: scout, planner, worker, verifier, reviewer, decider, integrator | persona |
| **Gate** | A check that blocks progress until it passes | guard, checkpoint |
| **Escape hatch** | A one-shot, logged way to pass a gate | bypass, override |
| **Advisory vs enforced** | Advisory: a skill the agent may ignore. Enforced: a hook or engine check it cannot skip | soft vs hard |
| **Ceremony** | Process effort beyond what the risk of the work needs | overhead, process |
| **Tier** | A named cost and capability level: fast, standard, deep. Config maps tiers to models | model, size |
| **Reasoning effort** | How much a model thinks before answering; a separate knob from tier | thinking level |
| **Worktree** | A git working directory per worker, for parallel isolation | clone, branch copy |
| **File scope** | The files a task declares it will touch; scopes must be disjoint to run in parallel | ownership |
| **Decision request** | A written question an agent raises instead of asking the user, with options and reversibility | blocker |

## Relationships

- A **Research story** is delivered as exactly one **Story**, inside one **Epic**.
- A **Brief** gives a **Verdict** for each **Hypothesis** assigned to its research story.
- The **Synthesis** collects every **Verdict** and the answer to "what is the minimum useful first release".
- A **Gate** passes on **Evidence**, never on a self-report.
- An **Adapter** connects one **Host** to the **Engine**; **Skills** are shared by all hosts.
- A **Role** runs at a **Tier** with a **Reasoning effort**.

## Example dialogue

> **Dev:** "Is R14 a story or a research story?"
> **Owner:** "Both. R14 is the research story; e01s01 is the story that delivers it."
> **Dev:** "And its brief must give a verdict on H4 and H6?"
> **Owner:** "Yes, confirmed, refined, or refuted, each with a primary source if one exists."
> **Dev:** "Does `check-brief.sh` count as evidence that the brief is good?"
> **Owner:** "No. It is evidence the brief is complete. Whether it is right is for review."

## Flagged ambiguities

- **"Story"** means a bigpowers story (`e01s01`) and, in casual talk, a research story (`R14`).
  Use "research story" for R-ids and "story" for `eNNsYY`. The mapping is in `SCOPE_LATEST.yaml`.
- **"Harness"** means the host (R5 is titled "Harness capability matrix"), the checking machinery
  ("the harness watched it exit 0" in H1), and in the literature the whole agent scaffold
  ("Code as Agent Harness"). Recommendation: **host** for the program, **engine** for the checker,
  and "harness" only inside quotes from papers. R5 keeps its title for now; rename it if you agree.
- **"Wave" vs "epic"** are one-to-one today. If R0 adds stories, that may break. Epic is canonical.
- **"Gate"** covers bigpowers hard gates, hook blocks, and `verify:` commands. R13 should separate
  them, because the seed spec treats them as one thing.
