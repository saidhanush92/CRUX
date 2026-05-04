# Count artifacts by type and summarize gate state.
# Usage: scripts/status.ps1
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '_crux.py'
& python $script status @args
exit $LASTEXITCODE
