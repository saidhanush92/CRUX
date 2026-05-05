# @crux/extension-vscode

> **Status: deferred to v1.1** — This package is a stub at v1.0. No extension manifest,
> activation code, or build config exists here yet.

## Why the VS Code Extension Is Deferred

A VS Code extension adds its own packaging and publishing surface (VSIX build, Marketplace
publisher credentials, extension host sandbox testing) on top of an already full v1.0 scope.
The CLI commands `crux-trace` and `crux-status` already surface gate state and trace output
in any terminal panel inside VS Code, satisfying the founding team's in-editor needs without
requiring an installed extension. Introducing the extension before the CLI contracts are
stable would couple two moving surfaces unnecessarily and slow iteration on the core library.

The extension is therefore deferred to v1.1, once the CLI API and trace format have
stabilised under real usage.

## v1.1 Preview

In v1.1 the extension will provide:

- **Sidebar trace browser** — a tree view of recent `crux-trace` runs, expandable by phase,
  task, and gate evaluation, updating live as the CLI emits events.
- **Gate status indicator** — a status-bar item showing the current phase and gate state
  (green / amber / red) without leaving the editor.
- **Inline REQ annotations** — CodeLens annotations on source files that link to the REQ
  or ADR governing the surrounding code, derived from MOD metadata in `docs/sdlc/`.
- **Quick-pick command palette** — commands to jump to any task plan, REQ, or ADR file
  by name, filtered from the monorepo YAML index.
- **Cost summary hover** — hover tooltips on trace identifiers showing cumulative token
  cost for that run, sourced from `crux-trace` structured output.
