# Contributing to Crux

Crux uses its own SDLC pipeline to manage its own development. Every change
must trace back to a requirement; every requirement must trace back to a
grilled assumption. This document explains how to participate.

## Prerequisites

- **Node.js** 20.10+ (and < 23). See `docs/sdlc/stack/stack.yaml`.
- **pnpm** 10.33.2 (matches `package.json` `packageManager` pin).
- **Python** 3.10+ (for the bootstrap helper scripts under `scripts/`).
- **Git** 2.40+.

## Setup

```bash
git clone <repo>
cd crux
pnpm install
pnpm verify   # runs format:check + lint + typecheck + test
```

## How Crux develops Crux

Every change must:

1. **Have a TASK file in `docs/sdlc/tasks/`** — produced by the planner at gate 3 or by `/crux-task`.
2. **Pass through `/crux-task`** — which runs test-writer → coder → reviewer (and design-reviewer if UI).
3. **Open a PR with a trace block** — see `.github/pull_request_template.md`. The trace block is generated automatically into `docs/sdlc/tasks/<task-id>/PR_DESCRIPTION.md`.

You cannot bypass these gates and merge to `main`. The `trace-lint.yml` CI
workflow runs `scripts/check-orphans.sh` daily; orphans (artifacts missing
trace fields) fail the build.

## Commit conventions

Conventional Commits: `<type>: <description>`. Types: `feat`, `fix`,
`refactor`, `docs`, `test`, `chore`, `perf`, `ci`. Body should explain
_why_, not _what_ (the diff says what). Reference artifact ids
(`REQ-CRUX-NNN`, `ADR-CRUX-NNN`, `TASK-CRUX-NNN`) when relevant.

## Branching

- `main` is protected. Only PRs that pass CI and at least one reviewer
  approval (in addition to the agent reviewer) may merge.
- Feature branches: `feat/<short-slug>`.
- Fix branches: `fix/<short-slug>`.

## Reporting issues

For incidents in production code: use `/crux-incident report`. The
amendment-writer subagent will cascade the report into INC, CHG, and AMD
artifacts (per ADR-CRUX-005).

For bugs not yet in production: open a GitHub issue with the trace
context (which REQ or ADR appears violated).

## Agent identity

Crux uses three subagent identities for build work: `test-writer`,
`coder`, `reviewer` (plus `design-reviewer` for UI). Per ADR-CRUX-004
they run as separate Task invocations with no shared transcript context.
If you contribute by hand, please respect this separation: don't write
both the failing test and the production code in the same change.
