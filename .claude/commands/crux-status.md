---
description: Summarize gate state, blockers, cost burn, and recent events.
allowed-tools: Read, Glob, Grep, Bash
---

You are running `/crux-status`. This is a read-only summary; never mutate artifacts here.

## Steps

1. **Gate state.** For each gate (1–8), determine open/closed:
   - Gate 1 (input): closed if at least one `IDEA-*.md` exists.
   - Gate 2 (PRD): closed if `docs/sdlc/prd/PRD.md` exists AND has an entry in `approvals.log`.
   - Gate 3 (modules): closed if at least one `MOD-*.yaml` exists AND every `must`-priority REQ is referenced by some MOD's `derived_from`.
   - Gate 4 (architecture): closed if every ADR is `accepted` or `superseded` (none in `proposed` state).
   - Gate 5 (harness): closed if `docs/sdlc/harness/harness.lock` exists AND `verification` block reports all passes.
   - Gate 6 (design): closed if a `DESIGN_BRIEF.yaml` and `TOKENS.yaml` exist for every UI module, OR no UI modules exist.
   - Gate 7 (build): partial — count tasks by status (open / in-cycle / approved).
   - Gate 8 (release): closed if at least one `releases/REL-*.yaml` exists for the current version.
     For each gate print: id, name, status (open|closed|n/a), one-line reason.

2. **HITL blocks.** Walk every artifact and find:
   - GRILLs with `source: deferred` whose `defer_to` gate is now active.
   - ADRs in `proposed` state.
   - REVIEWs with `verdict: escalate` or `cycle_number >= 3`.
   - TASKs whose linked ADRs are not yet `accepted`.
     List these grouped by category. Each line: id, what's needed, who from.

3. **Critiques.** Count unresolved entries in each adversarial output, treating an entry as "resolved" only if its `target` artifact has been re-written (timestamp newer than the critique's `noted_at`) OR a `waived_by` field exists on the entry:
   - `docs/sdlc/prd/spec-critique.yaml` → spec count.
   - `docs/sdlc/adr/arch-critique.yaml` → arch count.
   - `docs/sdlc/adr/pre-mortem.yaml` → count `route-to-ADR-clause` items still open (test-routed and accepted-risk items are not blockers).
     Render as: `Critiques: <n> spec, <m> arch, <k> pre-mortem unresolved`. Treat any unresolved critique as a **soft block** on advancing past its gate (gate 2 for spec, gate 4 for arch and pre-mortem).
     If none of the three files exist yet (pre-Phase-7 state), render: `Critiques: 0 spec, 0 arch, 0 pre-mortem unresolved`.

4. **Cost burn.** If `docs/sdlc/costs/log.csv` exists, sum `tokens_estimated` and `wall_seconds` over the last 7 days. Print the totals and the top 3 most expensive `task_id`s. If the file doesn't exist, print "cost log not yet initialized".

5. **Last 5 events.** Tail the last 5 lines of `docs/sdlc/approvals.log`.

## Output shape

```
Gates
  1 input        closed  (3 IDEA files)
  2 PRD          open    (no /crux-approve PRD entry)
  3 modules      n/a
  ...

HITL blocks (4)
  ADR-005        accept-or-revise    architect → user
  REQ-012        approve-deferral    user
  ...

Critiques: 2 spec, 0 arch, 1 pre-mortem unresolved

Cost (7d)
  $4.20 estimated, 14m wall, top: TASK-007 ($1.10)

Recent
  2026-05-04  /crux-prd       PRD-001 written
  2026-05-04  /crux-approve   PRD-001 approved
  ...
```

## Empty repo case

If no artifacts exist yet:

- Print "no gates open".
- Print `Critiques: 0 spec, 0 arch, 0 pre-mortem unresolved`.
- Print a one-line reminder pointing to `/crux-init` or `/crux-idea`.
- Exit 0.
