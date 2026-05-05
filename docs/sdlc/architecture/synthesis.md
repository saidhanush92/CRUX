<!--
Architecture synthesis — Phase 7.8.
Auto-regenerated from docs/sdlc/adr/ADR-CRUX-*.yaml on every ADR change.
Last regen: 2026-05-05 (post-Phase-7.6 fix-all amendments).
DO NOT hand-edit; edit the underlying ADRs and regenerate.
-->

# Crux v1.0 architecture synthesis

This is a human-readable narrative derived from the 10 accepted ADRs that
constrain Crux v1.0. Each section names the ADR(s) it summarizes; the ADRs
themselves are the source of truth. When a section disagrees with an ADR,
the ADR wins.

## 1. Repository shape — TS monorepo with pnpm workspaces

Crux is a TypeScript monorepo. Each package under `packages/` has its own
`tsconfig.json` extending the root `tsconfig.base.json` (strict mode, ES2022,
composite). pnpm workspaces (`pnpm-workspace.yaml`) coordinate dependency
hoisting and cross-package builds. Five packages are scaffolded by Phase 0;
three are v1.0-active (`core`, `adapter-claude-code`, `cli`); two are v1.1+
placeholders (`audit-site`, `extension-vscode`) that ship only stub READMEs
at v1.0.

> **ADR-CRUX-001** — TypeScript monorepo with pnpm workspaces.

## 2. Trace graph — markdown canonical, SQLite cache

The trace graph (every artifact and every link between them) is canonically
stored as plain markdown and YAML files under `docs/sdlc/`. SQLite at
`.crux/trace.db` is a derived cache: a user can delete it at any time and
the indexer rebuilds the same graph from the markdown source. Cache
invalidation uses per-file `mtime + sha256`. On any disagreement, markdown
wins; the cache rebuilds from markdown, never the other direction. The
indexer is single-threaded with a 100ms debounce window and serializes
passes through a process-local mutex; commits are atomic
(temp-write → fsync → rename). Every read re-checks the file's sha256
against the indexed hash and recomputes inline on mismatch — no stale
ancestors are ever returned even if a debounce missed a write.

> **ADR-CRUX-002** — Trace graph storage: markdown canonical + derived
> SQLite cache. Concurrent-write semantics added per pre-mortem PM-CRUX-001.

## 3. Runtime adapter interface — 17 functions, 7 concern groups

Crux talks to coding runtimes (Claude Code, Cursor, Aider, raw Anthropic
SDK, …) through a small adapter interface. Exactly **17 functions** across
**7 concern groups**:

| Group | Functions |
|---|---|
| Lifecycle | `session_start`, `session_end`, `capabilities_supported` |
| Subagents | `spawn_subagent`, `await_subagent` |
| Skills | `install_skill`, `uninstall_skill`, `list_skills` |
| Hooks | `install_hook`, `list_hooks` |
| Slash commands | `run_command` |
| Filesystem & shell | `read_file`, `write_file`, `run_shell` |
| Trace & capability | `emit_event`, `resolve_capability`, `invoke_skill` |

The interface lives in `packages/core` as TypeScript types + a reference
contract. Adapters implement it. At v1.0 only the Claude Code adapter
exists; the runtime-neutrality claim is therefore provisional until at
least one second adapter ships at v1.1+. To validate the abstraction at
v1.0, a paper-only spec for a second adapter ships at
`docs/sdlc/architecture/adapter-second-spec.md`, marking each of the 17
functions feasible | needs-redesign | unknown for the chosen paper
target. Any `needs-redesign` function reopens ADR-CRUX-003 pre-release.

> **ADR-CRUX-003** — Runtime adapter interface: 17 functions in 7 concern
> groups. Paper-only second-adapter spec added per arch-critique
> ARCH-CRIT-002.

## 4. Subagent execution — three identities, isolated

The `/crux-task` build pipeline runs three subagents in sequence:
**test-writer → coder → reviewer** (plus a parallel **design-reviewer**
for UI tasks). Each subagent runs as a separate `Task` invocation with
**no shared transcript context**. Reviewer cannot lazy-share the coder's
reasoning trace. The architect uses `model: opus`; all other roles
default to `model: sonnet`. The model-assignment *rule* is binding via
ADR; specific per-agent assignments stay editable in `.claude/agents/`
frontmatter without a CHG event.

> **ADR-CRUX-004** — Subagent invocation isolation + model assignment rule.

## 5. Amendments — layered files, runtime merge

When an incident produces an amendment (via `/crux-incident report` →
`amendment-writer`), the amendment lands as `docs/sdlc/amendments/AMD-<n>.yaml`.
The original `.claude/skills/<name>/SKILL.md` is **never** edited; upstream
Pocock and ECC updates remain mergeable. At runtime, when an anchored
subagent invokes its canonical skill, the orchestrator
(`resolveAmendmentsForSkill` in `packages/core`) reads the SKILL.md, scans
`docs/sdlc/amendments/` for matches, and assembles the brief by appending
matching rules under `## Active amendments` after the skill body.
`severity: high` amendments render as **BLOCKING**.

> **ADR-CRUX-005** — Amendment layering: separate AMD files, runtime merge.

## 6. Gate-mode dial — `stack.yaml.crux_mode` + artifact invariance

The active gate-mode is set in `stack.yaml` via the top-level `crux_mode`
field. Allowed values: `compressed`, `standard`, `strict`, `solo`,
`observation`. Greenfield default = `compressed`; brownfield default =
`standard`. **Artifact production is invariant across all modes** —
every gate produces its REQs / ADRs / MODs / TASKs / REVIEWs under
every mode. Modes differ only in HITL approval frequency. Auto-approvals
in compressed mode are recorded in `approvals.log` with
`source: mode-compressed` — never silently. Mid-project mode changes
require a CHG event documenting the transition. This ADR explicitly
ratifies the resolution of IDEA-001's ambiguity about what Compressed
Mode skips (answer: only HITL approval, never artifact production).

> **ADR-CRUX-006** — Gate-mode dial in `stack.yaml` + artifact-invariance rule.

## 7. Orchestration model — DAG pipeline, Ruflo-credited

The `/crux-task` pipeline is a small acyclic DAG:
`test-writer → coder → reviewer` (+ parallel design-reviewer for UI).
Hand-off contracts are in agent system prompts and enforced by
`/crux-task`. The orchestration shape (slash-command + subagent + hook
conventions, DAG-batched tasks) is structurally absorbed from the **Ruflo**
project — patterns ported, no files imported. This is a SCOPE-ANCHOR
ADR rather than a hard architectural lock; the DAG shape is revisable
in a v1.x line if real usage demands without a heavyweight CHG event.

> **ADR-CRUX-007** — Orchestration model: DAG subagent pipeline +
> structural Ruflo absorption.

## 8. Hook collisions — matcher+event halt, persisted resolution

A hook collision is two or more hooks with the same `event` AND same
`matcher` AND no explicit `priority`. When detected during `/crux-init`'s
harness install, install halts before writing `harness.lock`. User
resolves manually (drop a skill, or assign explicit priorities). Every
resolution is recorded in `harness.lock.collision_resolutions` with the
resolved command list, source skills, and a sha256 of the settings.json
fragment. On re-install the harness installer reads
`collision_resolutions` first and re-applies; resolutions persist.
Manual `settings.json` edits not captured in the lock are flagged but
not auto-reverted.

> **ADR-CRUX-008** — Hook collision policy: matcher+event halt, manual
> resolution, persisted via `harness.lock`.

## 9. Per-task cost halt — 1.0× warn / 2.0× halt / 5.0× auto-stop

`/crux-task` enforces a per-task cost halt. Soft warn at 1.0× of
`TASK.estimated_cost_usd`; hard halt at 2.0×. The 2.0× multiplier is
configurable via `stack.yaml.cost_halt_multiplier`. A hard halt requires
explicit user confirmation; on confirmation the ceiling rises by 1.0×
of the original estimate (additive step → 3.0×, 4.0×). After three
consecutive confirmations on the same task the cycle hard-stops at 5.0×
without further prompts and emits a CHG event recommending the user
revise the estimate or split the task. Cost-log threshold is pinned at
`wall_seconds >= 60` per agent invocation. The cost ledger lives in
`docs/sdlc/costs/log.csv` (CSV, not SQLite) — it is intentionally
separate from the trace cache; lifting to SQLite is a v1.1+
consideration.

> **ADR-CRUX-009** — Per-task cost halt contract: 1.0× / 2.0× / 5.0×
> ladder, CSV-scoped ledger. Halt-rebase policy added per pre-mortem
> PM-CRUX-003. Storage scope clarified per arch-critique ARCH-CRIT-001.

## 10. PR descriptions — `PR_DESCRIPTION.md`, manual `gh pr create`

After reviewer (and design-reviewer for UI) approval, `/crux-task`
writes `docs/sdlc/tasks/<task-id>/PR_DESCRIPTION.md` containing the
full structured trace block: task id, module, mode, satisfied REQs
with summaries, honored ADRs with titles, upstream GRILL ids, review
verdict and cycle count, cost summary, diff stats. `/crux-task` does
**not** invoke `gh pr create` at v1.0; the user opens the PR
themselves (`gh pr create --body-file <path>` or paste). v1.1 may add
`/crux-pr` automation; the same `PR_DESCRIPTION.md` feeds into it.

> **ADR-CRUX-010** — PR_DESCRIPTION.md generation; manual `gh pr create`
> at v1.0.

## Cross-cutting commitments

- **Audit trail invariance.** Markdown / YAML in `docs/sdlc/` is the
  durable record. Caches, indexes, and assembled briefs are derived;
  the user can delete them and rebuild without losing audit data.
- **Three-identity rule.** Test-writer, coder, reviewer are different
  subagent invocations with no shared context. The trust contract
  behind "different agent identity" in IDEA-001 is operationally
  enforced.
- **Mode invariance.** Every mode produces every artifact. Compressed
  mode collapses *approval steps*, never *artifact production*.
- **Bounded spend.** Every `/crux-task` run has a hard upper cost
  bound (5.0× estimate) and emits a CHG event when it hits it.
- **Provisional runtime neutrality.** v1.0 ships one adapter (Claude
  Code) plus a paper-only second-adapter spec to validate the
  interface. Real runtime neutrality begins at v1.1.

## Open items deferred to gate 7 (build) and beyond

- **PM-CRUX-002** — CI guard that fails build if adapter interface
  function count drifts from 17.
- **PM-CRUX-004** — `/crux-status` warning when any skill's amendment
  count exceeds 15 (warn) / 20 (block until consolidated).

Both are queued for the v1.0 task DAG produced by the planner at gate 7.

## Accepted risks (logged in `approvals.log`)

- **PM-CRUX-006** — Windows-authored `PR_DESCRIPTION.md` may carry
  CRLF line endings; cosmetic only on GitHub render.
- **PM-CRUX-007** — `approvals.log` is non-atomic-append; only
  material if MOD-CRUX-003 ever parallelizes auto-approvals (currently
  sequential).
