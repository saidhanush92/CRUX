"""One-shot TASK generator for Phase 9.1 (v1 task DAG).

Emits one TASK-CRUX-<n>.yaml per task into docs/sdlc/tasks/<id>/TASK.yaml.
Acting as the planner subagent. Bootstrap-only.
"""
from __future__ import annotations
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TASKS_DIR = REPO / 'docs' / 'sdlc' / 'tasks'

# (n, title, module, satisfies, honors_adrs, touches_files, risk,
#  parallelizable_with, depends_on, estimated_cost_usd)
TASKS = [
    # ---------- MOD-CRUX-001 (core) ----------
    dict(
        n=1, title='Gate state machine + crux_mode reader',
        module='MOD-CRUX-001',
        satisfies=['REQ-CRUX-008'],
        honors_adrs=['ADR-CRUX-001', 'ADR-CRUX-006'],
        touches_files=[
            'packages/core/src/gate/**',
            'packages/core/src/mode/**',
            'packages/core/test/gate/**',
            'packages/core/test/mode/**',
            'packages/core/package.json',
            'packages/core/tsconfig.json',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-002', 'TASK-CRUX-007'],
        depends_on=[],
        estimated_cost_usd=2.50,
    ),
    dict(
        n=2, title='Trace graph: markdown reader + writer',
        module='MOD-CRUX-001',
        satisfies=['REQ-CRUX-003'],
        honors_adrs=['ADR-CRUX-002'],
        touches_files=[
            'packages/core/src/trace/markdown.ts',
            'packages/core/src/trace/types.ts',
            'packages/core/test/trace/markdown.test.ts',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-001', 'TASK-CRUX-007'],
        depends_on=[],
        estimated_cost_usd=2.50,
    ),
    dict(
        n=3, title='Trace graph: SQLite cache index with concurrent-write semantics',
        module='MOD-CRUX-001',
        satisfies=['REQ-CRUX-004'],
        honors_adrs=['ADR-CRUX-002'],
        touches_files=[
            'packages/core/src/trace/cache.ts',
            'packages/core/src/trace/indexer.ts',
            'packages/core/schema/**',
            'packages/core/test/trace/cache.test.ts',
            'packages/core/test/trace/indexer.test.ts',
        ],
        risk='high',  # concurrency + atomicity per ADR-CRUX-002 amendments
        parallelizable_with=[],
        depends_on=['TASK-CRUX-002'],
        estimated_cost_usd=4.00,
    ),
    dict(
        n=4, title='Amendment merge + cycle detection',
        module='MOD-CRUX-001',
        satisfies=['REQ-CRUX-018', 'REQ-CRUX-021'],
        honors_adrs=['ADR-CRUX-005'],
        touches_files=[
            'packages/core/src/amendments/**',
            'packages/core/src/graph/cycle.ts',
            'packages/core/test/amendments/**',
            'packages/core/test/graph/cycle.test.ts',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-005', 'TASK-CRUX-006'],
        depends_on=['TASK-CRUX-002'],
        estimated_cost_usd=3.00,
    ),
    dict(
        n=5, title='Cost ledger CSV writer + halt-rebase ladder',
        module='MOD-CRUX-001',
        satisfies=['REQ-CRUX-011', 'REQ-CRUX-012'],
        honors_adrs=['ADR-CRUX-009'],
        touches_files=[
            'packages/core/src/cost/**',
            'packages/core/test/cost/**',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-004', 'TASK-CRUX-006'],
        depends_on=[],
        estimated_cost_usd=2.50,
    ),
    dict(
        n=6, title='Capability registry consumer + INC/CHG/AMD plumbing',
        module='MOD-CRUX-001',
        satisfies=['REQ-CRUX-010'],
        honors_adrs=['ADR-CRUX-005'],
        touches_files=[
            'packages/core/src/capabilities/**',
            'packages/core/src/incidents/**',
            'packages/core/test/capabilities/**',
            'packages/core/test/incidents/**',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-004', 'TASK-CRUX-005'],
        depends_on=['TASK-CRUX-002'],
        estimated_cost_usd=3.00,
    ),

    # ---------- MOD-CRUX-002 (adapter-claude-code) ----------
    dict(
        n=7, title='Adapter interface declaration: 17 fns, 7 concern groups',
        module='MOD-CRUX-002',
        satisfies=['REQ-CRUX-005'],
        honors_adrs=['ADR-CRUX-003'],
        touches_files=[
            'packages/core/src/adapter/interface.ts',
            'packages/core/src/adapter/types.ts',
            'packages/core/test/adapter/interface.test.ts',
        ],
        risk='high',  # any drift here breaks every adapter
        parallelizable_with=['TASK-CRUX-001', 'TASK-CRUX-002'],
        depends_on=[],
        estimated_cost_usd=3.00,
    ),
    dict(
        n=8, title='claude-code adapter: lifecycle + subagents + skills + hooks (10 fns)',
        module='MOD-CRUX-002',
        satisfies=['REQ-CRUX-006', 'REQ-CRUX-017'],
        honors_adrs=['ADR-CRUX-003', 'ADR-CRUX-004'],
        touches_files=[
            'packages/adapter-claude-code/src/lifecycle.ts',
            'packages/adapter-claude-code/src/subagents.ts',
            'packages/adapter-claude-code/src/skills.ts',
            'packages/adapter-claude-code/src/hooks.ts',
            'packages/adapter-claude-code/test/**',
            'packages/adapter-claude-code/package.json',
            'packages/adapter-claude-code/tsconfig.json',
        ],
        risk='high',  # subagent isolation contract is load-bearing
        parallelizable_with=['TASK-CRUX-009'],
        depends_on=['TASK-CRUX-007'],
        estimated_cost_usd=6.00,
    ),
    dict(
        n=9, title='claude-code adapter: slash + fs/shell + trace+capability (7 fns)',
        module='MOD-CRUX-002',
        satisfies=['REQ-CRUX-006'],
        honors_adrs=['ADR-CRUX-003'],
        touches_files=[
            'packages/adapter-claude-code/src/commands.ts',
            'packages/adapter-claude-code/src/fs-shell.ts',
            'packages/adapter-claude-code/src/trace.ts',
            'packages/adapter-claude-code/test/**',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-008'],
        depends_on=['TASK-CRUX-007'],
        estimated_cost_usd=4.00,
    ),
    dict(
        n=10, title='Paper-only second-adapter spec (Cursor / raw SDK)',
        module='MOD-CRUX-002',
        satisfies=['REQ-CRUX-007'],
        honors_adrs=['ADR-CRUX-003'],
        touches_files=[
            'docs/sdlc/architecture/adapter-second-spec.md',
        ],
        risk='low',  # documentation only; no code
        parallelizable_with=['TASK-CRUX-008', 'TASK-CRUX-009'],
        depends_on=['TASK-CRUX-007'],
        estimated_cost_usd=1.50,
    ),

    # ---------- MOD-CRUX-003 (cli) ----------
    dict(
        n=11, title='CLI entry point + command dispatch + workspace package skeleton',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-001'],
        honors_adrs=['ADR-CRUX-001', 'ADR-CRUX-007'],
        touches_files=[
            'packages/cli/src/index.ts',
            'packages/cli/src/dispatch.ts',
            'packages/cli/test/**',
            'packages/cli/package.json',
            'packages/cli/tsconfig.json',
            'packages/cli/bin/crux',
        ],
        risk='medium',
        parallelizable_with=[],
        depends_on=['TASK-CRUX-001'],
        estimated_cost_usd=3.00,
    ),
    dict(
        n=12, title='/crux-init: greenfield + brownfield (gap report + idempotent mkdir + auto-IDEA)',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-013'],
        honors_adrs=['ADR-CRUX-001', 'ADR-CRUX-006'],
        touches_files=[
            'packages/cli/src/commands/init/**',
            'packages/cli/test/commands/init/**',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-013', 'TASK-CRUX-014'],
        depends_on=['TASK-CRUX-011'],
        estimated_cost_usd=4.00,
    ),
    dict(
        n=13, title='/crux-idea + /crux-grill: scaled-by-depth budget + design_gate_enabled prompt',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-015', 'REQ-CRUX-020'],
        honors_adrs=['ADR-CRUX-007'],
        touches_files=[
            'packages/cli/src/commands/idea/**',
            'packages/cli/src/commands/grill/**',
            'packages/cli/test/commands/idea/**',
            'packages/cli/test/commands/grill/**',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-012', 'TASK-CRUX-014'],
        depends_on=['TASK-CRUX-011'],
        estimated_cost_usd=4.00,
    ),
    dict(
        n=14, title='/crux-prd + /crux-modules + /crux-approve (with cycle-halt + spec-critic invocation)',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-021'],
        honors_adrs=['ADR-CRUX-007'],
        touches_files=[
            'packages/cli/src/commands/prd/**',
            'packages/cli/src/commands/modules/**',
            'packages/cli/src/commands/approve/**',
            'packages/cli/test/commands/prd/**',
            'packages/cli/test/commands/modules/**',
            'packages/cli/test/commands/approve/**',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-012', 'TASK-CRUX-013'],
        depends_on=['TASK-CRUX-011', 'TASK-CRUX-004'],
        estimated_cost_usd=4.50,
    ),
    dict(
        n=15, title='/crux-architect: arch-critic + pre-mortem flows; persona-conflict check',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-002'],
        honors_adrs=['ADR-CRUX-001', 'ADR-CRUX-007'],
        touches_files=[
            'packages/cli/src/commands/architect/**',
            'packages/cli/test/commands/architect/**',
            'docs/sdlc/PERSONA.md',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-016', 'TASK-CRUX-017'],
        depends_on=['TASK-CRUX-011', 'TASK-CRUX-008'],
        estimated_cost_usd=4.00,
    ),
    dict(
        n=16, title='/crux-task pipeline: test-writer -> coder -> reviewer; cost halt; PR_DESCRIPTION.md',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-017', 'REQ-CRUX-023'],
        honors_adrs=['ADR-CRUX-004', 'ADR-CRUX-007', 'ADR-CRUX-009', 'ADR-CRUX-010'],
        touches_files=[
            'packages/cli/src/commands/task/**',
            'packages/cli/test/commands/task/**',
        ],
        risk='high',  # this is the load-bearing build pipeline
        parallelizable_with=['TASK-CRUX-015', 'TASK-CRUX-017'],
        depends_on=['TASK-CRUX-011', 'TASK-CRUX-005', 'TASK-CRUX-008'],
        estimated_cost_usd=7.00,
    ),
    dict(
        n=17, title='/crux-status + /crux-trace + /crux-incident: critique counts, walk, cascade',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-019'],
        honors_adrs=['ADR-CRUX-002', 'ADR-CRUX-005'],
        touches_files=[
            'packages/cli/src/commands/status/**',
            'packages/cli/src/commands/trace/**',
            'packages/cli/src/commands/incident/**',
            'packages/cli/test/commands/status/**',
            'packages/cli/test/commands/trace/**',
            'packages/cli/test/commands/incident/**',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-015', 'TASK-CRUX-016'],
        depends_on=['TASK-CRUX-011', 'TASK-CRUX-003', 'TASK-CRUX-006'],
        estimated_cost_usd=4.00,
    ),
    dict(
        n=18, title='/crux-release-check + harness install advisory + collision detection',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-016', 'REQ-CRUX-022', 'REQ-CRUX-024'],
        honors_adrs=['ADR-CRUX-008'],
        touches_files=[
            'packages/cli/src/commands/release-check/**',
            'packages/cli/src/commands/harness/**',
            'packages/cli/test/commands/release-check/**',
            'packages/cli/test/commands/harness/**',
        ],
        risk='medium',
        parallelizable_with=['TASK-CRUX-019'],
        depends_on=['TASK-CRUX-011'],
        estimated_cost_usd=4.50,
    ),
    dict(
        n=19, title='Stub READMEs in deferred packages (audit-site, extension-vscode)',
        module='MOD-CRUX-003',
        satisfies=['REQ-CRUX-019'],
        honors_adrs=[],
        touches_files=[
            'packages/audit-site/README.md',
            'packages/extension-vscode/README.md',
        ],
        risk='low',  # documentation only; explicit per SPEC-CRIT-007
        parallelizable_with=['TASK-CRUX-018'],
        depends_on=[],
        estimated_cost_usd=0.50,
    ),
]


def emit_str(s: str) -> str:
    """YAML block-literal."""
    return '|\n  ' + s.replace('\n', '\n  ').rstrip()


def emit_list(items: list[str], key: str) -> list[str]:
    if not items:
        return [f'{key}: []']
    out = [f'{key}:']
    for x in items:
        # Quote if contains special chars
        if ': ' in x or x.startswith(('@', '`', '*', '&', '!', '|', '>', '%', '"', "'")):
            out.append(f"  - '{x.replace(chr(39), chr(39)*2)}'")
        else:
            out.append(f'  - {x}')
    return out


def emit_task(t: dict) -> str:
    L = []
    L.append(f"id: TASK-CRUX-{t['n']:03d}")
    title_q = t['title'].replace("'", "''")
    L.append(f"title: '{title_q}'")
    L.append(f"module: {t['module']}")
    L.extend(emit_list(t['satisfies'], 'satisfies'))
    L.extend(emit_list(t['honors_adrs'], 'honors_adrs'))
    L.extend(emit_list(t['touches_files'], 'touches_files'))
    L.append(f"risk: {t['risk']}")
    L.extend(emit_list(t['parallelizable_with'], 'parallelizable_with'))
    L.extend(emit_list(t['depends_on'], 'depends_on'))
    L.append(f"estimated_cost_usd: {t['estimated_cost_usd']}")
    return '\n'.join(L) + '\n'


def main():
    for t in TASKS:
        task_id = f"TASK-CRUX-{t['n']:03d}"
        task_dir = TASKS_DIR / task_id
        task_dir.mkdir(parents=True, exist_ok=True)
        path = task_dir / 'TASK.yaml'
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(emit_task(t))
        print(f"wrote {path.relative_to(REPO)}")
    print(f"total: {len(TASKS)} TASKs")


if __name__ == '__main__':
    main()
