#!/usr/bin/env bash
# Walk the trace graph for an artifact id (upstream + downstream).
# Usage: scripts/trace.sh <ARTIFACT-ID>
set -euo pipefail
exec python "$(dirname "$0")/_crux.py" trace "$@"
