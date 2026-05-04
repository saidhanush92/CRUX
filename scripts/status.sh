#!/usr/bin/env bash
# Count artifacts by type and summarize gate state.
# Usage: scripts/status.sh
set -euo pipefail
exec python "$(dirname "$0")/_crux.py" status "$@"
