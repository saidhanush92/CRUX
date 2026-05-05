---
description: Open an incident. Cascade to CHG events and amendments via amendment-writer.
allowed-tools: Read, Write, Edit, Glob, Grep, Task
argument-hint: "report"
---

You are running `/crux-incident $ARGUMENTS`. The only supported subcommand at v1 is `report`.

## Validate subcommand

1. If `$ARGUMENTS` is not `report`, halt and print: `Usage: /crux-incident report`.

## Gather facts

Prompt the user for:
1. **Title** — one line, present-tense, describing what was observed.
2. **Observed behavior** — what happened, with timestamps if known. Free-form, multi-line.
3. **Suspected violated artifact** — the REQ id and/or ADR id whose contract was broken. The user may say "unknown" — in that case, prompt with the most-relevant `must`-priority REQs and let them pick.
4. **Detection source** — `prod` | `ci` | `staging` | `manual-review` | `user-report`.
5. **Severity** — `low` | `medium` | `high` | `critical`. Critical halts open new tasks until resolved.

## Generate INCIDENT

1. Read `templates/INCIDENT.yaml.tmpl`.
2. Determine next monotonic id: `INC-<n>` based on `docs/sdlc/incidents/INC-*.yaml`.
3. Write `docs/sdlc/incidents/INC-<n>.yaml` populated with the gathered facts.
4. Set `root_cause` to a placeholder `# TODO: complete after investigation` if the user did not yet know it. Open incidents are valid; root cause can be filled later.

## Cascade

After the INC file is written:

### Open CHG event(s)

For each violated REQ/ADR, draft a CHG event:
- `id: CHG-<n>`, `trigger_event: "INC-<n>: <title>"`, `classification: bug` (default — flag for human re-classification if reqs may be misaligned).
- `superseded_artifacts: []` — populate later when fix is known.
- `affected_artifacts: <violated REQ/ADR + dependent TASKs>`.
- Save under `docs/sdlc/chg/CHG-<n>.yaml`.
- Add the CHG id to `INC-<n>.yaml` `chg_events_opened`.

### Invoke amendment-writer

Invoke the **amendment-writer** subagent (Task) with brief:
- Apply `.claude/skills/verification-loop/SKILL.md` as your canonical methodology. Read it first; every amendment you author must be enforceable inside the verification loop.
- Read the INC file and any CHG events just opened.
- Determine which curated skill the failure pattern maps to (e.g., a missing test → `tdd-workflow`; a silent fallback → `silent-failure-hunter`).
- For each pattern, draft `docs/sdlc/amendments/AMD-<n>.yaml` matching the template.
- The amendment-writer may NOT delete existing amendments. Only append.
- Add new AMD ids to `INC-<n>.yaml` `amendment_ids`.

### Prevention tasks

For each cascade, propose a prevention TASK:
- `id: TASK-<n>`, `title: "Prevent recurrence of INC-<n>"`, `risk: medium`, `satisfies: <violated REQ id>`.
- Save the TASK file but do NOT auto-run `/crux-task`. Wait for human to prioritize.
- Add the TASK id to `INC-<n>.yaml` `prevention_tasks`.

## Output

- INC id and path.
- List of CHG ids opened.
- List of AMD ids generated.
- List of prevention TASKs queued.
- Reminder: "Investigate root_cause and edit `INC-<n>.yaml` when known. Then prioritize prevention TASKs."
