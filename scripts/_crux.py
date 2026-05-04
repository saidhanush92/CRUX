"""Crux bootstrap CLI core — read-only artifact graph utilities.

Exposes subcommands: trace, status, gate, check-orphans, render-graph.
Used by thin .sh/.ps1 wrappers under scripts/. Cross-platform.

Bootstrap-only. Replaced by the real CLI in packages/cli/ during Phase 9.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml  # type: ignore
except ImportError:
    sys.stderr.write('FATAL: PyYAML required. Install with: pip install pyyaml\n')
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent
SDLC = REPO_ROOT / 'docs' / 'sdlc'

# Map artifact prefix -> directory under docs/sdlc
PREFIX_DIR = {
    'IDEA': 'input',
    'GRILL': 'grill',
    'REQ':   'prd',
    'MOD':   'modules',
    'ADR':   'adr',
    'TASK':  'tasks',
    'CHG':   'chg',
    'INC':   'incidents',
    'AMD':   'amendments',
}

# Trace fields by prefix (upstream walks read these; downstream walks invert them)
UPSTREAM_FIELDS = {
    'GRILL': ['idea'],
    'REQ':   ['derived_from'],
    'MOD':   ['derived_from'],
    'ADR':   ['resolves', 'satisfies'],
    'TASK':  ['satisfies', 'honors_adrs', 'module'],
    'CHG':   ['superseded_artifacts', 'affected_artifacts'],
    'INC':   ['violated'],
    'AMD':   ['triggered_by'],
}

GATE_NAMES = {
    1: 'input',
    2: 'PRD',
    3: 'modules',
    4: 'architecture',
    5: 'harness',
    6: 'design',
    7: 'build',
    8: 'release',
}


# ---------- artifact discovery ----------

def all_artifacts() -> list[Path]:
    if not SDLC.exists():
        return []
    out: list[Path] = []
    out += list(SDLC.glob('input/IDEA-*.md'))
    out += list(SDLC.glob('grill/GRILL-*.yaml'))
    out += list(SDLC.glob('prd/REQ-*.yaml'))
    out += list(SDLC.glob('modules/MOD-*.yaml'))
    out += list(SDLC.glob('adr/ADR-*.yaml'))
    out += list(SDLC.glob('tasks/*/TASK.yaml'))
    out += list(SDLC.glob('chg/CHG-*.yaml'))
    out += list(SDLC.glob('incidents/INC-*.yaml'))
    out += list(SDLC.glob('amendments/AMD-*.yaml'))
    return out


def parse_id(p: Path) -> str | None:
    name = p.name
    m = re.match(r'(IDEA|GRILL|REQ|MOD|ADR|TASK|CHG|INC|AMD)-\d+', name)
    if m:
        return m.group(0)
    if name == 'TASK.yaml':
        # task id is the parent dir name
        return p.parent.name if re.match(r'TASK-\d+', p.parent.name) else None
    return None


def prefix_of(artifact_id: str) -> str:
    return artifact_id.split('-', 1)[0]


def load_artifact(p: Path) -> dict[str, Any]:
    if p.suffix == '.md':
        text = p.read_text(encoding='utf-8')
        m = re.match(r'---\s*\n(.*?)\n---', text, re.S)
        return yaml.safe_load(m.group(1)) or {} if m else {}
    try:
        return yaml.safe_load(p.read_text(encoding='utf-8')) or {}
    except yaml.YAMLError:
        return {}


def find_artifact_path(artifact_id: str) -> Path | None:
    pfx = prefix_of(artifact_id)
    if pfx == 'TASK':
        cand = SDLC / 'tasks' / artifact_id / 'TASK.yaml'
        return cand if cand.exists() else None
    sub = PREFIX_DIR.get(pfx)
    if not sub:
        return None
    if pfx == 'IDEA':
        cand = SDLC / sub / f'{artifact_id}.md'
    else:
        cand = SDLC / sub / f'{artifact_id}.yaml'
    return cand if cand.exists() else None


# ---------- trace walks ----------

def upstream_ids(artifact_id: str, data: dict[str, Any]) -> list[str]:
    pfx = prefix_of(artifact_id)
    fields = UPSTREAM_FIELDS.get(pfx, [])
    out: list[str] = []
    for fld in fields:
        v = data.get(fld)
        if v is None:
            continue
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, list):
            out.extend(x for x in v if isinstance(x, str))
    return out


def walk_upstream(artifact_id: str, depth: int = 0, seen: set[str] | None = None) -> list[tuple[int, str, str]]:
    seen = seen or set()
    if artifact_id in seen:
        return [(depth, artifact_id, '(cycle)')]
    seen.add(artifact_id)
    p = find_artifact_path(artifact_id)
    if not p:
        return [(depth, artifact_id, '(missing)')]
    data = load_artifact(p)
    summary = _summary(data, artifact_id)
    out = [(depth, artifact_id, summary)]
    for parent in upstream_ids(artifact_id, data):
        out.extend(walk_upstream(parent, depth + 1, seen))
    return out


def walk_downstream(artifact_id: str) -> list[tuple[int, str, str]]:
    out: list[tuple[int, str, str]] = []
    for p in all_artifacts():
        data = load_artifact(p)
        if _references(data, artifact_id):
            child = parse_id(p)
            if child and child != artifact_id:
                out.append((1, child, _summary(data, child)))
    return out


def _references(data: dict[str, Any], artifact_id: str) -> bool:
    for fld in ['derived_from', 'satisfies', 'honors_adrs', 'resolves',
                'constrains', 'module', 'idea', 'violated',
                'superseded_artifacts', 'affected_artifacts', 'triggered_by']:
        v = data.get(fld)
        if v == artifact_id:
            return True
        if isinstance(v, list) and artifact_id in v:
            return True
    return False


def _summary(data: dict[str, Any], artifact_id: str) -> str:
    for fld in ['title', 'text', 'name', 'responsibility', 'decision', 'question']:
        v = data.get(fld)
        if isinstance(v, str) and v.strip():
            s = v.strip().splitlines()[0]
            return s[:80] + ('...' if len(s) > 80 else '')
    return f'<{prefix_of(artifact_id)}>'


# ---------- subcommands ----------

def cmd_trace(args: argparse.Namespace) -> int:
    artifact_id = args.id.strip()
    if not all_artifacts():
        print('no artifacts yet')
        return 0
    if not find_artifact_path(artifact_id):
        print(f'no artifact found for id: {artifact_id}')
        return 1
    print('UPSTREAM')
    for depth, aid, summary in walk_upstream(artifact_id):
        print(f'{"  " * depth}└── {aid}  {summary}')
    print()
    print('DOWNSTREAM')
    down = walk_downstream(artifact_id)
    if not down:
        print(f'└── {artifact_id}  (no downstream references)')
    else:
        print(f'└── {artifact_id}')
        for _, aid, summary in down:
            print(f'    └── {aid}  {summary}')
    return 0


def cmd_status(_: argparse.Namespace) -> int:
    arts = all_artifacts()
    if not arts:
        print('no artifacts yet -- run /crux-init or /crux-idea to begin')
        return 0
    counts: dict[str, int] = {}
    for p in arts:
        aid = parse_id(p)
        if aid:
            counts[prefix_of(aid)] = counts.get(prefix_of(aid), 0) + 1
    print('Artifact counts')
    for pfx in ['IDEA', 'GRILL', 'REQ', 'MOD', 'ADR', 'TASK', 'CHG', 'INC', 'AMD']:
        print(f'  {pfx:6} {counts.get(pfx, 0)}')
    return 0


def cmd_gate(args: argparse.Namespace) -> int:
    n = args.n
    if n not in GATE_NAMES:
        print(f'unknown gate: {n} (valid: 1..8)')
        return 1
    print(f'Gate {n} ({GATE_NAMES[n]})')
    arts = all_artifacts()
    if not arts:
        print('  no artifacts yet')
        return 0
    matched = 0
    for p in arts:
        data = load_artifact(p)
        gate = data.get('gate')
        aid = parse_id(p)
        if gate == n and aid:
            print(f'  {aid}  {_summary(data, aid)}')
            matched += 1
    if matched == 0:
        print(f'  no artifacts associated with gate {n}')
    return 0


def cmd_check_orphans(_: argparse.Namespace) -> int:
    arts = all_artifacts()
    if not arts:
        print('no artifacts yet')
        return 0
    orphans = []
    for p in arts:
        aid = parse_id(p)
        if not aid:
            continue
        pfx = prefix_of(aid)
        # IDEA is the trace root; nothing required upstream.
        if pfx == 'IDEA':
            continue
        data = load_artifact(p)
        # Required upstream field varies by type. We require non-empty derived_from
        # for REQ/MOD; resolves+satisfies for ADR; satisfies for TASK; violated for INC.
        required: list[str] = {
            'GRILL': [],  # GRILLs reference an idea via the `idea` extension; we don't enforce
            'REQ': ['derived_from'],
            'MOD': ['derived_from'],
            'ADR': ['resolves', 'satisfies'],
            'TASK': ['satisfies'],
            'CHG': ['affected_artifacts'],
            'INC': ['violated'],
            'AMD': ['triggered_by'],
        }.get(pfx, [])
        if required and not any(_truthy(data.get(f)) for f in required):
            orphans.append((aid, str(p.relative_to(REPO_ROOT))))
    if not orphans:
        print('no orphans — every artifact has at least one trace field populated')
        return 0
    print(f'{len(orphans)} orphan(s):')
    for aid, path in orphans:
        print(f'  {aid}  {path}')
    return 1


def _truthy(v: Any) -> bool:
    if v is None:
        return False
    if isinstance(v, (list, dict, str)):
        return len(v) > 0
    return bool(v)


def cmd_render_graph(args: argparse.Namespace) -> int:
    arts = all_artifacts()
    if not arts:
        print('no artifacts yet')
        return 0
    fmt = args.format
    edges: list[tuple[str, str]] = []
    nodes: dict[str, str] = {}
    for p in arts:
        aid = parse_id(p)
        if not aid:
            continue
        data = load_artifact(p)
        nodes[aid] = _summary(data, aid)
        for parent in upstream_ids(aid, data):
            edges.append((parent, aid))
    if fmt == 'mermaid':
        print('graph TD')
        for aid, label in sorted(nodes.items()):
            safe = label.replace('"', "'")
            print(f'  {aid}["{aid}: {safe}"]')
        for a, b in edges:
            print(f'  {a} --> {b}')
    else:
        print('digraph crux {')
        print('  rankdir=LR;')
        for aid, label in sorted(nodes.items()):
            safe = label.replace('"', "'")
            print(f'  "{aid}" [label="{aid}\\n{safe}"];')
        for a, b in edges:
            print(f'  "{a}" -> "{b}";')
        print('}')
    return 0


# ---------- entrypoint ----------

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog='crux')
    sub = parser.add_subparsers(dest='cmd', required=True)

    p_trace = sub.add_parser('trace')
    p_trace.add_argument('id')

    sub.add_parser('status')

    p_gate = sub.add_parser('gate')
    p_gate.add_argument('n', type=int)

    sub.add_parser('check-orphans')

    p_graph = sub.add_parser('render-graph')
    p_graph.add_argument('--format', choices=['mermaid', 'dot'], default='mermaid')

    args = parser.parse_args(argv)
    return {
        'trace': cmd_trace,
        'status': cmd_status,
        'gate': cmd_gate,
        'check-orphans': cmd_check_orphans,
        'render-graph': cmd_render_graph,
    }[args.cmd](args)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
