# TASK-CRUX-002 — Trace graph: markdown reader + writer

## Trace block

- **Task:** TASK-CRUX-002
- **Module:** MOD-CRUX-001 (core)
- **Mode:** compressed
- **Satisfies:** REQ-CRUX-003 — markdown/YAML canonical storage; cache must be derivable from canonical.
- **Honors ADRs:** ADR-CRUX-002 — markdown canonical + atomic writes (temp+fsync+rename).
- **Upstream GRILLs:** GRILL-CRUX-003.
- **Scope:** canonical layer only. SQLite cache is TASK-CRUX-003.

## Summary

Adds the markdown/YAML canonical layer for the trace graph in `packages/core/src/trace/`:

- `Artifact` discriminated union (kind: REQ|ADR|MOD|GRILL|TASK|INCIDENT|CHG|AMENDMENT) inferred from filename prefix; id from filename stem (or parent dir for `TASK.yaml`).
- `readArtifact`, `scanArtifacts`, `writeArtifact`, `extractEdges`, `buildGraph`, `computeArtifactHash`.
- Hand-rolled YAML parser sufficient for artifact templates (no new deps): scalar/quoted/block-scalar values, lists of scalars, lists of inline mappings, 2-level nested mappings.
- Atomic writes (temp+fsync+rename) with `.tmp` cleanup on rename failure.
- `stripDoubledDrivePrefix` defensive helper for cross-platform path edge cases.

## Files touched

- `packages/core/src/trace/{markdown,types,index}.ts`
- `packages/core/package.json` (exports map adds `./trace`)
- `packages/core/test/trace/markdown.test.ts` (81 tests)
- `docs/sdlc/tasks/TASK-CRUX-002/{TEST_PLAN,REVIEW-1,REVIEW-2}.yaml`

## Reviews

- **REVIEW-1:** `request_changes`. 0 critical, 0 high, 3 medium, 2 low. Path-normaliser duplication; silent swallows in walk(); .tmp leak on rename failure; prettier on test; index.ts bookkeeping.
- **REVIEW-2:** `approve`. All mediums resolved. Lows accepted.
- **Cycles:** 2.

## Quality gates (cycle 2 final)

| Gate | Result |
|---|---|
| `pnpm vitest run packages/core/test/{adapter,gate,mode,trace}` | 187/187 pass |
| `pnpm tsc --noEmit -p tsconfig.json` | clean |
| `pnpm eslint packages/core/src/` | clean |
| `pnpm prettier --check packages/core/` | clean |

## Cost

- Estimated $2.50; actual ~1× range; below 2.0× hard halt at $5.00.
- Cycles: 2.

## Downstream unblocked

TASK-CRUX-003 (SQLite cache), TASK-CRUX-004 (amendment merge), TASK-CRUX-006 (capability registry / INC/CHG/AMD plumbing) — all consume `buildGraph` / `extractEdges`.
