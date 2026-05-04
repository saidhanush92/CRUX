# Render the trace graph as Mermaid (default) or DOT.
# Usage: scripts/render-graph.ps1 [-format mermaid|dot]
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '_crux.py'
& python $script render-graph @args
exit $LASTEXITCODE
