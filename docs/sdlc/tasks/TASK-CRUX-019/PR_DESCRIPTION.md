# TASK-CRUX-019 — Stub READMEs for deferred packages

## Trace block

- **Task:** TASK-CRUX-019
- **Module:** MOD-CRUX-003
- **Mode:** compressed
- **Satisfies:** REQ-CRUX-019 (audit consumption surfaces; audit-site/extension-vscode deferred to v1.1).
- **Honors ADRs:** none (doc-only task).

## Summary

Adds `packages/audit-site/README.md` and `packages/extension-vscode/README.md`, each declaring deferral to v1.1 with rationale. The audit-site README references the four v1.0 audit consumption surfaces (markdown/YAML under docs/sdlc, /crux-trace, /crux-status, scripts/render-graph.sh).

## Files touched
- `packages/audit-site/README.md`, `packages/extension-vscode/README.md` (new)
- `packages/core/test/deferred-packages/stubs.test.ts` (22 tests)
- `docs/sdlc/tasks/TASK-CRUX-019/{TEST_PLAN,REVIEW-1}.yaml`

## Reviews
- **REVIEW-1:** `approve`. 1 low process note: the test originally had a 6-`..` path bug that pointed REPO_ROOT to `c:\Dev` instead of `c:\Dev\CRUX`; the coder wrote files to the wrong location on first pass, the orchestrator fixed the test and cleaned stray external dirs, and the test now resolves correctly with 5 `..`. Cycles: 1.

## Quality gates
- vitest 22/22 pass; full regression 285/285; prettier clean.

## Cost
Estimated $0.50; actual ~1× range (parallel pipeline). Cycles: 1.
