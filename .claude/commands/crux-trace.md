---
description: Walk the trace graph for any artifact id — upstream toward input, downstream toward code.
allowed-tools: Read, Glob, Grep, Bash
argument-hint: "<artifact-id>"
---

You are running `/crux-trace` with id: $ARGUMENTS

## Resolve the id

1. Strip whitespace. Match against the known prefixes:
   `IDEA-`, `GRILL-`, `REQ-`, `MOD-`, `ADR-`, `TASK-`, `CHG-`, `INC-`, `AMD-`.
2. Locate the artifact file under `docs/sdlc/`. If not found, halt with the prefix-to-path map and ask for the correct id.

## Walk upstream (toward the original input)

Recursively follow the trace fields by artifact type:
- `IDEA` → root (no upstream).
- `GRILL` → its `idea` field (extension), or the IDEA referenced in `defer_to` chain.
- `REQ` → all `derived_from` GRILL ids; AND any spec-critique entry whose `target` includes this REQ (mark with `⚠`); AND any `triggered_by_critique` link if the REQ was rewritten in response to a critique.
- `MOD` → all `derived_from` REQ ids → their GRILLs → IDEA.
- `ADR` → `resolves` (GRILLs) + `satisfies` (REQs); AND any arch-critique entry whose `target` includes this ADR; AND any pre-mortem failure mode whose `routing_target` matches this ADR; AND any `triggered_by_critique` link if the ADR was amended in response to a critique.
- `TASK` → `satisfies` (REQs) + `honors_adrs` (ADRs) + `module` (MOD); for tasks routed from `route-to-test` pre-mortem items, also follow `triggered_by_failure_mode` to the originating PM-<n> id.
- `CHG` → `superseded_artifacts` + `affected_artifacts`.
- `INC` → `violated` (REQs/ADRs).
- `AMD` → `triggered_by` (INC id, if applicable).

Render as an indented tree. For each node, print: id, type, one-line summary (extracted from `text` / `title` / `responsibility` / `decision` field).

## Walk downstream (toward production code)

Inverse direction. For each artifact type, find every artifact that references this one in its trace fields:
- `grep -r "$ARGUMENTS" docs/sdlc/` — quick first pass.
- For each match, parse the YAML and confirm the id appears in a *trace field* (not in a comment or unrelated string).
- For TASKs, also list the files in `touches_files` — these are the production-code endpoints of the chain.

### Critique inclusion

For REQ and ADR ids specifically, also surface any associated critique entries:
- `docs/sdlc/prd/spec-critique.yaml` — list every entry whose `target` includes a REQ being walked.
- `docs/sdlc/adr/arch-critique.yaml` — list every entry whose `target` includes an ADR being walked.
- `docs/sdlc/adr/pre-mortem.yaml` — list every failure mode whose `routing_target` matches an ADR being walked.

Render critique entries with a `⚠` prefix to mark them visually distinct from regular artifacts. Each critique line shows: id, category, severity, one-line finding.

Render as a separate indented tree, growing downward.

## Output

```
UPSTREAM
└── $ARGUMENTS  <type>  <one-line>
    └── <parent>  ...
        └── ...

DOWNSTREAM
└── $ARGUMENTS
    └── <child>  ...
```

End with:
- Total nodes visited.
- Any orphan markers (artifacts whose claimed parent does not exist) — these are integrity violations.

## Performance note

For repos with >1000 artifacts, this command must complete in under 200ms. Use `Grep` (ripgrep) over `Read` where possible. Cache parsed YAML between recursive steps.
