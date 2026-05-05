---
description: Generate PRD and REQ files from an IDEA + its grill answers. Every REQ traces to GRILLs. Runs spec-critic before HITL approval.
allowed-tools: Read, Write, Edit, Glob, Grep, Task
argument-hint: '<idea-id>'
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

## Spec-critic pass

After all REQ files and PRD.md are written:

1. Invoke the **spec-critic** subagent (Task tool, `subagent_type: spec-critic`) with brief: "Read every REQ in `docs/sdlc/prd/` and the PRD narrative. Detect contradictions, untestable REQs, vague REQs, orphan REQs (broken `derived_from`), missing coverage of must-priority intent, and invented health-signal thresholds. Write `docs/sdlc/prd/spec-critique.yaml`."
2. Read the resulting critique file.
3. If `critiques: []` — note "spec-critic: clean" in the output and proceed.
4. If non-empty — surface a numbered summary of every concern with severity, target, and finding. Mark the PRD as **soft-blocked**: do NOT proceed to `/crux-approve PRD` until the human has resolved each critique by either rerunning `/crux-prd`, deleting offending REQs, or explicitly waiving with a comment.

## Output summary

Print:

- Count of REQs by priority.
- List of GRILL ids that did not motivate any REQ.
- Spec-critic verdict: `clean` or `<n> concerns flagged`.
- Reminder: "Run `/crux-modules <PRD-id>` next, then `/crux-architect`. Resolve spec-critic concerns first if any."

## Approval

Do NOT mark the PRD approved. Approval requires explicit `/crux-approve PRD`. A non-empty `spec-critique.yaml` is a soft block on approval — `/crux-approve` will warn if you proceed past it.
