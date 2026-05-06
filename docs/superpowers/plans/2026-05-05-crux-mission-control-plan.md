# Crux Mission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone docs-based HTML mock that presents three tabs for Crux mission-control visualization.

**Architecture:** A single self-contained HTML file in `docs/` will hold the markup, CSS, seeded data, and client-side tab interactions. Two lightweight markdown files capture the design rationale and implementation plan for future integration into `packages/audit-site`.

**Tech Stack:** HTML, CSS, vanilla JavaScript

---

### Task 1: Create the design and planning artifacts

**Files:**

- Create: `docs/superpowers/specs/2026-05-05-crux-mission-control-design.md`
- Create: `docs/superpowers/plans/2026-05-05-crux-mission-control-plan.md`

- [ ] Add a concise design spec describing audience, visual direction, layout regions, and success criteria.
- [ ] Add this implementation plan with the target file path and UI responsibilities.

### Task 2: Build the standalone mission-control mock

**Files:**

- Create: `docs/crux-mission-control.html`

- [ ] Add shared seeded data for gates, agents, artifacts, blockers, and event stream.
- [ ] Build a global frame with top status bar and 8-gate rail.
- [ ] Add three tabs: `Cinematic`, `Executive`, and `Operator`.
- [ ] Render a distinct layout for each tab using the shared data.
- [ ] Add lightweight interactions for tab switching and gate selection.
- [ ] Add motion accents that suggest live activity without requiring libraries.

### Task 3: Verify the mock

**Files:**

- Verify: `docs/crux-mission-control.html`

- [ ] Open the HTML file locally and confirm all three tabs render with visible differences.
- [ ] Confirm the gate rail, agent panels, artifact panels, and event stream are readable on desktop.
- [ ] Summarize how the user can open the file directly from the repository.
