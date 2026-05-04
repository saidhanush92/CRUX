#!/usr/bin/env bash
# Render the trace graph as Mermaid (default) or DOT.
# Usage: scripts/render-graph.sh [--format mermaid|dot]
set -euo pipefail
exec python "$(dirname "$0")/_crux.py" render-graph "$@"
