# TASK-CRUX-010 — Paper-only second-adapter spec (raw Anthropic SDK)

## Trace block

- **Task:** TASK-CRUX-010
- **Module:** MOD-CRUX-002 (adapter)
- **Mode:** compressed
- **Satisfies:** REQ-CRUX-007 (provisional runtime-neutrality language).
- **Honors ADRs:** ADR-CRUX-003 (`validated_by` paper-spec clause).
- **Upstream:** GRILL-CRUX-005, ARCH-CRIT-002.

## Summary

Adds `docs/sdlc/architecture/adapter-second-spec.md` — a paper-only feasibility analysis of implementing the 17-fn adapter against the raw Anthropic SDK. Each of the 17 functions is marked `feasible` (11) or `unknown` (6); zero `needs-redesign`, so ADR-CRUX-003 does not need to be reopened pre-v1.0.

## Files touched
- `docs/sdlc/architecture/adapter-second-spec.md` (new)
- `packages/core/test/architecture/adapter-second-spec.test.ts` (12 tests)
- `docs/sdlc/tasks/TASK-CRUX-010/{TEST_PLAN,REVIEW-1}.yaml`

## Reviews
- **REVIEW-1:** `approve`. 0 concerns. Cycles: 1.

## Quality gates
- vitest 12/12 pass; full regression 263/263; prettier clean.

## Cost
Estimated $1.50; actual within range. Cycles: 1.
