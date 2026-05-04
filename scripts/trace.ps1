# Walk the trace graph for an artifact id (upstream + downstream).
# Usage: scripts/trace.ps1 <ARTIFACT-ID>
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '_crux.py'
& python $script trace @args
exit $LASTEXITCODE
