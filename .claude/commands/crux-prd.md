---
description: Generate PRD and REQ files from an IDEA + its grill answers. Every REQ traces to GRILLs.
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: "<idea-id>"
---

You are running `/crux-prd` with idea id: $ARGUMENTS

## Pre-flight

1. Confirm `docs/sdlc/input/$ARGUMENTS.md` exists.
2. Confirm at least 10 `docs/sdlc/grill/GRILL-*.yaml` files exist that reference this IDEA. If fewer, warn the user and ask whether to proceed (under-grilled inputs produce hollow PRDs).
3. Read `templates/PRD.md.tmpl` and `templates/REQ.yaml.tmpl`.

## Synthesis

1. Load the IDEA body and every GRILL Q&A (skipping deferred ones with no default assumption).
2. Cluster the answers into requirement candidates. A requirement candidate is testable, scoped, and has at least one supporting GRILL answer.
3. For each candidate, draft a `REQ-<n>.yaml` matching the template. Required fields:
   - `id`, `text`, `derived_from` (list of GRILL ids — never empty), `acceptance_criteria` (≥1), `priority` (must/should/could/wont), `gate: 2`.
   - Populate `health_signals` only when the requirement implies a measurable runtime invariant. Use `null`/omit otherwise; do not invent metrics.
4. Draft `docs/sdlc/prd/PRD.md` from the template:
   - Goals, non-goals, personas filled from GRILL answers (not invented).
   - Requirements section: bullet list of every REQ with one-line summary and priority.
   - Open questions section: lifted from deferred GRILLs.

## Output files

- `docs/sdlc/prd/PRD.md`
- One `docs/sdlc/prd/REQ-<n>.yaml` per requirement.

## Validation

Before writing, check:
- Every REQ has `derived_from` populated with at least one GRILL id.
- Every GRILL with `source: user` or `source: default` is referenced by at least one REQ, OR explicitly noted in PRD "Open questions" as not yet binding. Orphan GRILLs are a smell — surface them.
- `priority: must` count is realistic (typical PRDs have 5–15 `must` REQs; flag if you produced more).

## Output summary

Print:
- Count of REQs by priority.
- List of GRILL ids that did not motivate any REQ.
- Reminder: "Run `/crux-modules <PRD-id>` next, then `/crux-architect`."

## Approval

Do NOT mark the PRD approved. Approval requires explicit `/crux-approve PRD`.
