# TASK-CRUX-003 — Trace graph SQLite cache + indexer with concurrent-write semantics

## Trace block
- **Task:** TASK-CRUX-003
- **Module:** MOD-CRUX-001
- **Mode:** compressed
- **Satisfies:** REQ-CRUX-004 (markdown wins on disagreement; sha256+mtime invalidation), with REQ-CRUX-003 cache-rebuild-lossless contract honored end-to-end.
- **Honors ADRs:** ADR-CRUX-002 (concurrent-write semantics), ADR-CRUX-011 (sql.js binding pivoted from better-sqlite3).
- **Upstream:** GRILL-CRUX-003, PM-CRUX-001 (race condition).

## Summary

Implements the SQLite cache and indexer in `packages/core/src/trace/`:

- `cache.ts` — `TraceCache` over sql.js: schema-on-create, atomic flush via async temp+fsync+rename, sha256+mtime per file, replace-all-edges-from semantics on upsert.
- `indexer.ts` — debounced (100ms) FIFO queue with explicit `isPostScan` phase tracker. During `onPassStart`, enqueues coalesce; after the scan begins, a new enqueue creates a follow-up item that runs a fresh scan after the in-flight pass commits — fulfilling ADR-CRUX-002's "follow-up pass after commit" promise. `readArtifact` recomputes inline on hash mismatch and persists the correction via `flush()`.
- `schema/v1.sql` — artifacts/edges/meta tables + indexes on edge endpoints. Included in published `files` array.
- `path-utils.ts` — extracted `stripDoubledDrivePrefix` shared by markdown.ts and cache.ts.

## Files touched

- `packages/core/src/trace/{cache,indexer,path-utils,index}.ts`, `packages/core/schema/v1.sql`
- `packages/core/src/trace/markdown.ts` (consume shared path-utils)
- `packages/core/package.json` (add `files: ["dist", "schema"]`)
- `packages/core/test/trace/{cache,indexer}.test.ts` (43 new tests; 124 trace tests total)
- `docs/sdlc/tasks/TASK-CRUX-003/{TEST_PLAN,REVIEW-1,REVIEW-2}.yaml`
- ADR-CRUX-011 written + stack.yaml amended (sql.js binding) — committed earlier

## Reviews

- **REVIEW-1:** `request_changes`. 2 high (await onPassComplete; FIFO follow-up gap; missing rename-failure cleanup test), 4 medium, 2 low.
- **REVIEW-2:** `approve`. All resolved. One residual non-blocking: `onAfterScan` is a test-internal hook annotated `@internal` but on the public type — clean up when API stabilizes.
- **Cycles:** 2.

## Quality gates (cycle 2 final)

| Gate | Result |
|---|---|
| `pnpm vitest run packages/core/test/{adapter,gate,mode,trace,cost,architecture,deferred-packages}` | 328/328 |
| `pnpm tsc --noEmit -p tsconfig.json` | clean |
| `pnpm eslint packages/core/src/` | clean |
| `pnpm prettier --check packages/core/` | clean |

## Cost
Estimated $4.00; actual elevated (cycle 2 needed for ADR-002 follow-up semantics fix) but inside the 2.0× hard halt at $8.00.
Cycles: 2.

## Downstream unblocked
TASK-CRUX-017 (`/crux-status` + `/crux-trace` + `/crux-incident`) — its dependency on TASK-003 is now satisfied.
