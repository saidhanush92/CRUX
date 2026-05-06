# TASK-CRUX-004 — Amendment merge + cycle detection

## Trace block
- **Task:** TASK-CRUX-004
- **Module:** MOD-CRUX-001
- **Mode:** compressed
- **Satisfies:** REQ-CRUX-018 (amendment layering), REQ-CRUX-021 (cycle detection in module graph).
- **Honors ADRs:** ADR-CRUX-005 (amendment files separate, runtime merge).
- **Upstream:** GRILL-CRUX-014, GRILL-CRUX-017.

## Summary

Two pure primitives in `packages/core/src/`:

- `amendments/resolve.ts` — `resolveAmendmentsForSkill(skillName, rootDir): string`. Reads SKILL.md, scans `docs/sdlc/amendments/`, appends matching `## Active amendments`. `severity: high` renders `**BLOCKING:**`. Read-only on SKILL.md (asserted in tests).
- `graph/cycle.ts` — `detectCycles(modules): CycleReport`. Iterative DFS, three-color marking. Self-loops, multiple disjoint cycles, lexicographic determinism. Edges to non-existent modules surface in `unknownTargets` (not cycles). Pure — never mutates input.

## Files touched
- `packages/core/src/amendments/{resolve,index}.ts`, `packages/core/src/graph/{cycle,index}.ts`
- `packages/core/package.json` (exports map adds `./amendments`, `./graph`)
- `packages/core/test/amendments/resolve.test.ts`, `packages/core/test/graph/cycle.test.ts` (40 tests)
- `docs/sdlc/tasks/TASK-CRUX-004/{TEST_PLAN,REVIEW-1}.yaml`

## Reviews
- **REVIEW-1:** `approve`. 1 medium (dead `pathSet` in DFS Frame; harmless, ~50 wasted allocations per cycle), 1 low (parseFlatYaml doesn't strip quotes — latent on quoted YAML values that no current template uses). Both non-blocking, deferred.
- **Cycles:** 1.

## Quality gates
- vitest 460/460; tsc clean; eslint clean; prettier clean.

## Cost
Estimated $3.00; actual ~1× range. Cycles: 1.
