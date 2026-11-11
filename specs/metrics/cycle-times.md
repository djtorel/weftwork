---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e02s03
epic: e02
bcps: 3
commit_range: "423e805..0337c90"
source: measured
generated_at: 2026-11-08T23:44:39Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 74   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 1.1011              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e02s03

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).

Provenance: the original e02s03 commits (548a23f..21594aa, squash-merged
as daef890) had no `Story:` trailer. They were rebuilt on a scratch
branch with the trailer added; author dates and the final tree are
identical to the originals, so `commit_range` above names the scratch
copies, which are no longer on a branch.
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e02s04
epic: e02
bcps: 5
commit_range: "199ccb6..022f629"
source: measured
generated_at: 2026-11-09T02:05:57Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 129   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 2.0011              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e02s04

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e03s01
epic: e03
bcps: 3
commit_range: "87fd0e8..b411c27"
source: measured
generated_at: 2026-11-09T04:20:43Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 78   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 1.2964              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e03s01

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e03s02
epic: e03
bcps: 5
commit_range: "e52862c..6aafdab"
source: measured
generated_at: 2026-11-09T06:33:13Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 76   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 1.2386              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e03s02

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e03s03
epic: e03
bcps: 5
commit_range: "f92e3b4..9b39be6"
source: measured
generated_at: 2026-11-09T16:18:51Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 105   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 1.7197              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e03s03

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e03s05
epic: e03
bcps: 5
commit_range: "f6c28d2..5d8089a"
source: measured
generated_at: 2026-11-10T01:00:09Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 97   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 1.5197              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e03s05

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e03s06
epic: e03
bcps: 5
commit_range: "310e9e6..310e9e6"
source: measured
generated_at: 2026-11-10T03:53:42Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 19   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 0.0000              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e03s06

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).

Limit of this row: e03s06 was released as one squashed-in commit, so the
git-hours model sees one timestamp. effort_hours (0.0) and lead time (19
min, first commit to the recording time, before the merge) do not
reflect the work, which ran for many hours across a long session. The
owner chose on 2026-11-09 to record the row with this note. Do not use
it in averages or bcp_per_hour comparisons.
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e03s07
epic: e03
bcps: 8
commit_range: "a38d2e8..f6c927f"
source: measured
generated_at: 2026-11-11T02:15:59Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 129   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 2.1367              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e03s07

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e03s08
epic: e03
bcps: 5
commit_range: "fb7b442..d93cda1"
source: measured
generated_at: 2026-11-11T04:01:56Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 25   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 0.4172              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e03s08

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).
---
okf_kind: story-metrics
okf_version: "0.1"
type: StoryMetrics
id: e04s01
epic: e04
bcps: 8
commit_range: "9b9cfd3..a31d01a"
source: measured
generated_at: 2026-11-11T06:28:16Z
generator: scripts/record-cycle-time.sh

# DORA — the four keys (market standard). ⌀ median aggregate.
dora:
  lead_time_for_changes_min: 88   # ⌀ first commit → merge
  deployment_frequency: null           # % populated by e40s05
  change_failure: null                   # % populated by e40s05
  time_to_restore_min: null              # ⌀ populated by e40s05

# Agent code-generation telemetry (GSD-2 style). Σ additive.
agent:
  cost_usd: null                         # Σ harness telemetry (null = git effort fallback)
  tokens:
    input: null
    output: null
    cache_read: null
    cache_write: null
    total: null
  cache_hit_rate_pct: null               # %
  compression_savings_pct: null          # %
  tool_calls: null                       # Σ
  api_requests: null                     # Σ
  agent_duration_ms: null                # Σ (excludes human UAT wait)
  model: null                            # •
  tier: null                             # • light|standard|heavy
  model_downgraded: null                 # •
  skills: []                           # Σ

# Effort (git-derived, idle-stripped, ADDITIVE).
effort:
  effort_hours: 1.4097              # Σ idle-stripped (git-hours, 120-min threshold)
  idle_threshold_min: 120              # • recorded for interpretability

# Quality gate. ⌀ median / • static.
quality:
  audit_score_pct: null                 # ⌀ populated by audit-code
  coverage_pct: null                    # ⌀ populated by test suite
  tests_passed: null                    # • populated by test suite
  verify_status: null                   # pass|waived
  rework_count: null                    # Σ reopens → feeds change_failure

# Flow (worktree telemetry).
flow:
  merge_duration_ms: null               # ⌀ p50/p95 across stories
  merge_conflicts: null                 # Σ
  worktree_orphaned: null               # •
---

# Story metrics — e04s01

Effort derived from git commit history via the git-hours model
(src: kimmobrunfeldt/git-hours, 120-min idle threshold, 120-min
first-commit pad). Lead time is calendar latency (first commit → merge).

Aggregation tags: Σ additive (sum → total) · ⌀ median/p95 (never sum)
· % rate (ratio over window) · • static (identity).
