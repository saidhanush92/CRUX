---
description: Run the per-task pipeline — test-writer, then coder, then reviewer. Three subagent invocations.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
argument-hint: "<task-id>"
---

You are running `/crux-task` with task id: $ARGUMENTS

## Pre-flight

1. Resolve the task at `docs/sdlc/tasks/$ARGUMENTS/TASK.yaml`. If missing, halt.
2. Load constraints:
   - The TASK file (touches_files, satisfies, honors_adrs, module).
   - Each `REQ-<n>.yaml` listed in `satisfies`.
   - Each `ADR-<n>.yaml` listed in `honors_adrs`. Verify their status is `accepted`. If any is `proposed`, halt and ask the user to approve the ADR first.
   - The `MOD-<n>.yaml` referenced in `module`, plus its `derived_from` REQs.
   - `docs/sdlc/stack/stack.yaml` — the coder may not introduce dependencies absent here.
3. Print a constraint summary so the human can sanity-check before subagents run.

## Stage 1: test-writer

Invoke the **test-writer** subagent. Brief:
- Apply `.claude/skills/tdd-workflow/SKILL.md` as your canonical methodology. Read it first; its RED → GREEN → REFACTOR loop governs every test you produce.
- Read all loaded REQs and ADRs.
- Produce `docs/sdlc/tasks/$ARGUMENTS/TEST_PLAN.yaml` matching the template.
- Write failing tests under the test paths specified in TEST_PLAN. Tests must target paths inside `touches_files`.
- Run the test runner (`pnpm vitest run` or stack-equivalent). Confirm the tests fail for the *right reason* (not import errors, not typos — actual missing implementation).

Halt if any test passes (false-positive risk) or fails for a syntax/import reason. Surface to user.

## Stage 2: coder

Invoke the **coder** subagent (a different identity from test-writer). Brief:
- May read tests but may NOT modify them.
- May only write to paths inside `TASK.touches_files`.
- May NOT introduce dependencies absent from `stack.yaml`. If a new dep is needed, halt and tell the user to amend stack.yaml first via `/crux-architect`.
- Write the minimal implementation to make the failing tests pass.
- Run the test runner. All tests in the touched scope must pass.
- Run typecheck and lint per `stack.yaml.quality_gates`. Both must pass.

Halt if any quality gate fails after 3 self-correction attempts.

## Stage 3: reviewer

Invoke the **reviewer** subagent (a third identity, distinct from coder and test-writer). Brief:
- Apply `.claude/skills/code-review/SKILL.md` and `.claude/skills/silent-failure-hunter/SKILL.md` as your canonical methodology. Read both first; the structured review checklist plus the silent-failure detection patterns govern review depth and finding shape.
- Read the diff (`git diff`), all loaded REQs/ADRs/MODs, the TEST_PLAN.
- Check: every acceptance criterion in every linked REQ is verifiably tested. Every `honors_adrs` constraint is honored in the diff.
- Output `docs/sdlc/tasks/$ARGUMENTS/REVIEW-<cycle>.yaml` matching the template.
- Verdict: `approve` | `request_changes` | `escalate`.

If `request_changes`:
- Cycle counter increments.
- Loop back to Stage 2 with the reviewer's concerns. Coder addresses. Reviewer re-runs.
- On `cycle >= 3`, set `escalation_target: human` and halt for HITL judgment.

If `escalate`:
- Halt immediately. Surface concerns to user.

## Stage 4 (UI tasks only): design-reviewer

If the touched module has `surface: ui`, also invoke **design-reviewer** in parallel with reviewer (cycle 1 only). Brief the design-reviewer with: "Apply `.claude/skills/accessibility/SKILL.md` as your canonical methodology. Its WCAG 2.2 Level AA rules and a11y checklist govern every UI review you produce." Output a separate `REVIEW-design-<cycle>.yaml`. Both reviewers must approve before the task closes.

## On approval

- Append to `docs/sdlc/approvals.log`:
  `<timestamp>  /crux-task  $ARGUMENTS  approved  cycles=<n>`
- Print: diff summary, files touched, REQs satisfied, cost estimate vs. actual.
- Reminder: "Open a PR with the trace block: REQs / ADRs / MODs / GRILLs."

## Constraints (hard)

- Coder identity ≠ test-writer identity ≠ reviewer identity. Enforce by using different `subagent_type` values.
- Coder MAY NOT write outside `touches_files`. Reviewer flags any out-of-scope file as `severity: critical`.
- Tests MUST exist before code. Reverse order is a process violation; halt the run.
