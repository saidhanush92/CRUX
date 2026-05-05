"""One-shot ADR generator for Phase 7.6 (/crux-architect).

Materializes one ADR-CRUX-<n>.yaml per architectural decision that
survives the 3-question gating test. Bootstrap-only.

All ADRs ship with status: proposed. /crux-approve transitions each
to status: accepted after HITL review.
"""
from __future__ import annotations
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ADR_DIR = REPO / 'docs' / 'sdlc' / 'adr'

ADRS = [
    dict(
        n=1,
        title='TypeScript monorepo with pnpm workspaces',
        decision=(
            'Crux is structured as a TypeScript monorepo with pnpm '
            'workspaces. Each package declared in pnpm-workspace.yaml '
            'has its own tsconfig extending tsconfig.base.json. The '
            'workspace shape was pre-confirmed by the user at TODO 7.5 '
            'before /crux-architect ran.'
        ),
        alternatives=[
            ('single-package repo with deep src/ tree',
             'rejected: 5 deliverables (core, adapter, cli, extension, '
             'audit-site) have different dependency surfaces and release '
             'cadences.'),
            ('nx- or turbo-orchestrated monorepo',
             'rejected at v1: extra tooling burden without a current '
             'measurable need for cached graph builds.'),
            ('polyrepo with submodules',
             'rejected: cross-package refactors become painful; trace '
             'graph spans repos and loses portability claim.'),
        ],
        consequences=[
            'Cross-package refactors stay atomic.',
            'Each package keeps an isolated dependency tree.',
            'Contributors must learn pnpm workspace conventions.',
            'CI must run `pnpm -r build` and `pnpm -r test` to cover all packages.',
        ],
        resolves=[],
        satisfies=['REQ-CRUX-001'],
        constrains=['MOD-CRUX-001', 'MOD-CRUX-002', 'MOD-CRUX-003'],
        revisit_when=(
            'Build orchestration becomes a measurable bottleneck '
            '(>2x slowdown vs flat repo) OR a sixth deliverable joins '
            'the repo.'
        ),
        validated_by=[
            '`pnpm -r build` succeeds in CI on every PR',
            'tsconfig path inheritance test in packages/core',
        ],
    ),
    dict(
        n=2,
        title='Trace graph storage: markdown canonical + derived SQLite cache',
        decision=(
            'Markdown / YAML files under docs/sdlc/ are the canonical '
            'source of truth for the trace graph. SQLite at .crux/trace.db '
            'is a derived cache, regenerated entirely from markdown on '
            'demand. Cache invalidation: per-file mtime + sha256 content '
            'hash. On any disagreement between markdown and the cache, '
            'markdown wins; the cache is rebuilt, never written back to '
            'markdown.'
        ),
        alternatives=[
            ('SQLite-canonical with markdown export',
             'rejected: violates the IDEA-001 portability claim that the '
             'audit "lives in your repo as plain text".'),
            ('markdown-only with no cache (pure ripgrep)',
             'rejected at v1.0 per fork B1: latency on >~500 artifact '
             'corpora exceeds the soft 200ms target; SQLite buys the '
             'headroom for ~1 week of work.'),
            ('git-backed key-value store',
             'rejected: complicates the switch-tools-tomorrow story; adds '
             'a tooling dependency for cold reads.'),
        ],
        consequences=[
            'Deleting .crux/trace.db is non-destructive; the indexer rebuilds.',
            'The IDEA-001 "switch tools tomorrow and the audit survives" promise is contractually testable.',
            'SQLite schema becomes part of MOD-CRUX-001\'s public surface; schema migrations need their own ADR if they happen.',
            'Cold-start cache rebuild adds ~100ms on small repos; bounded.',
        ],
        resolves=['GRILL-CRUX-003'],
        satisfies=['REQ-CRUX-003', 'REQ-CRUX-004'],
        constrains=['MOD-CRUX-001'],
        revisit_when=(
            'Corpus exceeds ~10k artifacts AND ripgrep-baseline latency '
            'stays under 200ms (would let us drop SQLite); OR trace-query '
            'patterns require non-trivial joins (would push us toward '
            'stronger storage).'
        ),
        validated_by=[
            'cache_rebuild_lossless CI check (delete cache, rebuild, diff against pre-delete query results)',
            'markdown-mutation-vs-cache-stale unit test (REQ-CRUX-004 AC#1)',
        ],
    ),
    dict(
        n=3,
        title='Runtime adapter interface: 17 functions in 7 concern groups',
        decision=(
            'The runtime adapter interface is exactly 17 functions, '
            'organized into 7 concern groups. The interface lives in '
            'packages/core as TypeScript types and a reference contract; '
            'adapters implement against this. Function list:\n\n'
            'Lifecycle (3): session_start, session_end, capabilities_supported\n'
            'Subagents (2): spawn_subagent, await_subagent\n'
            'Skills (3): install_skill, uninstall_skill, list_skills\n'
            'Hooks (2): install_hook, list_hooks\n'
            'Slash commands (1): run_command\n'
            'Filesystem and shell (3): read_file, write_file, run_shell\n'
            'Trace and capability (3): emit_event, resolve_capability, invoke_skill'
        ),
        alternatives=[
            ('16 functions (no uninstall_skill)',
             'rejected at fork A2: uninstall is needed for clean test '
             'isolation when integration tests install transient skills.'),
            ('18 functions (also uninstall_hook)',
             'rejected: hook removal can be modeled as install-with-empty-content '
             'or noop; one fewer fn keeps the surface tight and matches the '
             'IDEA-001 "small interface" claim.'),
            ('Out-of-process plugin model with IPC',
             'rejected at v1: too heavy for the founding-team cost target; '
             'subagent-isolation already gives most of the benefit (ADR-CRUX-004).'),
        ],
        consequences=[
            'Every new adapter must implement all 17 functions.',
            'The interface is provisional per REQ-CRUX-007 (revisit_when names a second-adapter milestone) until at least one second adapter exists.',
            'Adding or renaming a function pre-v1.1 is a breaking change requiring a CHG event.',
            'Concern-group expansion is forbidden by REQ-CRUX-005 AC#3 (arch-critic verifies).',
        ],
        resolves=['GRILL-CRUX-004'],
        satisfies=['REQ-CRUX-005', 'REQ-CRUX-006'],
        constrains=['MOD-CRUX-001', 'MOD-CRUX-002', 'MOD-CRUX-003'],
        revisit_when=(
            'A second adapter implementation (Cursor, Aider, raw SDK) '
            'surfaces concerns; OR the function count drifts above 18; '
            'OR a new concern group becomes load-bearing.'
        ),
        validated_by=[
            'adapter implementation test suite in packages/adapter-claude-code/',
            'arch-critic concern-group expansion check (per REQ-CRUX-005 AC#3)',
            'A printed function list ships in this ADR (above)',
        ],
    ),
    dict(
        n=4,
        title='Subagent invocation isolation + model assignment rule',
        decision=(
            'In /crux-task, the test-writer, coder, and reviewer phases '
            'run as three separate Task tool invocations with no shared '
            'transcript context. Each subagent receives only the '
            'orchestrator-supplied brief plus the artifacts it explicitly '
            'reads. Reviewer cannot lazy-share the coder\'s reasoning '
            'trace. Model-assignment rule: the highest-reasoning role '
            'gets model: opus; all other roles default to model: sonnet. '
            'Specific agent file frontmatter (e.g. architect=opus, '
            'reviewer=sonnet) is editable per deployment without a CHG '
            'event; only the rule itself is binding via this ADR.'
        ),
        alternatives=[
            ('Single-context role-prompting ("now act as the reviewer")',
             'rejected: violates the trust contract behind "different agent identity" '
             'in IDEA-001; cheaper but loses the independence claim.'),
            ('Out-of-process separation (separate processes or accounts)',
             'rejected: heavyweight without security gain at the v1.0 trust boundary.'),
            ('Lock specific agent-to-model assignments via ADR (fork E1)',
             'rejected at fork E2: agent-file frontmatter stays editable; '
             'only the assignment rule is ADR-binding.'),
            ('Cross-model assignment by role (coder=Sonnet, reviewer=Opus)',
             'rejected at v1.0: per GRILL-CRUX-013, single Claude Code installation '
             'and per-agent model field is sufficient.'),
        ],
        consequences=[
            'Each /crux-task run incurs ~3x context+token cost vs single-session.',
            'The cost halt contract (ADR-CRUX-009) is sized accordingly.',
            'Reviewer findings cannot reference coder\'s internal reasoning; the diff and the briefs are the contract.',
            'Adapters without a subagent-isolation primitive cannot be Crux adapters at v1.0.',
        ],
        resolves=['GRILL-CRUX-013'],
        satisfies=['REQ-CRUX-017'],
        constrains=['MOD-CRUX-002', 'MOD-CRUX-003'],
        revisit_when=(
            'Cost-per-task data shows isolation cost dominates over '
            'context-leakage risk; OR an adapter without a subagent-'
            'isolation primitive must be supported.'
        ),
        validated_by=[
            'integration test asserting reviewer subagent cannot read test-writer\'s transcript',
            'three distinct Task tool invocations visible in /crux-task execution trace',
        ],
    ),
    dict(
        n=5,
        title='Amendment layering: separate AMD files, runtime merge by orchestrator',
        decision=(
            'Amendments live as separate AMD-<n>.yaml files under '
            'docs/sdlc/amendments/. The amendment-writer subagent never '
            'modifies any .claude/skills/<name>/SKILL.md byte. At runtime, '
            'when an anchored subagent invokes its canonical skill, the '
            'orchestrator (a function in MOD-CRUX-001 named '
            'resolveAmendmentsForSkill) reads SKILL.md, scans '
            'docs/sdlc/amendments/ for matching target_skill, and '
            'assembles the runtime brief by appending matching amendment '
            'rules under "## Active amendments" after the skill body. '
            'severity: high amendments render as "BLOCKING".'
        ),
        alternatives=[
            ('Inline edit of SKILL.md',
             'rejected: destroys upstream-sync property; Pocock and ECC '
             'updates can no longer be rebased.'),
            ('Hook injection (amendments fire as PostToolUse hooks)',
             'rejected: invisible to a human reading the agent\'s assembled '
             'behavior; debugging gets opaque.'),
            ('Per-skill versioned forks (skill@1.0.0+amd-007 directory)',
             'rejected: combinatorial growth; loses the layered semantics.'),
        ],
        consequences=[
            'Upstream Pocock / ECC SKILL.md updates remain mergeable.',
            'Runtime brief assembly cost is small (<10ms grep).',
            'The amendment-merge function lives in MOD-CRUX-001\'s public surface.',
            '"## Active amendments" section in subagent briefs is a contract observable by users.',
        ],
        resolves=['GRILL-CRUX-014'],
        satisfies=['REQ-CRUX-018'],
        constrains=['MOD-CRUX-001', 'MOD-CRUX-002'],
        revisit_when=(
            'Amendment count for any single skill exceeds ~20 (signal '
            'that the skill itself needs revision rather than more '
            'amendments); OR amendment-merge overhead becomes measurable '
            'in critical-path latency.'
        ),
        validated_by=[
            'integration test: /crux-incident produces AMD; subsequent /crux-task brief contains amendment text',
            'integration test: SKILL.md byte-content unchanged after amendment-writer run',
        ],
    ),
    dict(
        n=6,
        title='Gate-mode dial in stack.yaml + artifact-invariance rule',
        decision=(
            'stack.yaml carries a top-level crux_mode field. Allowed '
            'values: compressed, standard, strict, solo, observation. '
            'Greenfield default = compressed; brownfield default = '
            'standard. **Artifact invariance:** every gate produces its '
            'REQs, ADRs, MODs, TASKs, REVIEWs, and other artifacts under '
            'EVERY mode. Modes differ only in HITL approval frequency. '
            'Auto-approvals in compressed mode are recorded in '
            'approvals.log with source: mode-compressed -- never silently. '
            'Mid-project mode change requires a CHG event documenting the '
            'transition. This ADR explicitly ratifies the resolution of '
            'IDEA-001\'s ambiguity about what Compressed Mode skips '
            '(answer: only HITL approval, never artifact production).'
        ),
        alternatives=[
            ('Per-IDEA mode override only with no global default',
             'rejected: founding teams want a default; per-IDEA stays available '
             'as an override but is not the configuration shape.'),
            ('Compressed mode skips entire gates including artifacts',
             'rejected: breaks the audit-trail invariant that powers the '
             'compounding-learning thesis from IDEA-001.'),
            ('Hard-pinned mode (no mid-project change)',
             'rejected: 2-person teams grow to 6; mode dial must move.'),
        ],
        consequences=[
            'Every command that branches on mode reads stack.yaml.crux_mode.',
            'Auto-approvals create slightly noisier approvals.log in compressed mode (intentional and audit-friendly).',
            'The audit-trail invariant is now contractually testable (REQ-CRUX-008 AC#4).',
            'IDEA-001 narrative ambiguity about "Compressed = 3 HITL gates" is resolved here authoritatively.',
        ],
        resolves=['GRILL-CRUX-006'],
        satisfies=['REQ-CRUX-008'],
        constrains=['MOD-CRUX-001', 'MOD-CRUX-003'],
        revisit_when=(
            'Usage data shows users frequently overriding per-IDEA '
            '(would push toward per-IDEA-default); OR a new mode is added '
            '(e.g., regulated) with fundamentally different artifact '
            'semantics.'
        ),
        validated_by=[
            'same-input-different-mode artifact-set equality test (REQ-CRUX-008 AC#4)',
            'auto-approval audit-log assertion: every mode-compressed approval is logged (REQ-CRUX-008 AC#5)',
        ],
    ),
    dict(
        n=7,
        title='Orchestration model: DAG subagent pipeline + structural Ruflo absorption',
        decision=(
            'The /crux-task pipeline is a small acyclic DAG with explicit '
            'hand-off contracts: test-writer -> coder -> reviewer (plus '
            'design-reviewer in parallel for UI tasks). Each node is a '
            'separate subagent invocation per ADR-CRUX-004. Hand-off '
            'contracts are named in the agent system prompts and enforced '
            'by /crux-task. **Pattern attribution:** the orchestration '
            'shape (slash-command + subagent + hook conventions, '
            'DAG-batched task pipeline) is structurally absorbed from the '
            'Ruflo project. No Ruflo file is imported into '
            '.claude/skills, .claude/agents, or .claude/commands at v1.0. '
            'This ADR records the structural influence and credits the '
            'source.'
        ),
        alternatives=[
            ('Single-agent loop (one context does everything)',
             'rejected: violates ADR-CRUX-004 isolation contract.'),
            ('Push-based event bus / actor system',
             'rejected at v1: too much infrastructure for a 2-3 person team\'s '
             'needs; reconsider at v1.x if multi-team coordination layers ship.'),
            ('Fork the Ruflo codebase directly',
             'rejected: pattern absorption keeps Crux runtime-neutral; forking '
             'would couple Crux to Ruflo\'s release cadence.'),
        ],
        consequences=[
            'Pipeline is debuggable: each subagent invocation has its own transcript.',
            'Ruflo\'s pattern source is acknowledged for future readers.',
            'If Ruflo ships a new pattern (e.g., a formal "monitor" role), v1.1 may absorb it without forking.',
            'The DAG is small enough to live entirely in /crux-task.md command body plus MOD-CRUX-003 orchestration code; no separate workflow engine.',
        ],
        resolves=['GRILL-CRUX-010'],
        satisfies=['REQ-CRUX-014'],
        constrains=['MOD-CRUX-002', 'MOD-CRUX-003'],
        revisit_when=(
            'A different orchestration model (event bus, actor system) '
            'materially outperforms in real-world Crux usage; OR a '
            'specific Ruflo artifact (skill or hook recipe) becomes worth '
            'importing rather than absorbing.'
        ),
        validated_by=[
            'pipeline integration test exercising the test-writer -> coder -> reviewer DAG',
            'this ADR\'s Decision section contains the explicit Ruflo credit (REQ-CRUX-014 AC#1)',
        ],
    ),
    dict(
        n=8,
        title='Hook collision policy: matcher+event halt, manual resolution',
        decision=(
            'A hook collision is two or more hooks with the same event '
            '(PreToolUse / PostToolUse / Stop) AND the same matcher regex '
            'AND none of them carries an explicit priority field. '
            'Multiple commands at the same matcher / event pair ARE '
            'allowed when the harness installer assigns each an explicit '
            'priority (ascending order of execution). When a collision is '
            'detected during /crux-init\'s harness-install path, halt '
            'before writing harness.lock. Surface the colliding entries '
            'with the source skill of each. User resolves manually by '
            'editing one skill out of the install set OR adding explicit '
            'priority fields to the offending hooks. Re-run /crux-init '
            'until clean. Skill-declared conflicts_with field and '
            'interactive resolution prompts are v1.1+ enhancements.'
        ),
        alternatives=[
            ('Auto-merge by hard-coded priority heuristic (e.g., format-then-lint)',
             'rejected at v1.0: opaque to the user; hard to debug when wrong.'),
            ('Looser collision (matcher + event + command must all match)',
             'rejected: misses semantically conflicting commands at the same hook point.'),
            ('Stricter collision (any glob overlap between matchers)',
             'rejected: too aggressive; false positives on different-named hooks that share a wildcard.'),
            ('Skill-declared conflicts_with field at v1.0',
             'rejected: requires every imported skill to opt in; deferred to v1.1.'),
        ],
        consequences=[
            'Harness install can halt mid-run; user does manual resolution at install time.',
            'harness.lock is byte-clean; never written while a collision is unresolved.',
            'Founding-team persona tolerates the manual resolution; would not scale to 50+ hooks.',
        ],
        resolves=['GRILL-CRUX-018'],
        satisfies=['REQ-CRUX-022'],
        constrains=['MOD-CRUX-003'],
        revisit_when=(
            'Real-world install runs show users repeatedly hitting the '
            'same collisions (motivates conflicts_with); OR a stack with '
            '>50 hooks emerges and manual resolution becomes the user\'s '
            'main pain point.'
        ),
        validated_by=[
            'collision-detection unit test on a synthetic two-hook fixture',
            'install-halt integration test (REQ-CRUX-022 AC#1)',
        ],
    ),
    dict(
        n=9,
        title='Per-task cost halt contract: 1.0x soft warn, 2.0x hard halt',
        decision=(
            '/crux-task enforces a per-task cost halt. Soft warn at 1.0x '
            'TASK.estimated_cost_usd; HARD HALT at 2.0x. The 2.0x '
            'multiplier is configurable via stack.yaml.cost_halt_multiplier. '
            'Halt requires explicit user confirmation before the cycle '
            'continues. /crux-status surfaces 7-day burn totals and the '
            'top-3 most expensive task ids. Cost-log threshold is pinned '
            'at wall_seconds >= 60 per agent invocation per REQ-CRUX-012 '
            '(formerly the ambiguous "multi-minute" phrase). No '
            'per-session aggregate cap at v1.0.'
        ),
        alternatives=[
            ('Soft-warn-only (no hard halt)',
             'rejected: doesn\'t catch the Looplog $14 spike scenario from IDEA-001.'),
            ('Per-session aggregate cap',
             'rejected at v1: adds complexity without a clear pain point at '
             'founding-team scale; reconsider at v1.1 if telemetry shows users '
             'consistently blowing past per-task halts.'),
            ('Hard halt at exactly 1.0x',
             'rejected: 1.0x is a planner estimate, not a precise budget; '
             'too aggressive in practice.'),
            ('Variable threshold by risk level',
             'rejected at v1: the configurable multiplier already covers it; '
             'risk-tiered budgets add config surface without measurable benefit.'),
        ],
        consequences=[
            'Cost ledger CSV and halt logic both live in MOD-CRUX-001 and are surfaced through MOD-CRUX-003.',
            'Users need to set realistic estimated_cost_usd values; tasks with poor estimates halt frequently until the user adjusts (intentional feedback loop).',
            '60-second wall-time threshold is precise and unit-testable.',
        ],
        resolves=['GRILL-CRUX-008'],
        satisfies=['REQ-CRUX-011', 'REQ-CRUX-012'],
        constrains=['MOD-CRUX-001', 'MOD-CRUX-003'],
        revisit_when=(
            'Usage data shows per-task halts are too frequent (multiplier '
            'should rise) or too rare (multiplier should fall); OR a '
            'session-aggregate budget becomes useful.'
        ),
        validated_by=[
            '60s threshold unit test (REQ-CRUX-012 AC#3)',
            '2.0x halt integration test',
            '/crux-status 7-day burn snapshot end-to-end test',
        ],
    ),
    dict(
        n=10,
        title='PR_DESCRIPTION.md generation; manual `gh pr create` at v1.0',
        decision=(
            'After reviewer (and design-reviewer when applicable) '
            'approval, /crux-task writes '
            'docs/sdlc/tasks/<task-id>/PR_DESCRIPTION.md containing the '
            'full structured trace block per REQ-CRUX-023: task id, '
            'module, mode, satisfied REQs (with one-line summaries), '
            'honored ADRs (with titles), upstream GRILL ids, review '
            'verdict and cycle count, cost summary, and diff stats. '
            '/crux-task does NOT invoke gh pr create at v1.0; the user '
            'runs `gh pr create --body-file <path>` (or equivalent for '
            'their git host) themselves. v1.1 may add /crux-pr that '
            'automates PR creation.'
        ),
        alternatives=[
            ('Inline the trace block in the PR body via gh CLI invocation',
             'rejected at v1: depends on gh installed; couples Crux to GitHub.'),
            ('Persist the trace block as a YAML file rather than markdown',
             'rejected: PR descriptions are markdown by convention; YAML adds '
             'a render step at PR-creation time.'),
            ('Autotemplate via a git pre-push hook',
             'rejected: invisible to the user; brittle across hosts.'),
        ],
        consequences=[
            'Users run `gh pr create --body-file ...` (or paste) themselves at v1.0.',
            'Trace block survives independent of the git host.',
            'v1.1 PR-creation automation is additive: same PR_DESCRIPTION.md feeds into it.',
            'Audit trail lives on disk, not in a git host\'s PR comment field.',
        ],
        resolves=['GRILL-CRUX-019'],
        satisfies=['REQ-CRUX-023'],
        constrains=['MOD-CRUX-003'],
        revisit_when=(
            'v1.1 PR-creation automation lands; OR a non-GitHub git host '
            '(GitLab, Gitea, Bitbucket) needs first-class PR template '
            'support.'
        ),
        validated_by=[
            'PR_DESCRIPTION.md generation unit test',
            'trace-block field-completeness assertion (every required field present)',
        ],
    ),
]


def emit_str(s):
    """Emit a YAML block-literal scalar."""
    return '|\n  ' + s.replace('\n', '\n  ').rstrip()


def emit_adr(a):
    L = []
    L.append(f"id: ADR-CRUX-{a['n']:03d}")
    # Titles often contain colons; always quote.
    title_q = a['title'].replace("'", "''")
    L.append(f"title: '{title_q}'")
    L.append('status: proposed')
    L.append(f"decision: {emit_str(a['decision'])}")
    L.append('alternatives_considered:')
    for opt, rationale in a['alternatives']:
        # `option` may contain colons; quote when needed.
        opt_q = opt.replace("'", "''")
        if ': ' in opt or '"' in opt:
            L.append(f"  - option: '{opt_q}'")
        else:
            L.append(f"  - option: {opt}")
        # rationale lives at 4-space indent under the list item; its
        # block-literal body must be at 6-space indent (deeper than
        # the rationale key itself) for YAML to parse it as the value.
        body = '      ' + rationale.replace('\n', '\n      ').rstrip()
        L.append('    rationale: |')
        L.append(body)
    L.append('consequences:')
    for c in a['consequences']:
        needs_quote = (
            ': ' in c
            or c.startswith(('@', '`', '*', '&', '!', '|', '>', '%', '"', "'", '#', '['))
            or '"' in c
        )
        if needs_quote:
            L.append(f"  - '{c.replace(chr(39), chr(39)*2)}'")
        else:
            L.append(f'  - {c}')
    L.append('resolves:')
    if a['resolves']:
        for x in a['resolves']:
            L.append(f'  - {x}')
    else:
        L[-1] = 'resolves: []'
    L.append('satisfies:')
    for x in a['satisfies']:
        L.append(f'  - {x}')
    L.append('constrains:')
    for x in a['constrains']:
        L.append(f'  - {x}')
    L.append(f"revisit_when: {emit_str(a['revisit_when'])}")
    L.append('validated_by:')
    for x in a['validated_by']:
        if ': ' in x or x.startswith(('@', '`', '*', '&', '!', '|', '>', '%')):
            L.append(f"  - '{x.replace(chr(39), chr(39)*2)}'")
        else:
            L.append(f'  - {x}')
    return '\n'.join(L) + '\n'


def main():
    ADR_DIR.mkdir(parents=True, exist_ok=True)
    for a in ADRS:
        path = ADR_DIR / f"ADR-CRUX-{a['n']:03d}.yaml"
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(emit_adr(a))
        print(f"wrote {path.relative_to(REPO)}")
    print(f"total: {len(ADRS)} ADRs")


if __name__ == '__main__':
    main()
