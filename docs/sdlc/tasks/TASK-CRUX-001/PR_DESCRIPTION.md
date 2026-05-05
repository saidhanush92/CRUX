# TASK-CRUX-001 — Gate state machine + crux_mode reader

## Trace block

- **Task:** TASK-CRUX-001
- **Module:** MOD-CRUX-001 (core)
- **Mode:** compressed (per `stack.yaml.crux_mode`)
- **Satisfies:** REQ-CRUX-008 — gate-mode dial via `stack.yaml.crux_mode` + artifact-invariance.
- **Honors ADRs:** ADR-CRUX-001 (TS monorepo + pnpm), ADR-CRUX-006 (gate-mode dial).
- **Upstream GRILLs:** GRILL-CRUX-006.

## Summary

First scaffolding of `@crux/core`. Adds `packages/core/package.json`, `tsconfig.json`, plus two domain modules:

- `src/gate/state-machine.ts` — closure-based `GateMachine` over `GateId 1..8` with status `open|closed|blocked|skipped`, predecessor-ordered `open()`/`skip()`, `block(reason)`, immutable `current()`/`all()` snapshots, atomic `serialize`/`deserialize` with per-entry validation.
- `src/mode/crux-mode.ts` — `CruxMode` type, `readCruxMode()` (zero-dep regex YAML extractor), `assertValidCruxMode()`, `defaultModeFor('greenfield'|'brownfield')`, `isAutoApproveMode()`. Three distinct error classes for not-found / missing-field / invalid-value paths.

No new runtime dependencies. The exports map adds `./gate`, `./mode`, and re-exposes the existing `./adapter` module from TASK-007.

## Files touched

- `packages/core/package.json` (new), `packages/core/tsconfig.json` (new)
- `packages/core/src/gate/{state-machine,index}.ts`
- `packages/core/src/mode/{crux-mode,index}.ts`
- `packages/core/test/gate/state-machine.test.ts` (43 tests)
- `packages/core/test/mode/crux-mode.test.ts` (34 tests)
- `docs/sdlc/tasks/TASK-CRUX-001/{TEST_PLAN,REVIEW-1,REVIEW-2}.yaml`

## Reviews

- **REVIEW-1** — `request_changes`. 0 critical, 0 high, 2 medium, 2 low. Prettier on test file; uppercase-input regex routing to wrong error class; `skip()` asymmetry vs `open()`; `deserialize()` accepted invalid entries.
- **REVIEW-2** — `approve`. 3 lows remain (test-coverage gaps for the cycle-2 fixes); none blocking.
- **Cycles:** 2.

## Quality gates (cycle 2 final)

| Gate | Result |
|---|---|
| `pnpm vitest run packages/core/test/{gate,mode,adapter}` | 106/106 pass |
| `pnpm tsc --noEmit -p tsconfig.json` | clean |
| `pnpm eslint packages/core/src/` | clean |
| `pnpm prettier --check packages/core/` | clean |

## Cost

- Estimated: $2.50. Actual: ~1× range; below 2.0× hard halt at $5.00.
- Cycles: 2 (test-writer × 1, coder × 2, reviewer × 2).

## Downstream unblocked

TASK-CRUX-011 (CLI entry) — its dependency on TASK-001 is now satisfied.
