# TASK-CRUX-006 — Capability registry consumer + INC/CHG/AMD plumbing

## Trace block
- **Task:** TASK-CRUX-006
- **Module:** MOD-CRUX-001
- **Mode:** compressed
- **Satisfies:** REQ-CRUX-010 (INC→CHG→AMD cascade end-to-end, no daemon).
- **Honors ADRs:** ADR-CRUX-005 (amendment layering — emitAmendment never edits SKILL.md).
- **Upstream:** GRILL-CRUX-007.

## Summary

Two production modules in `packages/core/src/`:

- `capabilities/registry.ts` — `loadRegistry`, `hasCapability`, `validateSkillCapabilities`, `listGoverningGate`. Distinct error classes (`RegistryNotFoundError`, `MalformedRegistryError`, `DuplicateCapabilityError`).
- `incidents/cascade.ts` — `emitIncident`, `emitChange`, `emitAmendment`, `runCascade`. Synchronous file writes, monotonic id allocation by directory scan, atomic temp+rename. `runCascade` is fully synchronous — no daemon, no setInterval/setTimeout/watcher (verified by reviewer grep).

## Files touched
- `packages/core/src/capabilities/{registry,index}.ts`, `packages/core/src/incidents/{cascade,index}.ts`
- `packages/core/package.json` (exports map adds `./capabilities`, `./incidents`)
- `packages/core/test/capabilities/registry.test.ts`, `packages/core/test/incidents/cascade.test.ts` (92 tests)
- `docs/sdlc/tasks/TASK-CRUX-006/{TEST_PLAN,REVIEW-1}.yaml`

## Reviews
- **REVIEW-1:** `approve`. 1 medium (silent readdirSync swallow in `nextSequence` — should rethrow non-ENOENT), 1 low (INC files missing optional `chg_events_opened` / `amendment_ids` back-link fields — cascade is fully traceable via forward links anyway). Both non-blocking, deferred.
- **Cycles:** 1.

## Known v1.0 limitations
- ID-allocation race: scan-then-write is TOCTOU. Concurrent callers could collide. Single-caller at v1.0; documented in `runCascade` JSDoc. Fix path: `fs.openSync(path, 'ax')` retry loop.
- INC YAML omits optional back-link fields; trace remains complete via CHG/AMD `triggered_by_incident`.

## Quality gates
- vitest 460/460; tsc clean; eslint clean; prettier clean.
- No `setInterval`/`setTimeout`/watcher in production (REQ-010 AC#2 grep-verified).
- SKILL.md byte content unchanged before/after `emitAmendment` (snapshot-asserted in tests).

## Cost
Estimated $3.00; actual ~1× range (parallel pipeline). Cycles: 1.
