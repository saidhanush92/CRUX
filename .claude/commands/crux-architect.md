---
description: Invoke the architect subagent to draft ADRs and amend stack.yaml. Self-grills, then runs arch-critic and pre-mortem in parallel before HITL approval.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

You are running `/crux-architect`. This is the heaviest gate — ADRs constrain everything downstream.

## Sub-step sequence (do not parallelize)

### 1. Context load

Invoke the **architect** subagent (Task) with this brief:
- Apply `.claude/skills/architecture-decision-records/SKILL.md` as your canonical methodology. Read it first; its ADR-authoring conventions govern every decision record you produce.
- Read `docs/sdlc/prd/PRD.md`, every `REQ-*.yaml`, every `MOD-*.yaml`, current `docs/sdlc/stack/stack.yaml`.
- Scan the codebase: `git ls-files`, identify package boundaries, configuration files, existing decisions encoded in code.
- Produce a context summary (under 500 words) listing: known constraints, open architectural questions, and modules whose shape is undefined.

### 2. Strawman draft

The architect drafts a strawman: a coherent architectural proposal covering storage, package boundaries, the adapter shape, runtime model, and persistence. Output as a single markdown doc (`docs/sdlc/adr/_strawman.md`, gitignored — do not commit).

### 3. Self-grill

The architect runs an adversarial self-review against the strawman:
- For every choice, ask: what's the credible alternative? what breaks if we pick wrong? what's the reversal cost?
- Surface forks where the architect cannot decide alone. A fork is a question requiring human judgment (e.g., "audit site as embedded in the CLI vs. separate Astro deployment").

### 4. Surface forks to human

Print the fork list. Halt and wait for user resolution. Do NOT auto-pick. For each fork:
- Print the question, the options, and the architect's recommendation with rationale.
- User responds with a chosen option (or asks for more info).

### 5. Apply the 3-question ADR test

For each candidate decision, apply the test embedded in `templates/ADR.yaml.tmpl`:
1. Does this constrain future work non-trivially?
2. Is at least one credible alternative being rejected?
3. Is reversal expensive?

If all three answer "yes", produce an ADR. Otherwise, capture as a code comment or a stack.yaml field — NOT an ADR. Be ruthless; the ADR ledger should stay small.

### 6. Generate ADR files

For each surviving decision:
- Write `docs/sdlc/adr/ADR-<n>.yaml` matching the template.
- Status starts as `proposed`. Transition to `accepted` only after `/crux-approve`.
- Populate `resolves` (GRILL ids), `satisfies` (REQ ids), `constrains` (MOD ids), `revisit_when`, `validated_by`.

### 7. Amend stack.yaml

For decisions that pin a framework, runtime version, or quality gate, edit `docs/sdlc/stack/stack.yaml` to reflect the ADR. Add a comment `# pinned by ADR-<n>` next to each amended field.

### 8. Adversarial pass (gate 4.6)

Invoke two subagents **in parallel** (single message, two Task calls):

- **arch-critic** (`subagent_type: arch-critic`) — brief: "Read every ADR (proposed and accepted), the PRD, every REQ, every MOD, current stack.yaml. Detect contradictions, implicit decisions absent from the ADR ledger, hidden compounding constraints, ADRs that fail the 3-question test, vague `revisit_when` triggers, missing `validated_by`, and stack drift. Write `docs/sdlc/adr/arch-critique.yaml`."
- **pre-mortem** (`subagent_type: pre-mortem`) — brief: "Read every ADR, the PRD, every REQ, every MOD, current stack.yaml. Imagine the system in production right now with an unfolding incident; produce 5–10 failure modes. Classify each as `route-to-test`, `route-to-ADR-clause`, or `accept-as-known-risk`. Write `docs/sdlc/adr/pre-mortem.yaml`."

Read both output files. Surface their findings:

- Print arch-critic concerns by severity, with target ADR ids.
- Print pre-mortem failure modes grouped by classification.

Routing actions:
- `route-to-test` items are queued for the Gate 6 / Gate 7 task DAG (record their ids; planner picks them up later).
- `route-to-ADR-clause` items return to the architect: surface to the human, ask whether to amend the affected ADR or write a new one. Looping back to step 5 is acceptable.
- `accept-as-known-risk` items are logged into `docs/sdlc/approvals.log` with `kind=accepted-risk` and the failure-mode id, and remain visible via `/crux-trace` from the relevant ADR.

## Output

- List of new ADR ids and their status.
- Updated `stack.yaml` diff summary.
- Any ADRs marked `needs-revisit` and why.
- arch-critic verdict: `clean` or `<n> concerns flagged` (with severity counts).
- pre-mortem verdict: `<n> failure modes` (with classification counts).
- Reminder: "Resolve any `route-to-ADR-clause` items first. Then approve each ADR via `/crux-approve ADR-<n>`. Then run `/crux-modules` again if any constraint changed module shape."

## Approval block

A non-empty arch-critique OR a non-empty pre-mortem `route-to-ADR-clause` set is a **hard block** on architect HITL approval. `/crux-approve ADR-<n>` will refuse to flip status to `accepted` until both are resolved.

## Constraints

- Architect MUST run context load before deciding (no cold-start ADRs).
- Architect MUST self-grill before surfacing the strawman.
- Architect MAY NOT mark its own ADRs `accepted`. Only `/crux-approve` does that.
- arch-critic and pre-mortem MUST run before HITL approval. Skipping them is a process violation.
