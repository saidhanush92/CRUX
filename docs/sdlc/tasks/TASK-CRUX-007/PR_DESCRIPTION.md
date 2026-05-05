# TASK-CRUX-007 — Adapter interface declaration: 17 fns, 7 concern groups

## Trace block

- **Task:** TASK-CRUX-007
- **Module:** MOD-CRUX-002 (adapter)
- **Mode:** compressed (per `stack.yaml.crux_mode`)
- **Satisfies:**
  - REQ-CRUX-005 — Adapter interface 16–18 fns across 7 concern groups; count locked once committed.
- **Honors ADRs:**
  - ADR-CRUX-003 — Runtime adapter interface: 17 functions in 7 concern groups (accepted).
- **Upstream GRILLs:** GRILL-CRUX-004 (via REQ-CRUX-005, ADR-CRUX-003).

## Summary

Declares the `RuntimeAdapter` TypeScript interface plus its supporting types in `packages/core/src/adapter/`. The 17 function names and 7 concern-group counts come straight from ADR-CRUX-003. The single source of truth is `ADAPTER_INTERFACE_MANIFEST` (a deeply-readonly `as const` literal); the interface is derived from it via `keyof`/lookup types so manifest ↔ interface drift is structurally impossible. ID types (`SessionId`, `SubagentHandle`, `SkillId`, `CapabilityId`) are branded. `ADAPTER_CONCERN_GROUPS` is a 7-element literal tuple.

## Files touched

- `packages/core/src/adapter/interface.ts` — `RuntimeAdapter`, `ADAPTER_INTERFACE_MANIFEST`, `ADAPTER_CONCERN_GROUPS`, `AdapterFunctionName`, `AdapterSignatures`.
- `packages/core/src/adapter/types.ts` — branded ID types and supporting structural types.
- `packages/core/test/adapter/interface.test.ts` — 29 tests locking name list, group counts, manifest/interface coupling, no extras, no duplicates.
- `docs/sdlc/tasks/TASK-CRUX-007/TEST_PLAN.yaml`, `REVIEW-1.yaml`, `REVIEW-2.yaml`.

## Reviews

- **REVIEW-1** — verdict: `request_changes`. 1 critical (false positive: pre-existing `.claude/settings*.json` dirty from Phase 8, not TASK-007 writes), 1 medium (manifest ↔ interface coupled by convention), 2 low (ID brands, tuple-typed groups).
- **REVIEW-2** — verdict: `approve`. False-positive critical confirmed via `git log` (last commit touching settings is `ee9f1df` Phase 8). Medium fixed by structural derivation. Lows fixed.
- **Cycles:** 2.

## Quality gates (re-run on cycle 2 final state)

| Gate | Result |
|---|---|
| `pnpm vitest run packages/core/test/adapter/` | 29/29 pass |
| `pnpm tsc --noEmit -p tsconfig.json` | clean |
| `pnpm eslint packages/core/src/adapter/` | clean |
| `pnpm prettier --check packages/core/src/adapter/` | clean |

## Cost

- **Estimated:** $3.00 (per TASK-CRUX-007.estimated_cost_usd)
- **Actual:** within estimate (≈ 1× range; below the 2.0× hard halt at $6.00 per ADR-CRUX-009).
- **Cycles:** 2 (test-writer × 1, coder × 2, reviewer × 2).

## Diff stats

```
docs/sdlc/tasks/TASK-CRUX-007/REVIEW-1.yaml  | 105 ++++++++++
docs/sdlc/tasks/TASK-CRUX-007/REVIEW-2.yaml  |  97 +++++++++
docs/sdlc/tasks/TASK-CRUX-007/TEST_PLAN.yaml |  63 ++++++
packages/core/src/adapter/interface.ts       | 108 ++++++++++
packages/core/src/adapter/types.ts           |  62 ++++++
packages/core/test/adapter/interface.test.ts | 282 +++++++++++++++++++++++++++
6 files changed, 717 insertions(+)
```

## Downstream unblocked

TASK-CRUX-008, -009 (adapter implementation), TASK-CRUX-010 (paper-only second-adapter spec), TASK-CRUX-015, -016 (CLI wiring) all become workable now that the interface is locked.
