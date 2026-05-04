# Find artifacts missing required upstream trace fields. Exits non-zero if any orphan exists.
# Usage: scripts/check-orphans.ps1
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '_crux.py'
& python $script check-orphans @args
exit $LASTEXITCODE
