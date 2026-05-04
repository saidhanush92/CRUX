# Crux skill index

Curated subset of skills imported into the Crux harness. Every skill here was augmented with Crux frontmatter (`origin`, `source_kind`, `imported_from`, `imported_at`, `purpose: harness`, `provides_capabilities`) on import. The underlying `description` and body remain verbatim from the upstream source.

Sources:

- **Pocock** — `mattpocock/skills` (cloned for import only).
- **ECC** — `affaan-m/everything-claude-code` via local checkout at `c:/Dev/everything-claude-code/`. For three seed-list items that are commands or agents in ECC rather than skills (`code-review`, `silent-failure-hunter`, `update-codemaps`), the source file is wrapped under `SKILL.md` and the `source_kind` field records the original ECC artifact type.

Phase 4 imported 15 skills total (4 Pocock, 11 ECC).

---

## Pocock

### `diagnose`
- **kind:** skill
- **provides:** process.diagnostic-loop, quality.root-cause-analysis
- **summary:** Disciplined diagnosis loop for hard bugs and performance regressions. Reproduce → minimise → hypothesise → instrument → fix → regression-...

### `grill-me`
- **kind:** skill
- **provides:** process.adversarial-grill, process.assumption-surfacing
- **summary:** Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. U...

### `grill-with-docs`
- **kind:** skill
- **provides:** process.adversarial-grill, process.docs-grounded-grill
- **summary:** Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md...

### `zoom-out`
- **kind:** skill
- **provides:** process.context-reframing
- **summary:** Tell the agent to zoom out and give broader context or a higher-level perspective. Use when you're unfamiliar with a section of code or n...

## ECC

### `accessibility`
- **kind:** skill
- **provides:** design.a11y, design.wcag-aa
- **summary:** Design, implement, and audit inclusive digital products using WCAG 2.2 Level AA

### `architecture-decision-records`
- **kind:** skill
- **provides:** process.adr-authoring
- **summary:** Capture architectural decisions made during Claude Code sessions as structured ADRs. Auto-detects decision moments, records context, alte...

### `code-review`
- **kind:** command
- **provides:** quality.code-review
- **summary:** Code review — local uncommitted changes or GitHub PR (pass PR number/URL for PR mode)

### `documentation-lookup`
- **kind:** skill
- **provides:** process.docs-lookup
- **summary:** Use up-to-date library and framework docs via Context7 MCP instead of training data. Activates for setup questions, API references, code ...

### `e2e-testing`
- **kind:** skill
- **provides:** testing.e2e, testing.playwright
- **summary:** Playwright E2E testing patterns, Page Object Model, configuration, CI/CD integration, artifact management, and flaky test strategies.

### `git-workflow`
- **kind:** skill
- **provides:** process.git-workflow
- **summary:** Git workflow patterns including branching strategies, commit conventions, merge vs rebase, conflict resolution, and collaborative develop...

### `hexagonal-architecture`
- **kind:** skill
- **provides:** process.hex-architecture
- **summary:** Design, implement, and refactor Ports & Adapters systems with clear domain boundaries, dependency inversion, and testable use-case orches...

### `silent-failure-hunter`
- **kind:** agent
- **provides:** quality.silent-failure-detection
- **summary:** Review code for silent failures, swallowed errors, bad fallbacks, and missing error propagation.

### `tdd-workflow`
- **kind:** skill
- **provides:** testing.tdd-loop, quality.coverage-floor
- **summary:** Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test-driven development with 80%+ coverage including...

### `update-codemaps`
- **kind:** command
- **provides:** process.codemap-maintenance
- **summary:** Scan project structure and generate token-lean architecture codemaps.

### `verification-loop`
- **kind:** skill
- **provides:** quality.verification-loop
- **summary:** A comprehensive verification system for Claude Code sessions.

---

`provides_capabilities` values are first-pass mappings; Phase 6 cross-references them against `capabilities/registry.v1.yaml` and reconciles drift.
