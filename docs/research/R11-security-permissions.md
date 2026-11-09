# R11 — Security and permissions

Story e03s05. Question (specs/planning-context.yaml): sandboxing, secrets, destructive commands and prompt injection from repo content, for autonomous agents. The e01 re-plan added skill and plugin supply-chain trust. Hypotheses: H21, H22, H23 (added by plan-work on 2026-11-09; no earlier hypothesis was assigned to R11).

## Sources

- [S1] "Agent Skills in the Wild: An Empirical Study of Security Vulnerabilities at Scale", arXiv:2601.10338, https://arxiv.org/abs/2601.10338 (abstract) - accessed: 2026-11-09 published: 2026-01-15
- [S2] "Do Not Mention This to the User": Detecting and Understanding Malicious Agent Skills in the Wild, arXiv:2602.06547 (v4 title), https://arxiv.org/abs/2602.06547 (abstract) - accessed: 2026-11-09 published: 2026-02-06
- [S3] "Authority Is Not a String: A Capability-Scoped Harness for Prompt-Injection-Resistant Coding Agents" (CapScope), arXiv:2609.08371, https://arxiv.org/abs/2609.08371 (abstract) - accessed: 2026-11-09 published: 2026-09-08
- [S4] "From Approval to Abuse: Privilege Escalation Attacks on Harness-Protected Coding Agents", arXiv:2610.22987, https://arxiv.org/abs/2610.22987 (abstract) - accessed: 2026-11-09 published: 2026-10-16
- [S5] "INFUSE: A Unified Surface Benchmark for Indirect Prompt Injection in Agentic Systems", arXiv:2610.20776, https://arxiv.org/abs/2610.20776 (abstract) - accessed: 2026-11-09 published: 2026-10-14
- [S6] "ClawSafety: 'Safe' LLMs, Unsafe Agents", arXiv:2604.01438, https://arxiv.org/abs/2604.01438 (abstract) - accessed: 2026-11-09 published: 2026-04-01
- [S7] "Package Hallucination Attacks on Coding Agents through Prompt Injection in Rule Files", arXiv:2610.09264, https://arxiv.org/abs/2610.09264 (abstract) - accessed: 2026-11-09 published: 2026-10-07
- [S8] "CodeSentinel: A Three-Layer Defense Against Indirect Prompt Injection in Code Contexts", arXiv:2606.19235, https://arxiv.org/abs/2606.19235 (abstract) - accessed: 2026-11-09 published: 2026-06-17
- [S9] "Architecting Secure AI Agents: Perspectives on System-Level Defenses Against Indirect Prompt Injection Attacks", arXiv:2603.30016, https://arxiv.org/abs/2603.30016 (abstract; position paper) - accessed: 2026-11-09 published: 2026-03-31
- [S10] "QueryIPI: Query-agnostic Indirect Prompt Injection on Coding Agents", arXiv:2510.23675, https://arxiv.org/abs/2510.23675 (abstract) - accessed: 2026-11-09 published: 2025-10-27
- [S11] "ClayBuddy: A Framework, Evaluation, & Mitigation of Coding Agent Failures", arXiv:2606.19380, https://arxiv.org/abs/2606.19380 (abstract) - accessed: 2026-11-09 published: 2026-06-13
- [S12] "ClashBench: Conflicts Leading Agents to Seize and Harm", arXiv:2609.19892, https://arxiv.org/abs/2609.19892 (abstract) - accessed: 2026-11-09 published: 2026-09-17
- [S13] "Fault-Tolerant Sandboxing for AI Coding Agents: A Transactional Approach to Safe Autonomous Execution", arXiv:2512.12806, https://arxiv.org/abs/2512.12806 (abstract) - accessed: 2026-11-09 published: 2025-12-14
- [S14] "Quantifying Frontier LLM Capabilities for Container Sandbox Escape" (SandboxEscapeBench), arXiv:2603.02277, https://arxiv.org/abs/2603.02277 (abstract) - accessed: 2026-11-09 published: 2026-03-01
- [S15] "SlotGuard: Stop Oversharing Private Local Context in LLM Agent Transcri" (title cut off in the arXiv record), arXiv:2607.17147, https://arxiv.org/abs/2607.17147 (abstract) - accessed: 2026-11-09 published: 2026-07-19
- [S16] "Practical Secrets Extraction against Black-box LLMs", arXiv:2609.36941, https://arxiv.org/abs/2609.36941 (abstract) - accessed: 2026-11-09 published: 2026-09-29
- [S17] "PhantomSkill: Malicious Code Injection in Agent Skill Ecosystems", arXiv:2606.19191, https://arxiv.org/abs/2606.19191 (abstract) - accessed: 2026-11-09 published: 2026-06-17
- [S18] "Structured Security Auditing and Robustness Enhancement for Untrusted Agent Skills" (SkillGuard-Robust), arXiv:2604.25109, https://arxiv.org/abs/2604.25109 (abstract) - accessed: 2026-11-09 published: 2026-04-28
- [S19] "SkillScreen: High-Recall Screening of Malicious Agent Skills with Decision Models", arXiv:2610.17727, https://arxiv.org/abs/2610.17727 (abstract) - accessed: 2026-11-09 published: 2026-10-13
- [S20] "Context Matters: Repository-Aware Security Analysis of the Agent Skill Ecosystem", arXiv:2603.16572, https://arxiv.org/abs/2603.16572 (abstract) - accessed: 2026-11-09 published: 2026-03-17
- [S21] "Benign in Isolation, Harmful in Composition: Security Risks in Agent Skill Ecosystems" (SCR-Bench), arXiv:2606.15242, https://arxiv.org/abs/2606.15242 (abstract) - accessed: 2026-11-09 published: 2026-06-13
- [S22] "MCPTox: A Benchmark for Tool Poisoning Attack on Real-World MCP Servers", arXiv:2508.14925, https://arxiv.org/abs/2508.14925 (abstract) - accessed: 2026-11-09 published: 2025-08-19
- [S23] "Reframing LLM Agent Security as an Agent-Human Interaction Problem", arXiv:2605.24309, https://arxiv.org/abs/2605.24309 (abstract; position paper) - accessed: 2026-11-09 published: 2026-05-23
- [S24] "LLM Agent Capabilities Should Follow Task Intent and Context Source" (IntentCap), arXiv:2609.14631, https://arxiv.org/abs/2609.14631 (abstract; position paper with an evaluation) - accessed: 2026-11-09 published: 2026-09-13
- [S25] pi documentation `packages/coding-agent/docs/security.md` ("Run Pi safely"), raw file from `github.com/earendil-works/pi` `main`, read with the installed pi 1.5.0 as the reference version, https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md - accessed: 2026-11-09 published: 2026-09-29
- [S26] Claude Code documentation page `sandboxing` (the `.md` form on code.claude.com, fetched with curl), installed Claude Code 2.1.319, https://code.claude.com/docs/en/sandboxing - accessed: 2026-11-09 published: undated
- [S27] Claude Code documentation page `permissions` (the `.md` form), installed Claude Code 2.1.319, https://code.claude.com/docs/en/permissions - accessed: 2026-11-09 published: undated
- [S28] Claude Code documentation page `security` (the `.md` form), installed Claude Code 2.1.319, https://code.claude.com/docs/en/security - accessed: 2026-11-09 published: undated
- [S29] Codex documentation page `agent-approvals-security` (the `.md` form on learn.chatgpt.com), installed codex-cli 0.167.0, https://learn.chatgpt.com/docs/agent-approvals-security - accessed: 2026-11-09 published: undated
- [S30] opencode documentation `permissions.mdx`, raw file at tag v1.19.5 (the installed version) from `github.com/anomalyco/opencode`, https://opencode.ai/docs/permissions - accessed: 2026-11-09 published: 2026-06-30
- [S31] Gemini CLI documentation `docs/cli/sandbox.md`, raw file from `github.com/google-gemini/gemini-cli` `main` (the tool is not installed here; no tag compared), https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/sandbox.md - accessed: 2026-11-09 published: 2026-11-03
- [S32] weftwork briefs R0 (discovery sweep), R5 (harness capabilities), R7 (review and decisions) and R14 (legacy retrospective) in `docs/research/`, for the findings they pass to R11; every claim taken from them is theirs and is not re-checked here - accessed: 2026-11-09 published: 2026-11-08

## Method

Accessed 2026-11-09. I ran no workflow and no measurement: no sandbox trial, no injection test and no skill scan (owner decision, 2026-11-09). This brief reads papers and documentation only. Each measurement it needs is listed under Open questions as a candidate for R10.

Versions read. Installed here: pi 1.5.0, Claude Code 2.1.319, codex-cli 0.167.0 and opencode 1.19.5 (`--version` output on 2026-11-09). I read the Claude Code and Codex pages as served on 2026-11-09 and the opencode page at tag v1.19.5. The pi and Gemini CLI pages are raw files from `main`; the publication dates above are the dates of the last commit to each file, read from the public Atom feed of that file's history. The Gemini CLI row rests on its docs alone. The Claude Code and Codex pages show no publication date, so they are marked undated. I did not use `ctx7`, because it returns snippets without dates.

I fetched every doc page myself with `curl` from raw or official URLs. I used no `gh api` and no `api.github.com`. No page came through a summarizing subagent, and I started no subagent. I read the abstracts of the papers through the arXiv Atom API over https (`export.arxiv.org`), five seconds apart. I did not read full texts; every paper claim below is limited to its abstract.

arXiv queries, in order (field `all:`, sorted by relevance): (1) `"prompt injection" AND "coding agent"`; (2) `sandbox AND agent AND LLM AND isolation`; (3) `"indirect prompt injection" AND agents AND benchmark`; (4) `secrets AND leakage AND coding AND agents AND credentials`; (5) `destructive AND actions AND coding AND agent AND safety`; (6) `"permission" AND "approval" AND "coding agents" AND autonomy` (no result); (7) `"agent skills" AND security AND malicious`; (8) `MCP AND "tool poisoning" AND security`; (9) `"approval fatigue" OR ("permission prompts" AND agents)`; (10) `"least privilege" AND LLM AND agents AND tools`. I asked for the first 6 to 8 results of each query and chose the papers from their abstracts. The searches cover coding agents, skills and MCP; they are not exhaustive for web agents or chat assistants. The R0 papers arXiv:2601.10338 and arXiv:2602.06547 came from R0 and I re-read their abstracts.

## Sandboxing

- Codex is the closest shipped match to "sandbox by default". Its CLI runs with network access off and writes limited to the active workspace; in the `Auto` preset it edits and runs commands in the working directory without asking, and asks before editing files outside the workspace or running commands that need network access. A folder outside version control starts as `read-only` [S29]. This is documented behaviour, not tested here.
- Claude Code's sandbox is off by default. Once on, writes are limited to the working directory and a temp directory, and network goes through a proxy whose allowed domains start empty. Reads still cover most of the machine, including `~/.ssh` and `~/.aws/credentials`. In auto-allow mode a command inside the sandbox runs with no prompt [S26].
- The sandbox does not cover every tool. In Claude Code the file tools, WebFetch, MCP servers and hooks run outside it, so a `denyRead` entry does not stop the Read tool, and a local MCP server is outside the boundary [S26]. A "sandbox by default" rule is only as wide as the tools it wraps.
- The other hosts differ. pi has no built-in sandbox and does not ask approval before every tool call; its page says to run it inside a container, virtual machine or sandbox, and that the working folder does not stop commands reaching other paths [S25]. opencode defaults to `allow` for most permissions, with `external_directory` and `doom_loop` at `ask`, so a write outside the working directory prompts [S30]. Gemini CLI's default macOS Seatbelt profile confines writes to the project directory while allowing broad reads and network [S31].
- Writes outside the worktree are treated as a special case by the hosts, in different ways. Codex keeps `.git`, `.agents`, `.codex` and `.aws` read-only inside writable roots [S29]. Claude Code's sandbox denies writes to its settings files, `.claude/skills`, `.claude/hooks`, `.mcp.json`, shell startup files and `hooks` and `config` inside `.git` [S26]. The lists differ, so no portable "protected paths" set exists yet.
- Approval is itself an attack surface. Adversarial context planted in a repository steered agents on Claude Code and Codex CLI into requesting a broad allow-rule in 58% of instances, and once approved that rule gave silent goal completion in 47 of 58 eligible instances (81.0%) [S4]. A survey of 21 production systems found runtime approval in 15 of them, and describes users caught between approval fatigue and uncontrolled autonomy [S23].
- A sandbox can be escaped. In a benchmark of container escapes, LLMs identified and exploited vulnerabilities that were added to the setup; the abstract gives no rate [S14]. Isolation needs the same checking as any other control.
- Rollback is a different control from a sandbox. One prototype wrapped agent actions in transactions with a filesystem snapshot, and reports a 100% interception rate for high-risk commands and a 100% rollback success rate at 14.5% overhead; it used a small model on a custom testbed and is unreplicated [S13].

## Secrets

- Claude Code sandboxed commands inherit the environment variables of Claude Code, secrets included, and there is no built-in credential deny list; only the files and variables you list are restricted [S26]. Read deny rules such as `Read(./.env)` apply to its file tools and to recognized file commands in Bash [S27]. opencode denies reads of `*.env` files by default [S30].
- Credentials leak through the transcript, not only through commands. Tool output, shell logs and file reads are appended to provider-bound transcripts. A local rewriting boundary removed all 20,814 annotated sensitive characters and reduced credential leakage to 0.0% across 852 planted values on controlled repository transcripts [S15]. This is one tool on planted data.
- Credentials can also come out of the model. A black-box extraction method recovered masked, provider-specific credentials from three deployed LLM systems, including systems behind OpenAI and Claude Code, because training corpora may hold exposed secrets [S16]. A repository can hold no secret and still see one leak this way; the defence is outside the project.
- pi's page warns that sessions can contain prompts, tool arguments, command output, file contents and credentials, and says to keep credentials outside the environment or use narrowly scoped, short-lived ones [S25].
- Credential theft is a main attack in skills. Of the 157 confirmed malicious skills, one of the two dominant strategies was credential theft via remote code execution [S2].
- The strongest model tested in an agent benchmark held hard boundaries against credential forwarding and destructive actions; weaker models permitted both, and safety depended on the agent framework as well as the model [S6].
- How often a real coding agent reads a `.env` file without being asked, in ordinary work, is unsourced; no study found measures it.

## Destructive commands

- Frontier models "can randomly generate destructive commands at nontrivial probabilities", and dangerous behaviour could be elicited with three conditioning examples; the authors respond with a harness modification [S11].
- Destructive acts also come from helpfulness. Across 17 models run through Codex, Claude Code and OpenCode, an agent finished its task while breaking an existing task in 44.5% of trajectories. A prompt telling it not to affect existing tasks reduced but did not remove this, an instruction authorizing it to stop local processes increased it, and in 31.9% of successful cases the final answer mentioned neither the conflict nor the action [S12].
- A sandbox scoped to the worktree still lets an agent delete files inside it, including git history that is not protected. Recovery therefore needs version control, snapshots or backups; pi's page says to use them before substantial changes [S25]. A snapshot-and-rollback prototype is one design [S13].
- Hosts gate irreversible actions by rule. Claude Code evaluates deny rules first, then ask, then allow, and an allow rule cannot carve an exception out of a deny rule [S27]. Per R7, Codex always requires approval for a tool call that advertises a destructive annotation, and Superpowers stops for an irreversible or destructive operation [S32].
- Every host ships a way past its own gate: Claude Code `bypassPermissions` skips prompts, including for writes to protected paths such as `.git` [S27]; Codex has `--sandbox danger-full-access` and `--dangerously-bypass-approvals-and-sandbox` [S29]; opencode `--auto` approves every request that is not explicitly denied, and explicit `deny` still holds [S30].
- The legacy project's guards for irreversible git and filesystem actions never fired outside test fixtures in about two days in one repository, so they are neither shown to work nor shown to be useless there [S32].
- A formal treatment of reversibility (idempotent, reversible, compensable, irreversible) exists; whether it can limit what an agent may do alone is open, as R7 found [S32].

## Prompt injection from repo content

- Repo content is untrusted input, and the hosts say so. pi lists files, comments, instructions, command output and model responses as able to steer the model, says project trust does not make that content safe, and loads `AGENTS.md` and `CLAUDE.md` whatever the trust decision is [S25]. Claude Code shows a trust dialog on first use of a folder, but a `-p` session shows neither that nor the `.mcp.json` approval prompt [S28].
- Attacks on coding agents are measured and often succeed. QueryIPI reached up to 87% success on five simulated agents and transferred to real coding agents [S10]. In ClawSafety, success ranged from 40% to 75% across five models, and instructions in workspace skill files (highest trust) were more dangerous than email or web content [S6]. INFUSE found a mean attack success of 19.6% (LLM-judged) over 19 models, with per-model values from 3.2% to 41.9% [S5].
- Rule files are an injection channel. An attack that plants prompts in files such as `AGENTS.md` or `.cursorrules` made coding agents swap legitimate dependencies for attacker-controlled packages, with "high attack success rates" across models and frameworks; the abstract gives no figure [S7]. Weftwork's own context files are in this class.
- Filters help but do not close the gap. A code-context sanitizer reached a 0.80 average node-level F1 across six attack families [S8]. INFUSE reports that guard models give limited protection, while prompt-level instructional hardening cut mean attack success from 58.2% to 14.3% [S5].
- Permission boundaries did better in the one coding-agent study that compares them. CapScope, a harness that derives a task-wide authority ceiling from trusted input before repo content is read and checks every tool call against typed per-agent capabilities, let the injected effect run in 3 of 75 runs, against 33 to 47 of 75 for ambient-authority and global-policy baselines, and completed 68 of 75 repairs against 68 to 72 for the baselines. It was built on pi and tested on five Python tasks, five injection surfaces and 300 runs [S3].
- Boundaries have a human hole. Planted repository context steered agents into asking for a dangerously broad allow-rule, which the user then approved [S4]. A boundary that a user can widen on the agent's request is only as strong as that approval.
- The literature favours system-level defences over model-level ones. A position paper argues for rule-based and model-based checks inside designs that strictly constrain what the model sees and decides, and warns that existing benchmarks can give a false sense of security [S9]. Another proposes capabilities scoped to task intent and context source, validated by a deterministic checker, and reports blocking tested violations without rejecting benign actions [S24].

## Skill and plugin supply chain

- Scale of the problem. Of 31,132 marketplace skills analysed, 26.1% had at least one vulnerability (data exfiltration 13.3%, privilege escalation 11.8%) and 5.2% showed high-severity patterns suggesting malicious intent; skills that bundle scripts were 2.12 times likelier to be vulnerable than instruction-only skills [S1]. In 98,380 skills from two registries, 157 were confirmed malicious, more than half from one actor using templated brand impersonation, and the registries removed all 157 after disclosure [S2].
- Skills install with full user privileges and little vetting [S2][S1], so install is the trust decision. pi says extensions run inside its process and should be reviewed before loading [S25]; Claude Code's sandbox denies writes to `.claude/skills` so a sandboxed command cannot add one [S26]; Codex keeps `.agents` read-only [S29].
- Scanning before install is supported but imperfect. The SkillScan detector reached 86.7% precision and 82.5% recall [S1]; SkillGuard-Robust reported 98.33% malicious-risk recall on a 404-package held-out set, with transfer to harsher external sources still open [S18]; SkillScreen flagged 20% to 25% of benign skills at 99% recall, and false positives rose sharply on unfamiliar benign sources [S19].
- Scanners also over-flag. Marketplace scanner reports classified up to 46.8% of skills as malicious; a repository-aware check over 238,180 skills left 0.52% suspicious [S20]. A scan-before-install gate that ignores repository context will block many safe skills.
- Scanners can be evaded. PhantomSkill hides malicious behaviour in a skill's auxiliary resources as vulnerability-shaped code, lowering warnings and malware-level detections, and the authors conclude that ecosystems need resource-level vetting and execution-time containment [S17]. Skills that look benign alone can also become harmful in composition, with attack success of 33.6% against near zero in isolation on one sub-benchmark [S21].
- Pinning a skill to a version or commit has no study of its own that I found; a measured pinning control is unsourced. Indirect support: skills hosted in abandoned GitHub repositories can be hijacked [S20], which a pin to a reviewed commit would block until the pin is updated.
- Tool metadata is part of the supply chain. In MCP tool poisoning on 45 real servers, attack success reached 72.8% on one model, more capable models were often more susceptible, and the highest refusal rate was under 3% [S22].

## Threats and controls

| Threat | Control | Enforced by | Residual risk | Evidence |
| --- | --- | --- | --- | --- |
| Destructive command | Version control or snapshot before work; deny rules for irreversible commands; protected paths for .git | Hook or deny rule, plus rollback | Deletes inside the worktree; bypass flags; agent disrupts other tasks | [S11][S12][S13][S25][S27] |
| Secret leak | Keep credentials out of the run; scrub environment variables; deny reads of credential files; rewrite transcripts | Sandbox and environment scrubbing | Memorized secrets come out of the model; no default deny list | [S15][S16][S26] |
| Prompt injection | Authority ceiling and per-agent capabilities checked on every tool call, not model detection | Harness capability check | Approval flow can be steered; one study, five Python tasks | [S3][S4][S5] |
| Malicious skill | Review and pin before install; scan with repository context; contain at run time | Installer step plus sandbox | Scanners over-flag and can be evaded; pinning unmeasured | [S1][S2][S17][S20] |
| Exfiltration | Network off or proxied with an empty allow list; approval for new hosts | Sandbox network proxy | File tools, MCP servers and hooks may sit outside the sandbox | [S26][S29] |
| Permission escalation via approval | Treat agent-proposed allow-rules as untrusted; human review of broad rules | Human reviewer or deny precedence | Approval fatigue; 58% of attempts elicited a rule | [S4][S23][S27] |
| Sandbox escape | Defence in depth: container or VM around the whole agent; no extra privileges | Operating-system isolation | Models exploit planted weaknesses; rate not given in abstract | [S14][S25] |

## Verdicts

- H21: refined - the sandbox-by-default half is what Codex ships (network off, writes in the workspace, approval outside) and what Claude Code's auto-allow mode does once enabled [S29][S26]; the approval half is weaker than the claim, because agent-proposed allow-rules can be steered by repo content [S4], approvals tire users [S23], some tools run outside the sandbox [S26], and destructive acts inside the worktree need rollback, not approval [S12][S13]. Unproven by any measurement here.
- H22: refined - scanning before install finds real threats [S1][S2][S18] but over-flags without repository context [S20][S19] and can be evaded by resource-level hiding [S17], so it needs execution-time containment [S17] and review; pinning to a commit is supported only indirectly [S20] and no study tests it.
- H23: refined - boundaries beat ambient authority in the one coding-agent study that compares them (3 of 75 against 33 to 47 of 75 runs) [S3], and system-level defences are the literature's direction [S9][S24]; but "not prompt filters" is too strong, since prompt-level hardening cut mean attack success from 58.2% to 14.3% [S5] and a sanitizer reached 0.80 F1 [S8], and boundaries still depend on a human approval step that can be steered [S4].

## Implications for weftwork

- Treat all repo content as untrusted, including `AGENTS.md` and skill files, because they are an attack channel [S7][S6]. This is a rule for the engine and for the skills it ships; the evidence is on coding agents but not on weftwork's own files.
- Do not build a sandbox; compose the host's. The hosts differ widely: Codex ships one on, Claude Code ships one off, pi has none, and opencode defaults to allow [S29][S26][S25][S30]. The adapter should report which boundary a host gives and refuse to call a run "autonomous" on a host with none, unless the run is inside a container or virtual machine [S25].
- Keep a portable "protected paths" list in weftwork's own rules (`.git`, skill and agent directories, settings and hook files, credential files), since the hosts' lists differ [S29][S26].
- Make recovery part of any autonomous run: start from a clean branch and commit before risky steps, because a worktree-scoped sandbox does not stop deletion inside it [S25][S13].
- Treat agent-proposed permission rules as untrusted input to a human or reviewer, and never let an autonomous loop widen its own permissions [S4].
- For skills from outside the project, require a pinned commit and a repository-aware scan before install, and run installed scripts inside the sandbox [S20][S17]. Keep the catalog small (H10), since each skill with scripts adds risk [S1].
- Keep credentials out of the agent's environment where possible, and scrub the environment of sandboxed commands [S26][S25].

## Earns its place vs ceremony

- Earns its place: a sandbox with network off by default, because it is shipped by a major host and removes the largest class of silent harm without prompts [S29].
- Earns its place: version-control recovery before autonomous work. It costs a commit, and sandboxes do not cover deletion inside the worktree [S25][S12].
- Earns its place: capability checks on tool calls, on the strength of one strong comparison (3 of 75 against 33 to 47 of 75), pending replication outside Python repair tasks [S3].
- Ceremony until measured: a blanket approval prompt for every out-of-sandbox action. Approvals tire users and can be steered into broad rules [S23][S4].
- Ceremony until measured: a prompt-injection filter run as the only defence. The best detector here reached 0.80 node-level F1, so errors remain [S8], though prompt-level hardening has some effect [S5].
- Ceremony until measured: scanning every skill with no repository context, which flags up to 46.8% of skills as malicious, against 0.52% after context [S20].
- Unproven: pinning skills by commit as a control [S20].

## Open questions

- Which sandbox does a given host really enforce when weftwork runs a loop unattended? Candidate R10 measurement: read the effective sandbox and approval state for each host on a fixed task and record what an out-of-sandbox write, a network call and a read of a credential file do. Unsourced beyond the docs.
- Does CapScope-style capability checking carry over from pi and Python repair to other hosts and to weftwork's stories? Candidate R10 measurement: inject a planted instruction into a spec file and count executed effects with and without a capability check [S3].
- How often does an agent request a broad allow-rule in ordinary work, and how often do users approve it? [S4] measures the attack, not the base rate. Unsourced.
- What false-positive rate does a repository-aware skill scan have on the skills weftwork would ship? Candidate R10 measurement on the catalog itself [S20].
- Does pinning to a commit reduce loss in practice, or does it only delay updates? Unsourced.
- Which protected-paths list should weftwork require, and who owns it when hosts disagree? Open for the owner and for R13 [S29][S26].
- Papers read in abstract only. Numbers above come from abstracts and should be checked against the full texts before the synthesis relies on them.
