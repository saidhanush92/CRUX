---
description: Invoke the architect subagent to draft ADRs and amend stack.yaml. Self-grills before committing.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

You are running `/crux-architect`. This is the heaviest gate — ADRs constrain everything downstream.

## Sub-step sequence (do not parallelize)

### 1. Context load

Invoke the **architect** subagent (Task) with this brief:
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

## Output

- List of new ADR ids and their status.
- Updated `stack.yaml` diff summary.
- Any ADRs marked `needs-revisit` and why.
- Reminder: "Approve each ADR via `/crux-approve ADR-<n>`. Then run `/crux-modules` again if any constraint changed module shape."

## Constraints

- Architect MUST run context load before deciding (no cold-start ADRs).
- Architect MUST self-grill before surfacing the strawman.
- Architect MAY NOT mark its own ADRs `accepted`. Only `/crux-approve` does that.
