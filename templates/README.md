# Crux artifact templates

Every artifact Crux produces has a template here. Copy the template into the
matching `docs/sdlc/<dir>/` location, fill it in, and let the trace graph link
it to its parents via `derived_from` / `satisfies` / `resolves`.

| Template                                         | Lives at                                        | Produced by                                 | Trace fields                                 |
| ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| [GRILL.yaml.tmpl](GRILL.yaml.tmpl)               | `docs/sdlc/grill/GRILL-<n>.yaml`                | `grill-interviewer` subagent                | `supersedes`                                 |
| [REQ.yaml.tmpl](REQ.yaml.tmpl)                   | `docs/sdlc/prd/REQ-<n>.yaml`                    | `/crux-prd`                                 | `derived_from` (GRILLs)                      |
| [PRD.md.tmpl](PRD.md.tmpl)                       | `docs/sdlc/prd/PRD.md`                          | `/crux-prd`                                 | references REQ ids                           |
| [DESIGN_BRIEF.yaml.tmpl](DESIGN_BRIEF.yaml.tmpl) | `docs/sdlc/design/DESIGN_BRIEF.yaml`            | design gate                                 | `derived_from` (GRILLs/REQs)                 |
| [MODULE.yaml.tmpl](MODULE.yaml.tmpl)             | `docs/sdlc/modules/MOD-<n>.yaml`                | `/crux-modules`                             | `derived_from` (REQs)                        |
| [ADR.yaml.tmpl](ADR.yaml.tmpl)                   | `docs/sdlc/adr/ADR-<n>.yaml`                    | `architect` subagent                        | `resolves`, `satisfies`, `constrains`        |
| [STACK.yaml.tmpl](STACK.yaml.tmpl)               | `docs/sdlc/stack/stack.yaml`                    | `/crux-init`, amended by ADRs               | (singleton)                                  |
| [TOKENS.yaml.tmpl](TOKENS.yaml.tmpl)             | `docs/sdlc/design/TOKENS.yaml`                  | design gate                                 | (singleton per system)                       |
| [TASK.yaml.tmpl](TASK.yaml.tmpl)                 | `docs/sdlc/tasks/<task-id>/TASK.yaml`           | planner / `/crux-task`                      | `satisfies`, `honors_adrs`, `module`         |
| [TEST_PLAN.yaml.tmpl](TEST_PLAN.yaml.tmpl)       | `docs/sdlc/tasks/<task-id>/TEST_PLAN.yaml`      | `test-writer` subagent                      | `task`                                       |
| [REVIEW.yaml.tmpl](REVIEW.yaml.tmpl)             | `docs/sdlc/tasks/<task-id>/REVIEW-<cycle>.yaml` | `reviewer` / `design-reviewer`              | `task`                                       |
| [CHG.yaml.tmpl](CHG.yaml.tmpl)                   | `docs/sdlc/chg/CHG-<n>.yaml`                    | any gate when amending an approved artifact | `superseded_artifacts`, `affected_artifacts` |
| [INCIDENT.yaml.tmpl](INCIDENT.yaml.tmpl)         | `docs/sdlc/incidents/INC-<n>.yaml`              | `/crux-incident report`                     | `violated`, `chg_events_opened`              |
| [AMENDMENT.yaml.tmpl](AMENDMENT.yaml.tmpl)       | `docs/sdlc/amendments/AMD-<n>.yaml`             | `amendment-writer` subagent                 | `triggered_by`, `target_skill`               |
| [HARNESS_LOCK.yaml.tmpl](HARNESS_LOCK.yaml.tmpl) | `docs/sdlc/harness/harness.lock`                | Gate 5 install                              | `stack_manifest_hash`, `skills`              |

## Conventions

- Ids are uppercase, dash-separated, monotonic per type (`REQ-001`, `ADR-001`).
- Every artifact MUST populate its trace fields — orphans fail `scripts/check-orphans.sh`.
- Templates are the single source of truth for schema; downstream tools key off these field names.
- `null` is a legal value where noted. Empty strings are not — leave the key off if there's no value.
