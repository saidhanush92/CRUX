---
description: Run the grill-interviewer subagent against an idea. Save Q&A as GRILL-<n>.yaml files.
allowed-tools: Read, Write, Glob, Grep, Task
argument-hint: "<idea-id>"
---

You are running `/crux-grill` with idea id: $ARGUMENTS

## Steps

1. Resolve `$ARGUMENTS` to a file at `docs/sdlc/input/$ARGUMENTS.md`. If missing, halt and ask the user to run `/crux-idea` first.
2. Read `templates/GRILL.yaml.tmpl` to confirm the schema you must emit.
3. Invoke the **grill-interviewer** subagent (Task tool, `subagent_type: grill-interviewer`) with this brief:
   - Apply `.claude/skills/grill-me/SKILL.md` and `.claude/skills/grill-with-docs/SKILL.md` as your canonical methodology. Read them first; their patterns govern question shape and tone.
   - Read the IDEA file in full, including its `## Crux annotations` section.
   - Generate 20–30 questions across the 8 gates, batched in **rounds of ~5 questions** so the human can answer one round before the next is posed.
   - For each question: surface gaps, assumptions, decision-points, and unresolved trade-offs. Avoid yes/no questions where an open-ended question would force more thought.
   - Output a list of question records ready for human answer. Do NOT answer your own questions.

## Per-round loop

Repeat until either (a) the agent reports no more questions or (b) the user types `stop`:

1. Display the next batch (5 questions, numbered).
2. Prompt the user: answer each by number, or type `defer N <reason>` to defer, or `default N <assumption>` to record a tentative default.
3. For each answered question, write `docs/sdlc/grill/GRILL-<n>.yaml` populated against the template. Set:
   - `id` = next monotonic GRILL id
   - `gate` = the gate the question was generated for
   - `question`, `answer` (or null if deferred), `confidence`, `source` (`user` if answered, `deferred` if deferred, `default` if a default was recorded)
   - `asked_by: grill-interviewer`
   - `answered_at` = current ISO-8601 timestamp
   - When deferred: populate `defer_to`, `defer_reason`, `default_assumption`, `blast_radius`.
4. After each batch, write a brief progress line: "Round N complete: M answered, K deferred."

## End of pass

When all batches are processed:
1. Print a deferral summary: list every GRILL with `source: deferred`, grouped by `defer_to` gate. This is the human's "still owed" list.
2. Print a confidence summary: count of `high`/`medium`/`low` answers.
3. Append to `docs/sdlc/approvals.log`: `<timestamp>  /crux-grill  IDEA-<n>  <total> questions  <deferred> deferred`.
4. Remind: "Run `/crux-prd IDEA-<n>` next to draft the PRD from these answers."

## Constraints

- The grill-interviewer may not answer its own questions.
- Never auto-default an answer the user did not explicitly approve.
- Every GRILL file must have `derived_from`-equivalent traceability via the `gate` field and an implicit link to the IDEA being interrogated; if the schema needs an explicit field, add `idea: IDEA-<n>` as an extension.
