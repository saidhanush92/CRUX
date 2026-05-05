# TASK-CRUX-005 — Cost ledger CSV writer + halt-rebase ladder

## Trace block

- **Task:** TASK-CRUX-005
- **Module:** MOD-CRUX-001 (core)
- **Mode:** compressed
- **Satisfies:** REQ-CRUX-011 (per-task cost halt), REQ-CRUX-012 (60s threshold cost ledger).
- **Honors ADRs:** ADR-CRUX-009 (per-task halt contract + halt-rebase ladder, CSV at v1.0).
- **Upstream GRILLs:** GRILL-CRUX-008.

## Summary

Adds the cost-tracking primitives in `packages/core/src/cost/`:

- `ledger.ts` — `appendLedgerRow`, `shouldLog` (60s threshold), `readLedger`. RFC 4180 quoting, in-process mutex via Promise chain, atomic append (`open('a')` + `writeSync` + `fsyncSync`).
- `halt-ladder.ts` — `createHaltLadder` stateful ladder. Default ceiling = 2.0× estimate (configurable to 1.5× per REQ-011 AC#2). Soft-warn fires once at 1.0×. Each `confirm()` raises ceiling by 1.0× additively. After 3 confirmations (5.0× ceiling), the next halt is `autoStop` with `recommendedAction: 'revise-estimate-or-split'` for downstream CHG-event emission (TASK-006).

## Files touched

- `packages/core/src/cost/{ledger,halt-ladder,index}.ts`
- `packages/core/package.json` (exports map adds `./cost`)
- `packages/core/test/cost/{ledger,halt-ladder}.test.ts` (64 tests)
- `docs/sdlc/tasks/TASK-CRUX-005/{TEST_PLAN,REVIEW-1}.yaml`

## Reviews

- **REVIEW-1:** `approve`. 0 critical, 0 high, 0 medium, 1 low (transient prettier on test file, cleaned).
- **Cycles:** 1.

## Quality gates

| Gate | Result |
|---|---|
| `pnpm vitest run packages/core/test/{adapter,gate,mode,trace,cost}` | 251/251 pass |
| `pnpm tsc --noEmit -p tsconfig.json` | clean |
| `pnpm eslint packages/core/src/` | clean |
| `pnpm prettier --check packages/core/` | clean |

## Cost

- Estimated $2.50; actual ~1× range; below 2.0× hard halt at $5.00.
- Cycles: 1.

## Downstream unblocked

TASK-CRUX-006 (CHG event emission consumes `autoStop` signal), TASK-CRUX-016 (`/crux-task` halt enforcement consumes `createHaltLadder`).
