"""One-shot REQ generator for Phase 7.3 (/crux-prd IDEA-001).

Materializes one REQ-CRUX-<n>.yaml per requirement derived from the 20 GRILL files.
Bootstrap-only; can be deleted once the real CLI takes over.
"""
from __future__ import annotations

import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PRD_DIR = REPO / 'docs' / 'sdlc' / 'prd'

REQS = [
    dict(
        n=1, gate=2, priority='must',
        text=(
            'At v1.0, gates 1 through 7 of the Crux pipeline (input, PRD, '
            'modules, architecture, harness, design, build) must execute '
            'end-to-end on a real user project. Gate 8 (release / deploy '
            'automation) and Loop 9 (the always-on production-feedback '
            'channel) are explicit non-goals at v1.0.'
        ),
        derived_from=['GRILL-CRUX-001'],
        ac=[
            'Every slash command listed in .claude/commands/ exits with code 0 when run against the prepared end-to-end test scenario.',
            'No slash command emits the string "not implemented" or "TODO" to stderr during the end-to-end scenario.',
            'A v1.0 build artifact contains no Loop 9 listener process and no scheduled job referencing Loop 9.',
            'No deploy-automation slash command (e.g. /crux-deploy) ships in .claude/commands/ at v1.0.',
            'docs/sdlc/ contains every artifact type produced by gates 1 through 7 after the end-to-end scenario completes.',
        ],
        priority_p='must', blast_radius='high',
    ),
    dict(
        n=2, gate=2, priority='must',
        text=(
            'Crux v1.0 must name the small founding-team workflow '
            '(2-3 people: PM + 1-2 developers) as its primary persona. '
            'Any v1.0 ADR or REQ that introduces a material trade-off '
            'between the primary persona and a second-tier persona '
            '(regulated-industry teams, design-conscious DTC teams) must '
            'explicitly name which persona is favored and the rationale, '
            'and arch-critic must flag any persona-conflicting decision '
            'that omits this declaration.'
        ),
        derived_from=['GRILL-CRUX-002'],
        ac=[
            'Compressed Mode is the default crux_mode for greenfield /crux-init.',
            'docs/sdlc/PERSONA.md exists and names the founding-team persona as primary plus the two second-tier personas with their priority order.',
            'v1.0 release notes name the founding-team persona as the design target.',
            'arch-critic checks every ADR for a persona_trade_off field and flags any decision plausibly affecting personas that omits it.',
            'No v1.0 deferred-to-v1.1 item primarily serves the founding-team persona (i.e. nothing critical to the primary persona is pushed out).',
        ],
        priority_p='must', blast_radius='high',
    ),
    dict(
        n=3, gate=4, priority='must',
        text=(
            'The trace graph must be canonically stored as plain '
            'markdown and YAML files under docs/sdlc/. Any other '
            'representation (e.g., a SQLite index) must be a derived '
            'cache that can be regenerated entirely from the markdown '
            'source.'
        ),
        derived_from=['GRILL-CRUX-003'],
        ac=[
            'Deleting the SQLite cache and re-running the indexer produces an identical trace graph.',
            'Every trace edge present in the SQLite index is also recoverable by parsing the markdown / YAML files.',
            'No data exists only in the SQLite cache.',
        ],
        priority_p='must', blast_radius='high',
        health_signals=[
            dict(metric='cache_rebuild_lossless', source='ci', threshold=1, breach_action='open_incident'),
        ],
    ),
    dict(
        n=4, gate=4, priority='must',
        text=(
            'When the markdown source and the SQLite cache disagree on '
            'any field, the markdown source must win. Cache invalidation '
            'must use per-file mtime plus sha256 content hash.'
        ),
        derived_from=['GRILL-CRUX-003'],
        ac=[
            'A test that mutates a markdown file out-of-band and reads from the cache returns the new value, not the stale cache value.',
            'The cache stores a sha256 hash per indexed file and re-reads the file when the hash changes.',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=5, gate=4, priority='must',
        text=(
            'The runtime adapter interface must consist of 16 to 18 '
            'functions, organized into seven concern groups: lifecycle, '
            'subagents, skills, hooks, slash commands, filesystem and '
            'shell, trace and capability resolution. Once the architect '
            'commits a specific count via ADR, that count is binding for '
            'v1.0; widening it later is a v1.1+ change.'
        ),
        derived_from=['GRILL-CRUX-004'],
        ac=[
            'The adapter interface module declares between 16 and 18 functions inclusive.',
            'Every declared function maps to exactly one of the seven concern groups.',
            'No concern group has been silently expanded to absorb growth that the headline count was meant to cap (arch-critic verifies this).',
            'A printed function list, by group, with the committed count, ships in the adapter interface ADR.',
        ],
        priority_p='must', blast_radius='high',
    ),
    dict(
        n=6, gate=4, priority='must',
        text=(
            'The Claude Code reference adapter must implement the full '
            'adapter interface defined in REQ-CRUX-005 at v1.0.'
        ),
        derived_from=['GRILL-CRUX-004'],
        ac=[
            'Every function in the adapter interface has a working implementation in packages/adapter-claude-code/.',
            'The adapter passes the harness verification suite without any "not implemented" stubs.',
        ],
        priority_p='must', blast_radius='high',
    ),
    dict(
        n=7, gate=4, priority='should',
        text=(
            'The ADR for the adapter interface should include a non-empty '
            'revisit_when clause naming the second-adapter milestone, '
            'and v1.0 release notes should explicitly state that the '
            'runtime-neutrality claim is provisional until at least one '
            'second adapter exists. (Demoted from must to should per '
            'spec-critic SPEC-CRIT-005: this is documentation hygiene, '
            'not a release-blocking constraint.)'
        ),
        derived_from=['GRILL-CRUX-005'],
        ac=[
            'The adapter interface ADR has a non-empty revisit_when field referencing a second-adapter implementation.',
            'v1.0 release notes contain a statement that runtime neutrality is aspirational at v1.0.',
        ],
        priority_p='should', blast_radius='medium',
    ),
    dict(
        # Merges former REQ-CRUX-008 and REQ-CRUX-009 per SPEC-CRIT-005.
        # The former REQ-CRUX-009 is removed entirely; its content is now
        # captured here, under the same GRILL-CRUX-006 trace.
        n=8, gate=1, priority='must',
        text=(
            'The active gate-mode must be configurable via a top-level '
            'crux_mode field in stack.yaml. Allowed values: compressed, '
            'standard, strict, solo, observation. The default is '
            'compressed for greenfield, standard for brownfield. '
            'Artifact production must be invariant across all gate-modes: '
            'every gate produces its REQs, ADRs, MODs, TASKs, REVIEWs '
            'and other artifacts under every mode; only the frequency of '
            'HITL approval differs. The orchestration ADR must explicitly '
            'ratify this invariant and document the difference between '
            '"skipped HITL" and "skipped artifact" so future readers '
            'cannot reasonably misread Compressed mode as "skips '
            'artifacts".'
        ),
        derived_from=['GRILL-CRUX-006'],
        ac=[
            'stack.yaml.crux_mode is read by every command that branches on mode.',
            '/crux-init writes crux_mode: compressed to a new greenfield stack.yaml; crux_mode: standard for brownfield.',
            'Setting crux_mode to an invalid value causes /crux-status to halt with a clear error.',
            'Running the same input through compressed and standard modes produces the same set of artifact files (modulo approvals.log entries).',
            'Auto-approvals in compressed mode are recorded in approvals.log with source: mode-compressed; never silently.',
            'The orchestration ADR contains an explicit clause ratifying the artifact-invariance rule and naming the GRILL-CRUX-006 source.',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=10, gate=4, priority='must',
        text=(
            'The INC -> CHG -> AMD cascade must function end-to-end at '
            'v1.0 via manual /crux-incident report. The cascade may not '
            'depend on any background listener or watcher process.'
        ),
        derived_from=['GRILL-CRUX-007'],
        ac=[
            'Running /crux-incident report and answering its prompts produces an INC file, at least one CHG file, and at least one AMD file (when amendment-writer finds a target skill).',
            'The cascade succeeds with no daemon, scheduled job, or background process running.',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=11, gate=7, priority='must',
        text=(
            '/crux-task must enforce a per-task cost halt. The halt fires '
            'when accrued cost exceeds a configurable multiplier (default '
            '2.0x) of TASK.estimated_cost_usd. The multiplier is '
            'configurable via stack.yaml.cost_halt_multiplier.'
        ),
        derived_from=['GRILL-CRUX-008'],
        ac=[
            'A task with estimated_cost_usd: 1.00 halts at $2.00 with the default multiplier.',
            'Setting cost_halt_multiplier: 1.5 in stack.yaml causes the same task to halt at $1.50.',
            'A halt requires explicit user confirmation before /crux-task continues.',
        ],
        priority_p='must', blast_radius='medium',
        health_signals=[
            dict(metric='task_overrun_pct', source='log', threshold=200, breach_action='warn'),
        ],
    ),
    dict(
        n=12, gate=7, priority='must',
        text=(
            'docs/sdlc/costs/log.csv must record every LLM agent '
            'invocation whose wall_seconds is greater than or equal to '
            '60. (The earlier "multi-minute" phrasing is hereby pinned '
            'to a 60-second wall-clock threshold per spec-critic '
            'SPEC-CRIT-002.) Required fields: task_id, agent, '
            'tokens_estimated, wall_seconds, notes.'
        ),
        derived_from=['GRILL-CRUX-008'],
        ac=[
            'After running /crux-task on any task whose total wall-time on a single agent invocation is at least 60 seconds, costs/log.csv contains a row referencing that task id.',
            'The CSV is append-only; existing rows are never rewritten.',
            'A unit test verifies the 60-second threshold: a 59.9s synthetic invocation produces no row; a 60.1s synthetic invocation produces exactly one row.',
        ],
        priority_p='must', blast_radius='low',
    ),
    dict(
        n=13, gate=1, priority='must',
        text=(
            '/crux-init in brownfield mode must produce a gap report at '
            'docs/sdlc/gate0/gap-report.md, an ADR archaeology pass, and '
            'auto-generate a starter IDEA-001.md from the gap report. '
            'Directory creation must be idempotent across operating '
            'systems and tolerate a pre-existing docs/sdlc/gate0/.'
        ),
        derived_from=['GRILL-CRUX-009'],
        ac=[
            'Running /crux-init in brownfield mode on a real repository creates docs/sdlc/gate0/gap-report.md.',
            'The brownfield path emits at least one proposed-status ADR with origin: archaeology when it detects an implicit decision in the codebase.',
            'The brownfield path writes docs/sdlc/input/IDEA-001.md if no IDEA exists yet.',
            'Re-running /crux-init brownfield on a repo that already has docs/sdlc/gate0/ does not error; the existing gap report is overwritten in place and the directory is reused.',
            'The brownfield code path uses an idempotent mkdir (e.g., mkdir -p semantics) and handles Windows / POSIX permissions paths uniformly.',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=14, gate=4, priority='should',
        text=(
            'The orchestration-model ADR must explicitly credit and '
            'reference the Ruflo project as the source of the absorbed '
            'patterns (slash-command shape, DAG batching, hook conventions).'
        ),
        derived_from=['GRILL-CRUX-010'],
        ac=[
            'The orchestration-model ADR contains a section or block crediting Ruflo by name.',
            'No Ruflo file is copied into .claude/skills/, .claude/agents/, or .claude/commands/ at v1.0.',
        ],
        priority_p='should', blast_radius='low',
    ),
    dict(
        n=15, gate=2, priority='must',
        text=(
            '/crux-grill must ask the user whether the work has meaningful '
            'UI / visual-design surface. The answer must be recorded as '
            'design_gate_enabled (true | false) on the IDEA file, and '
            'Gate 4.5 must fire only when design_gate_enabled is true. '
            'The default when the user does not answer the question is '
            'false.'
        ),
        derived_from=['GRILL-CRUX-011'],
        ac=[
            'A grill run on an IDEA without UI scope produces design_gate_enabled: false on the IDEA frontmatter.',
            '/crux-architect skips the Gate 4.5 sub-flow when design_gate_enabled is false.',
            'When design_gate_enabled is true, DESIGN_BRIEF.yaml and TOKENS.yaml become required artifacts.',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=16, gate=5, priority='must',
        text=(
            'Gate 5 harness install must be advisory at v1.0: each '
            'proposal item is surfaced to the user with rationale and '
            'source skill before being applied; the user may accept, '
            'edit, or decline each item. harness.lock must record items '
            'the user edited with a user_edited: true flag.'
        ),
        derived_from=['GRILL-CRUX-012'],
        ac=[
            'A harness-install run pauses for user input on at least each non-trivial item (skill, hook, CI workflow).',
            'harness.lock entries that the user modified during install carry user_edited: true.',
            'A non-interactive install run requires an explicit --accept-defaults flag (no implicit auto-accept).',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=17, gate=7, priority='must',
        text=(
            'In /crux-task, the test-writer, coder, and reviewer phases '
            'must run as three separate subagent invocations. The three '
            'invocations must not share transcript context.'
        ),
        derived_from=['GRILL-CRUX-013'],
        ac=[
            'The /crux-task implementation issues three distinct Task tool calls, one per subagent_type.',
            'No subagent receives the prior subagent\'s prompt or response in its own context window.',
            'The reviewer subagent\'s brief contains only the orchestrator-supplied context (REQs, ADRs, diff), not the coder\'s reasoning trace.',
        ],
        priority_p='must', blast_radius='high',
    ),
    dict(
        n=18, gate=4, priority='must',
        text=(
            'Amendments must live as separate AMD-<n>.yaml files under '
            'docs/sdlc/amendments/. The amendment-writer subagent must '
            'never modify any .claude/skills/<name>/SKILL.md file. When '
            'an anchored subagent runs, the orchestrator must merge '
            'every amendment whose target_skill matches the subagent\'s '
            'canonical skill into the runtime brief.'
        ),
        derived_from=['GRILL-CRUX-014'],
        ac=[
            'Running /crux-incident report on a test scenario produces an AMD file but does not change any SKILL.md byte.',
            'A subsequent /crux-task invocation that triggers the amended skill includes the amendment\'s rule in its assembled brief.',
            'severity: high amendments are flagged as "BLOCKING" in the rendered brief.',
        ],
        priority_p='must', blast_radius='high',
    ),
    dict(
        n=19, gate=8, priority='must',
        text=(
            'At v1.0, the audit consumption surface must consist of: '
            '(a) markdown / YAML files under docs/sdlc/ browsable in any '
            'editor or on GitHub; (b) /crux-trace; (c) /crux-status; '
            '(d) scripts/render-graph.sh. The audit-site Astro package '
            'is a non-goal at v1.0; the packages/audit-site directory '
            'must contain a stub README explaining the v1.1 deferral.'
        ),
        derived_from=['GRILL-CRUX-015'],
        ac=[
            'A user can navigate the trace graph using only the four surfaces named above.',
            'packages/audit-site/README.md exists at v1.0 release and explains that the Astro audit-site is deferred to v1.1 plus the rationale.',
            'packages/audit-site contains no Astro / Storybook / Chromatic configuration files or build scripts at v1.0.',
            'No audit-site-deploy.yml CI workflow exists at v1.0.',
            'A specific build-phase task is scoped to write packages/audit-site/README.md (planner ensures coverage at gate 3).',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=20, gate=1, priority='must',
        text=(
            '/crux-grill must scale its question count by input depth. '
            'Word-count thresholds: under 50 words triggers a "too thin '
            'to grill" warning and at most 7 questions; 50 to 300 words '
            'triggers 8 to 12 questions; 300 to 2000 words triggers 15 '
            'to 20 questions; over 2000 words triggers 20 to 30 '
            'questions. PRDs derived from low-input-confidence IDEAs '
            'must carry an explicit warning at the top of PRD.md.'
        ),
        derived_from=['GRILL-CRUX-016'],
        ac=[
            'A 30-word IDEA produces a grill of at most 7 questions and an explicit "input too thin" message.',
            'A PRD derived from a low-confidence IDEA contains an "input_confidence: low" warning block at the top.',
        ],
        priority_p='must', blast_radius='low',
    ),
    dict(
        n=21, gate=3, priority='must',
        text=(
            '/crux-modules must detect cycles in the depends_on graph. '
            'When a cycle is detected, /crux-modules must still write '
            'the MOD-<n>.yaml files (so the user can inspect them) but '
            'must halt Gate 3 closure with a CRITICAL error naming the '
            'cycle edges. Crux must never auto-break a module-graph '
            'edge.'
        ),
        derived_from=['GRILL-CRUX-017'],
        ac=[
            'A test scenario in which the planner produces a cycle results in: (a) MOD files written, (b) /crux-modules exits non-zero, (c) the cycle edges are named in the error output.',
            'Gate 3 stays open in /crux-status until the cycle is resolved.',
            'No /crux-modules code path silently removes a depends_on edge.',
        ],
        priority_p='must', blast_radius='low',
    ),
    dict(
        n=22, gate=5, priority='must',
        text=(
            'Gate 5 harness install must detect hook collisions, defined '
            'as two or more hooks with the same event and matcher and no '
            'explicit priority field, and halt before writing '
            'harness.lock until every collision is resolved.'
        ),
        derived_from=['GRILL-CRUX-018'],
        ac=[
            'An install run with two skills both wanting PostToolUse: Write|Edit on the same matcher (no priority) halts and lists both colliders.',
            'Adding explicit priority fields to either hook lets the install proceed.',
            'harness.lock is never written while at least one collision is unresolved.',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=23, gate=7, priority='must',
        text=(
            'After reviewer (and design-reviewer when applicable) '
            'approval, /crux-task must produce '
            'docs/sdlc/tasks/<task-id>/PR_DESCRIPTION.md containing a '
            'structured trace block. The block must include task id, '
            'module, mode, satisfied REQ ids and one-line summaries, '
            'honored ADR ids and titles, the upstream GRILL ids, '
            'review verdict and cycle count, and cost summary.'
        ),
        derived_from=['GRILL-CRUX-019'],
        ac=[
            'Running /crux-task to completion produces PR_DESCRIPTION.md at the documented path.',
            'The trace block contains every required field.',
            'No PR-creation step is invoked by /crux-task at v1.0; the user runs gh pr create themselves.',
        ],
        priority_p='must', blast_radius='medium',
    ),
    dict(
        n=24, gate=8, priority='must',
        text=(
            'Crux v1.0 must ship a release-readiness check accessible to '
            'the user (either as a /crux-release-check command or as a '
            '/crux-status --release-check flag). The check must run an '
            '8-item checklist: gates 1 to 7 closed; check-orphans clean; '
            'no proposed ADRs; no escalated reviews; no tasks at cycle '
            '>= 3; harness.lock present and verification all-pass; '
            'spec-critique and arch-critique and pre-mortem resolved; '
            'no INC with open CHG events. The verdict is logged to '
            'approvals.log; no REL artifact is produced at v1.0.'
        ),
        derived_from=['GRILL-CRUX-020'],
        ac=[
            'Running the release-readiness check on a clean repo emits "release-ready".',
            'Each of the 8 checklist items can independently fail and is reported by name.',
            'A successful run appends a line to approvals.log; no docs/sdlc/releases/REL-*.yaml file is created at v1.0.',
        ],
        priority_p='must', blast_radius='medium',
    ),
]


def emit_yaml_string(s: str) -> str:
    # Block-literal scalar; safe for multi-line text without escaping.
    return '|\n  ' + s.replace('\n', '\n  ').rstrip()


def emit_req(r):
    lines = []
    lines.append(f"id: REQ-CRUX-{r['n']:03d}")
    lines.append(f"text: {emit_yaml_string(r['text'])}")
    lines.append('derived_from:')
    for d in r['derived_from']:
        lines.append(f'  - {d}')
    lines.append('acceptance_criteria:')
    for a in r['ac']:
        # Quote when the string contains YAML-active punctuation that would
        # otherwise be parsed as a mapping value (colon-space) or flow indicator.
        needs_quote = (': ' in a) or a.startswith(('@', '`', '*', '&', '!', '|', '>', '%'))
        if needs_quote:
            esc = a.replace("'", "''")
            lines.append(f"  - '{esc}'")
        else:
            lines.append(f'  - {a}')
    if r.get('health_signals'):
        lines.append('health_signals:')
        for h in r['health_signals']:
            lines.append(f"  - metric: {h['metric']}")
            lines.append(f"    source: {h['source']}")
            lines.append(f"    threshold: {h['threshold']}")
            lines.append(f"    breach_action: {h['breach_action']}")
    else:
        lines.append('health_signals: []')
    lines.append(f"priority: {r['priority']}")
    lines.append(f"gate: {r['gate']}")
    lines.append(f"blast_radius: {r['blast_radius']}")
    return '\n'.join(lines) + '\n'


def main():
    PRD_DIR.mkdir(parents=True, exist_ok=True)
    for r in REQS:
        path = PRD_DIR / f"REQ-CRUX-{r['n']:03d}.yaml"
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(emit_req(r))
        print(f"wrote {path.relative_to(REPO)}")
    print(f"total: {len(REQS)} REQs")


if __name__ == '__main__':
    main()
