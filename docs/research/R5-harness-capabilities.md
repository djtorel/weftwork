# R5 — Harness capability matrix

Research story R5, wave 2. Hypotheses H8, H9 and H16.
Question: for pi, Claude Code, opencode, Codex CLI and Gemini CLI, which
of hooks, subagents, skills, plugins, worktrees, an ask-user path and
per-dispatch model and effort choice does each host support, and how
does each host get its instruction and skill files. The features all five
share set the host-agnostic core.

## Sources

- [S1] pi documentation, `packages/coding-agent/docs` and README in `github.com/earendil-works/pi` (README, how-pi-works, skills, extensions, packages, security, usage, settings, sessions, mcp, sdk, rpc, slash-commands, prompt-templates; raw files fetched with curl from `main`; 14 pages), release v1.5.0, https://github.com/earendil-works/pi/tree/main/packages/coding-agent/docs - accessed: 2026-11-08 published: 2026-11-02
- [S2] pi local checks on this machine: `pi --version` (1.5.0), `pi --help`, `pi list` (installed packages include `pi-subagents`, `pi-mcp-adapter`, `@ifi/pi-plan`) - accessed: 2026-11-08 published: 2026-11-02
- [S3] pi-subagents v0.87.0 README (npm registry) and `docs/models.md` (raw file from `github.com/nicobailon/pi-subagents`, `main`), a third-party package, https://github.com/nicobailon/pi-subagents - accessed: 2026-11-08 published: 2026-11-07
- [S4] pi-flow-legacy spikes `SPIKE-child-extension-injection.md` (pi-subagents v0.79.0) and `SPIKE-q19-nested-usage.md` (pi 1.3.0), read only from `../pi-flow-legacy/specs/spikes/` as the owner allowed for this story; the owner's own measurements, not vendor docs - accessed: 2026-11-08 published: 2026-10-18
- [S5] Claude Code documentation pages `hooks`, `sub-agents`, `skills`, `plugins`, `memory`, `worktrees`, `model-config` (the `.md` form of each page on code.claude.com, fetched with curl), https://code.claude.com/docs/en/ - accessed: 2026-11-08 published: undated
- [S6] Claude Code local checks: `claude --version` (2.1.319) and `claude --help` - accessed: 2026-11-08 published: undated
- [S7] opencode documentation `agents`, `skills`, `rules`, `plugins`, `tools`, `permissions`, `models`, `config` (raw `.mdx` files from `github.com/anomalyco/opencode` at tag v1.19.5, the installed version; the `dev` branch differs from that tag by 73 lines in `agents.mdx`, 4 in `skills.mdx`, 2 in `plugins.mdx` and 2 in `tools.mdx`, and none in `rules.mdx`), https://opencode.ai/docs/ - accessed: 2026-11-08 published: 2026-10-28
- [S8] opencode local checks: `opencode --version` (1.19.5) and `opencode --help` (commands `agent`, `mcp`, `plugin`, `run`, `serve`) - accessed: 2026-11-08 published: 2026-10-28
- [S9] Codex documentation pages `hooks`, `agent-configuration/subagents`, `agent-configuration/agents-md`, `build-skills`, `build-plugins`, `environments/git-worktrees`, `developer-commands`, `agent-approvals-security` (the `.md` form on learn.chatgpt.com; the repository `docs/` pages for skills and AGENTS.md now only link there), https://learn.chatgpt.com/docs/ - accessed: 2026-11-08 published: undated
- [S10] Codex local checks: `codex --version` (codex-cli 0.167.0), `codex --help`, `codex plugin --help`, `codex features list` - accessed: 2026-11-08 published: 2026-11-06
- [S11] Gemini CLI documentation (`docs/hooks`, `docs/core/subagents`, `docs/tools/ask-user`, `docs/cli/skills`, `docs/cli/git-worktrees`, `docs/cli/gemini-md`, `docs/extensions`, `docs/reference/configuration`; raw files from `github.com/google-gemini/gemini-cli` `main`), release v0.67.0; Gemini CLI is not installed on this machine, so there is no local check, https://github.com/google-gemini/gemini-cli/tree/main/docs - accessed: 2026-11-08 published: 2026-11-04
- [S12] Yang et al., "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering", arXiv:2405.15793, https://arxiv.org/abs/2405.15793; only the abstract as recorded in R4 [S1], not reopened here - accessed: 2026-11-08 published: 2024-05-06
- [S13] Bui, "Building Effective AI Coding Agents for the Terminal: Scaffolding, Harness, Context Engineering, and Lessons Learned", arXiv:2603.05344, https://arxiv.org/abs/2603.05344; only as recorded in R4 [S13], not reopened here - accessed: 2026-11-08 published: 2026-03-05
- [S14] weftwork briefs R0 (discovery sweep), R1 (GSD), R2 (bigpowers), R3 (workflow landscape) and R14 (legacy retrospective) in `docs/research/`, for the forward links they leave for R5 - accessed: 2026-11-08 published: 2026-11-08

## Method

I installed nothing and ran no workflow. Versions read: pi 1.5.0, Claude Code 2.1.319, opencode 1.19.5 and Codex CLI 0.167.0 were installed here and I read their docs at or near those versions [S2][S6][S8][S10]. The Gemini CLI row rests on the docs of release v0.67.0 alone, because the tool is not installed here [S11]. I fetched every doc page myself with curl or `gh api`, so none of it comes through a summarizing subagent. Where a docs page said nothing, a cell says so: "not found" means absent from the pages listed in Sources, not proof that the feature does not exist. The pi-subagents package and the pi-flow-legacy spikes were read, but I did not run pi-subagents myself [S3][S4]. No subagents were used for this brief. Living docs have no publication date, so their sources show `published: undated` or the date of the release read.

## Capability matrix

| Capability | pi | Claude Code | opencode | Codex CLI | Gemini CLI |
| --- | --- | --- | --- | --- | --- |
| Hooks | In-process TypeScript extension events; a `tool_call` handler can return `{ block: true, reason }` to stop a call [S1] | Command, HTTP, prompt and agent hooks on dozens of events (`PreToolUse`, `SubagentStart`, `WorktreeCreate`, ...); exit code 2 blocks [S5] | JS/TS plugin hooks such as `tool.execute.before`; the docs example throws an Error to stop a `.env` read [S7] | Command and MCP-tool hooks on events including `PreToolUse`, `PermissionRequest`, `SubagentStart`; `permissionDecision: "deny"` blocks; hooks must be trusted first [S9][S10] | Command hooks on events including `BeforeTool` and `BeforeModel`; exit code 2 blocks the tool [S11] |
| Subagents | Not built in ("skips features like sub-agents and plan mode"); the `pi-subagents` package, installed here, adds them [S1][S2][S3] | Built in; Markdown definitions with frontmatter; built-in agents such as Explore [S5] | Built in; primary agents and subagents; General and Explore ship with it; `@` mention invokes one [S7] | Built in; spawned on request, plus custom agent files in `.codex/agents/` or `~/.codex/agents/` [S9] | Built in (`codebase_investigator`, `cli_help`); custom agents in `.gemini/agents/*.md` [S11] |
| Skills | `SKILL.md` per the Agent Skills spec; only name and description go in the system prompt, the body loads on demand [S1] | `SKILL.md`; custom commands were merged into skills; frontmatter can set `model`, `effort`, `context: fork` [S5] | `SKILL.md` with required frontmatter [S7] | Directory with `SKILL.md`, `name` and `description` required; the initial skills list has a size budget [S9] | `SKILL.md`; the body and folder structure are added to the conversation when activated [S11] |
| Plugins | Pi packages from npm, git or a local path bundle extensions, skills, prompt templates and themes; `pi install` [S1][S2] | Plugin directory with `.claude-plugin/plugin.json` bundling skills, agents, hooks and MCP servers; marketplaces [S5] | JS/TS plugins in `.opencode/plugins/` or from npm; `opencode plugin <module>` [S7][S8] | Plugins from marketplaces: `codex plugin add`, `list`, `marketplace`; a plugin can bundle skills, apps and hooks [S9][S10] | Extensions package prompts, MCP servers, commands, themes, hooks, subagents and skills [S11] |
| Worktrees | Not found in the 14 pages read; no worktree option in `pi --help` [S1][S2] | `--worktree`; subagent `isolation: worktree`; `WorktreeCreate` and `WorktreeRemove` hooks [S5] | No worktree command found; plugins receive the `worktree` path as context [S7] | `codex exec --worktree` and `/worktree` start a managed Git worktree; local only, not with `resume` [S9] | Experimental; off until `experimental.worktrees` is set to true [S11] |
| Ask-user path | Extension API `ctx.ui.select`, `confirm` and `input`; no built-in model-callable question tool found [S1] | `AskUserQuestion` tool; a `PreToolUse` hook can answer it; in `-p` runs only with a permission host [S5] | `question` tool, governed by the permissions system [S7] | Approval prompts (`--ask-for-approval on-request`); the feature flag `default_mode_request_user_input` is under development and off [S9][S10] | `ask_user` tool with multiple-choice, free-text and yes/no questions [S11] |
| Per-dispatch model | `--model` per process; with pi-subagents, agent frontmatter `model`, `agentOverrides` and `subagents.defaultModel` [S2][S3] | Agent-call `model` alias, then subagent frontmatter `model`, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the session model [S5] | Agent `model` in `provider/model` form, in JSON config or agent Markdown [S7] | Explicit spawn request, `[agents]` defaults in `config.toml`, or `model` in the custom agent file; unset inherits the parent [S9] | Subagent frontmatter `model`, default `inherit`; `agents.overrides` in settings [S11] |
| Per-dispatch effort | `--thinking` (off to max); with pi-subagents a `thinking` setting or a `model:level` suffix [S2][S3] | `effort` in subagent and skill frontmatter, overriding the session level [S5] | `reasoningEffort` agent option, passed to providers that support it such as OpenAI reasoning models [S7] | `model_reasoning_effort` in the agent file, a spawn request or `[agents]` defaults [S9] | Not in subagent frontmatter (`model`, `temperature`, `max_turns`, `timeout_mins`); `thinkingConfig` only in settings `modelConfigs` [S11] |
| Instruction files | Reads `AGENTS.override.md`, `AGENTS.md` and `CLAUDE.md`; loaded even when project trust is declined; `--no-context-files` turns it off [S1][S2] | `CLAUDE.md`; reads `AGENTS.md` only when no `CLAUDE.md` exists above the working directory (v2.1.277 or later), or via an import [S5] | `AGENTS.md`; falls back to `CLAUDE.md` when no `AGENTS.md` exists [S7] | `AGENTS.override.md` or `AGENTS.md`, global then each directory down to the working directory, 32 KiB cap by default [S9] | `GEMINI.md` by default; `AGENTS.md` only if `context.fileName` lists it [S11] |
| Skill files | Pi's own locations plus `~/.agents/skills/` and `.agents/skills/` [S1] | `.claude/skills/<name>/SKILL.md` and `~/.claude/skills/`; `.agents/skills` not mentioned in the pages read [S5] | `.opencode/skills/`, `.claude/skills/` and `.agents/skills/`, project and global [S7] | `.agents/skills` in every directory from the working directory up to the repository root, plus user, admin and system locations [S9] | `.gemini/skills/` or `.agents/skills/`; the `.agents/skills/` alias wins [S11] |

## Instruction and skill files

- **pi** reads committed `AGENTS.md` and `CLAUDE.md` files and `AGENTS.override.md`, and finds skills in `.agents/skills/` as well as its own locations; project-local `.pi` resources load only after the project is trusted, but context files load regardless [S1].
- **Claude Code** reads a committed `CLAUDE.md`; a project with only `AGENTS.md` works from v2.1.277, but any `CLAUDE.md` above the working directory wins, so a `CLAUDE.md` that imports `AGENTS.md` is the documented way to share one file [S5].
- **opencode** reads a committed `AGENTS.md`, which `/init` generates or improves in place, and uses `CLAUDE.md` and `~/.claude/skills/` as fallbacks unless `OPENCODE_DISABLE_CLAUDE_CODE` is set [S7].
- **Codex CLI** reads committed `AGENTS.md` files in a chain from the Git root down, with `AGENTS.override.md` taking precedence at each level, and reads committed skills from `.agents/skills` [S9].
- **Gemini CLI** reads a committed `GEMINI.md`; a project must set `context.fileName` in `settings.json` to make it read `AGENTS.md`, and its skills live in `.gemini/skills/` or `.agents/skills/` [S11].

None of the five vendor pages describes a managed block, a fenced region that a tool rewrites inside a shared file. Managed blocks are a convention of the bigpowers project (`AGENTS.md` fences, per CONVENTIONS.md), not a host feature. The vendor mechanisms for sharing one source file are generation (`/init` in opencode) or an `@` import (Claude Code), and committing the same file to a path several hosts read [S5][S7].

## Shared core

- Skills as a directory with a `SKILL.md` that has `name` and `description` frontmatter are supported by all five hosts, and in all five the name and description are listed up front while the body loads on demand [S1][S5][S7][S9][S11]. Two limits: Codex CLI caps its initial list at 2% of the context window and may omit skills from it, and Claude Code drops a skill's description from context when `disable-model-invocation` is set [S5][S9].
- The path `.agents/skills/` is read by pi, opencode, Codex CLI and Gemini CLI; Claude Code's pages read here name only `.claude/skills/`, and opencode reads that path as well [S1][S5][S7][S9][S11].
- A project instruction file named `AGENTS.md` is read by pi, opencode and Codex CLI by default, by Claude Code when no `CLAUDE.md` exists, and by Gemini CLI only after a setting change [S1][S5][S7][S9][S11].
- A hook that can block a tool call exists in all five hosts, in two families: out-of-process command hooks that exchange JSON and an exit code (Claude Code, Codex CLI, Gemini CLI) and in-process TypeScript modules (pi, opencode) [S1][S5][S7][S9][S11].
- Subagents with their own model are native in four hosts and come from a package in pi; an effort setting per subagent is native in Claude Code and Codex CLI, comes from an agent option in opencode, from a package in pi, and is missing from Gemini CLI's subagent fields [S3][S5][S7][S9][S11].
- MCP servers are managed from the command line in pi (`pi mcp`), opencode (`opencode mcp`) and Codex CLI (`codex mcp`), and Claude Code and Gemini CLI documentation mention MCP servers per agent [S2][S5][S8][S10][S11].

Gaps an adapter would have to fill: worktree creation (native only in Claude Code, Codex CLI and, experimentally, Gemini CLI), a model-callable ask-user tool (missing in Codex CLI and, as a built-in, in pi), an effort field in Gemini CLI, and any common format for subagent definitions, hook configuration and plugins [S1][S5][S7][S9][S11].

## Verdicts

- H8: refined - the portable core is smaller than "AGENTS.md, SKILL.md, plain YAML/markdown": `SKILL.md` is common to all five, but `AGENTS.md` is read by default in only three hosts, and subagent, hook and plugin formats differ in every host (Markdown frontmatter, TypeScript modules, JSON, config keys), so only the two file names are portable artifacts [S1][S5][S7][S9][S11]. Skill discovery paths also differ: `.agents/skills/` works in four hosts and not in the Claude Code pages read [S5][S9].
- H9: refined - composing the hosts' machinery is feasible for subagents, which are native in four hosts and a package in pi [S1][S3][S5][S7][S9][S11], but not for worktrees, which are native in three hosts and absent in two [S5][S9][S11]; an adapter must therefore create worktrees itself with `git worktree add` or use the host's. The legacy spikes show that a harness can reach a pi child agent through a settings key without editing agent files, which supports composition on pi but rests on one owner's measurement of a third-party package [S4]. The paper evidence is thin: SWE-agent finds that interface design changes agent results, so an adapter may not be neutral, which is an inference from an abstract [S12].
- H16: refined - an engine plus thin adapters is plausible because every host has a blocking tool-call hook and reads `SKILL.md` [S1][S5][S7][S9][S11], but the adapters are not equally thin: three hosts call an out-of-process command with JSON and an exit code, and two load in-process TypeScript, so one command-line engine serves the first family directly and the second only through a small wrapper [S1][S5][S7][S9][S11]. R0 found one project whose gates are advisory outside Claude Code, which fits this limit [S14]. Bui describes a terminal agent built from scaffolding, a harness and context engineering, which names the same layers but does not test the split [S13].

None is `confirmed`: no source I read tests an engine-plus-adapters design against another. None is `refuted`: each hypothesis holds for part of the core.

## Implications for weftwork

- Treat `AGENTS.md` and `SKILL.md` under `.agents/skills/` as the portable surface, and ship a `CLAUDE.md` that imports `AGENTS.md` so Claude Code reads both, because any `CLAUDE.md` above the working directory hides `AGENTS.md` [S5].
- Make the engine a command-line program that reads JSON on stdin and answers with an exit code; Claude Code, Codex CLI and Gemini CLI can call it from a hook, and pi and opencode need a small TypeScript wrapper that shells out to it [S1][S5][S7][S9][S11].
- Do not rely on a host to create worktrees or ask questions. Create worktrees in the engine, and route questions through the engine's own output when a host has no model-callable ask-user tool [S1][S9].
- Choose effort per dispatch through the host's field where one exists (Claude Code, Codex CLI, pi through pi-subagents) and record where it is missing (Gemini CLI) [S3][S5][S9][S11].
- Pin the host versions in the adapter tests; the Codex docs now live on learn.chatgpt.com and the repository pages only link there, and the opencode `dev` docs already differ from the installed tag [S7][S9].

## Earns its place vs ceremony

- Earns its place: a `SKILL.md` skill catalog under `.agents/skills/`, because all five hosts load it on demand and pay only for the listing [S1][S5][S7][S9][S11].
- Earns its place: one blocking tool-call hook as the evidence gate, because all five hosts offer it [S1][S5][S7][S9][S11].
- Ceremony until proven: a per-host subagent definition file generated for all five hosts. The formats differ, and the pi row depends on a third-party package [S3].
- Ceremony until proven: managed blocks inside `AGENTS.md`. No vendor documents them, and I have no evidence they help any host [S5][S7][S9].

## Open questions

- Does the always-loaded skill listing cost the same tokens in each host? R3 left this as a candidate story with R5; I did not measure it, and no page I read gives numbers [S14]. Candidate story: measure the listing in pi and Claude Code, the two hosts installed here.
- I did not find the survey "Code as Agent Harness" that SCOPE_LATEST.yaml lists: an arXiv title search returned no entries and the Semantic Scholar query was rate limited. The H9 and H16 verdicts therefore cite no survey of harness design [S12][S13]. Candidate story: locate it and read it for R13.
- Does Claude Code read `.agents/skills/`? The pages I read name only `.claude/skills/`; a run on a scratch skill would settle it [S5].
- Does the Codex ask-user flag `default_mode_request_user_input` ship, and what does it do? I only saw its name and status [S10].
- Do the pi-subagents `model` and `thinking` settings behave as the docs say, and does a settings-key guard still reach every child in v0.87.0? The spike used v0.79.0 [S3][S4].
- Kiro, Cline, Aider and Cursor are outside the five hosts named; whether they read `AGENTS.md` and `.agents/skills/` decides how wide the shared core is.
- Gemini CLI row: no local check was possible; read once by someone with the tool installed.
