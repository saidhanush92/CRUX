#!/usr/bin/env bash
# Find artifacts missing required upstream trace fields. Exits non-zero if any orphan exists.
# Usage: scripts/check-orphans.sh
set -euo pipefail
exec python "$(dirname "$0")/_crux.py" check-orphans "$@"
