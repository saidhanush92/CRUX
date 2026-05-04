#!/usr/bin/env bash
# List artifacts associated with gate <n>.
# Usage: scripts/gate.sh <N>
set -euo pipefail
exec python "$(dirname "$0")/_crux.py" gate "$@"
