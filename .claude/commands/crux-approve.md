---
description: Mark an artifact as user-approved. Append approval metadata and log the event.
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: '<artifact-id>'
---

You are running `/crux-approve` with id: $ARGUMENTS

## Resolve and load

1. Match `$ARGUMENTS` against known artifact prefixes and locate the file.
2. Read the artifact. Confirm it is approvable:
   - `PRD.md` — always approvable.
   - `REQ-*.yaml` — approvable.
   - `ADR-*.yaml` — approvable; transitions `status: proposed` → `status: accepted`.
   - `MOD-*.yaml` — approvable.
   - `DESIGN_BRIEF.yaml`, `TOKENS.yaml` — approvable.
   - `TASK-*` — NOT approvable here; tasks are approved via `/crux-task` review verdict.
   - `CHG-*`, `INC-*`, `AMD-*` — NOT approvable; these are events, not decisions.
     If the type is not approvable, halt with the explanation.

## Apply approval

1. Append (or set) two fields on the artifact:
   - `approved_by: <user>` — derive from environment (`git config user.name`) or from the calling user.
   - `approved_at: <ISO-8601 timestamp>`.
     For YAML artifacts, place these as top-level keys. For PRD.md, append to the `## Approval` section per the template.
2. For `ADR-*` only: also flip `status` from `proposed` to `accepted`. Refuse if status was already `superseded`; tell the user to open a CHG event instead.

## Log

Append a line to `docs/sdlc/approvals.log`:

```
<ISO-8601 timestamp>  /crux-approve  <artifact-id>  approved-by=<user>
```

Create the file with a header comment if missing.

## Output

Print: artifact id, type, prior status (if applicable), new status, log path.

## Idempotency

If the artifact is already approved (i.e., `approved_at` is non-null), halt with the existing approval metadata. Do not re-approve. Tell the user to open a CHG event if a re-approval is intended (a re-approval is a change event by definition).
