# @crux/audit-site

> **Status: deferred to v1.1** — This package is a stub at v1.0. No build artifacts, Astro
> config, or CI workflows exist here yet.

## v1.0 Audit Consumption Surfaces

At v1.0, the CRUX audit trail is fully accessible through four surfaces that cover the
founding-team's day-to-day needs without the operational overhead of a deployed web
application:

1. **`docs/sdlc/`** — Browsable Markdown and YAML files (REQs, ADRs, MODs, task plans)
   checked into the monorepo and readable in any editor or on GitHub.

2. **`/crux-trace`** — The CLI command `crux-trace` streams a live, structured trace of
   gate evaluations and cost events directly to the terminal.

3. **`/crux-status`** — The `crux-status` command prints a human-readable summary of
   current gate states and phase progression for rapid health checks.

4. **`scripts/render-graph.sh`** — A shell script that renders the task DAG and phase
   graph as a static SVG or PNG, suitable for attaching to reviews or design docs.

These surfaces provide complete audit coverage for a founding team and eliminate the
need to deploy and maintain a dedicated web application during the initial phase of
the project.

## Why the Astro Audit Site Is Deferred

Shipping a production Astro application requires a non-trivial operational surface:
build pipelines, CDN deployment, Chromatic visual-regression runs, and ongoing
dependency maintenance. At v1.0, the founding team is small and the four surfaces
above already satisfy every audit use-case identified in REQ-CRUX-019. Investing
engineering time in a hosted site before those surfaces show gaps would violate YAGNI
and stretch the team across concerns that do not yet have validated demand.

The audit site is therefore deferred to v1.1, when real usage data will inform which
views (graph visualization, cost dashboards, timeline diffs) are worth building and
how they should be structured.

## v1.1 Preview

In v1.1 the audit site will provide:

- **Interactive DAG visualization** — a zoomable, filterable graph of tasks, gates, and
  phase dependencies rendered from the monorepo's YAML sources at build time.
- **Cost timeline** — charts showing token and API cost accumulation across runs,
  derived from `crux-trace` structured output.
- **Gate status dashboard** — a per-phase summary of gate states with drill-down into
  individual task traces.
- **Search and diff** — full-text search across REQs, ADRs, and MODs with side-by-side
  diff views for document revisions.

The Astro framework, Storybook component catalog, and Chromatic visual regression
pipeline will be introduced at that point.
