---
description: Bootstrap a new Crux project — detect or declare stack, write stack.yaml.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: "[--greenfield | --brownfield]"
---

You are running `/crux-init` for the Crux project. The user has invoked this in either a greenfield (empty repo) or brownfield (existing code) context.

## Detect mode

1. Run `git ls-files | head` and `ls -la`. If the repo has substantial source code (>20 source files outside `docs/`, `templates/`, `scripts/`), treat it as **brownfield**. Otherwise **greenfield**.
2. Check whether `docs/sdlc/stack/stack.yaml` already exists. If it does, halt and tell the user to delete it first or run `/crux-architect` to amend instead.

## Greenfield path

1. Ask the user to pick a stack reference. Offer the seed list: `typescript-monorepo`, `python-uv`, `golang-cli`, `astro-site`. Allow free-form input.
2. Read `templates/STACK.yaml.tmpl`. Copy it to `docs/sdlc/stack/stack.yaml`.
3. Fill in language, runtime, package manager, and the framework block from the chosen reference. Leave `data`, `ops`, `quality_gates` populated with sensible defaults from the template.
4. Do NOT pick frameworks the user did not consent to. When unsure, leave a `# TODO: confirm via /crux-grill` comment.

## Brownfield path

1. Detect language(s) by file extensions: `.ts/.tsx` → TypeScript; `.py` → Python; `.go` → Go; etc. Report the distribution.
2. Detect package manager: `pnpm-lock.yaml` → pnpm; `package-lock.json` → npm; `uv.lock` → uv; `go.sum` → go modules; `Cargo.lock` → cargo.
3. Detect test runner by config files (`vitest.config.*`, `pyproject.toml [tool.pytest]`, `go test`, etc.).
4. Read `templates/STACK.yaml.tmpl` and write `docs/sdlc/stack/stack.yaml` populated from detection. Mark every detected field with a `# detected` comment so the human knows what was inferred vs. declared.
5. Surface a numbered list of unresolved questions (e.g., "no e2e runner detected — declare or skip?"). Do NOT auto-pick.

## Output

- Write `docs/sdlc/stack/stack.yaml`.
- Print a 5-line summary: language, runtime, pm, test, e2e.
- Print the unresolved-question list, if any.
- Append an entry to `docs/sdlc/approvals.log`:
  `<timestamp>  /crux-init  <mode>  stack.yaml created`
