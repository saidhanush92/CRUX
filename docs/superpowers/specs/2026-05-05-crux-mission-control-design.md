# Crux Mission Control Design

**Date:** 2026-05-05
**Status:** approved for mock implementation
**Audience:** technical and non-technical stakeholders

## Goal

Create a visually striking, standalone frontend mock that explains Crux as a live
"mission control" system. The mock should communicate progress, current activity,
agent roles, gate status, artifacts, blockers, and human approvals without requiring
knowledge of the underlying codebase.

## Product Intent

The experience should make Crux feel active, orchestrated, and trustworthy.
Non-technical viewers should quickly understand that work moves through defined gates
with human oversight. Technical viewers should be able to inspect which agents are
running, what they are doing, what artifacts have been produced, and where blockers
or escalations occurred.

## Visual Direction

- **Visual thesis:** premium control-room dashboard with cinematic energy, precise
  information density, and clear operational hierarchy.
- **Content plan:** global status first, live activity second, proof artifacts third.
- **Interaction thesis:** tab-based comparison between three dashboard modes, gate
  focus states, and lightweight motion that signals activity rather than decoration.

## Information Architecture

The mock should present three dashboard styles using the same underlying demo data:

1. **Cinematic Mission Control**
   - largest visual impact
   - strong motion and glow
   - emphasizes active agents, blockers, and dramatic progress

2. **Executive Control Room**
   - best mixed-audience default
   - emphasizes gate completion, approvals, artifacts, and business-readable summaries

3. **Dense Operator Console**
   - most technical
   - emphasizes telemetry, agent roster depth, live events, and artifact counts

## Shared Screen Model

Every dashboard tab should expose the same core concepts:

- 8-gate pipeline status
- current gate and overall completion
- active, queued, blocked, and completed agent counts
- named agent roster with role and current action
- live event stream
- key artifacts with preview metadata
- blockers and human escalation states
- summary of what has been achieved so far

## Core UI Regions

- **Global top bar:** project name, mode, elapsed time, active agents, blockers,
  approvals waiting, completion percentage
- **Gate rail:** all 8 gates shown as a progress backbone
- **Primary operations region:** live agent cards, current work, recent handoffs
- **Artifact region:** REQ, ADR, MOD, TASK, REVIEW, PR description previews
- **Blockers and approvals region:** highlights where the human must step in
- **Narrative summary region:** short language explaining progress in plain English

## Demo Data Model

The mock should use seeded static data for:

- gate list and statuses
- agent identities and teams
- live agent actions
- artifact inventory
- event stream
- blockers
- approvals

This is a presentation mock, not a backend-integrated dashboard.

## Constraints

- Build inside `docs/` so it is easy to open and share.
- Keep it standalone: one HTML file with embedded CSS and JS is acceptable.
- Preserve a premium look without turning the UI into unreadable sci-fi chrome.
- Make all three tabs feel meaningfully different, not simple palette swaps.

## Success Criteria

- A non-technical viewer can explain the 8-gate flow after a short demo.
- A technical viewer can identify agent roles, active work, and produced artifacts.
- The screen feels alive and high-status, not like a generic admin dashboard.
- The mock can be opened directly from the repo without extra setup.
