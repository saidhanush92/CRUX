# List artifacts associated with gate <n>.
# Usage: scripts/gate.ps1 <N>
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '_crux.py'
& python $script gate @args
exit $LASTEXITCODE
