---
description: Decompose an approved PRD into modules. Output MOD-<n>.yaml files.
allowed-tools: Read, Write, Glob, Grep
argument-hint: '<prd-id>'
---

You are running `/crux-modules` with PRD id: $ARGUMENTS (typically `PRD` for the singleton).

## Pre-flight

1. Confirm `docs/sdlc/prd/PRD.md` exists and has been approved (look for an entry in `docs/sdlc/approvals.log` matching the PRD id). If not approved, warn the user and ask whether to proceed.
2. Load every `docs/sdlc/prd/REQ-*.yaml`.
3. Read `templates/MODULE.yaml.tmpl`.

## Decomposition rules

1. Group REQs by **responsibility**, not by feature surface. Two REQs about "tracing" belong in one module even if they appear in different sections of the PRD.
2. Aim for 3–7 modules at v1 scale. Fewer than 3 = under-decomposed; more than 7 = over-decomposed unless the PRD is unusually large.
3. For each module, produce a `MOD-<n>.yaml`:
   - `id`, `name` (kebab-case, matches a `packages/<name>/` directory if applicable),
   - `responsibility` (one sentence),
   - `surface` (`ui` | `headless` | `none`),
   - `depends_on` (other MOD ids — keep this acyclic; if you draw a cycle, restructure),
   - `derived_from` (REQ ids — every REQ must appear in `derived_from` of exactly one module).

## Validation

- Every `must`-priority REQ is covered by at least one module.
- The `depends_on` graph has no cycles. Render it mentally — if A→B→C→A appears, restructure.
- No two modules share a responsibility statement; if they do, merge them.

## Output

- One `docs/sdlc/modules/MOD-<n>.yaml` per module.
- Print a summary table: id, name, surface, REQ count, depends_on count.
- Print any REQs not assigned to a module — these are bugs in the decomposition.
- Reminder: "Run `/crux-architect` next to produce ADRs that constrain how these modules are built."
