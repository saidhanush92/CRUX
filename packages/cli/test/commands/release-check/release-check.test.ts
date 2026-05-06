import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createReleaseCheckCommand } from '../../../src/commands/release-check/index.js';

function write(rootDir: string, relativePath: string, content: string): void {
  const target = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function buildReleaseReadyRepo(rootDir: string): void {
  write(
    rootDir,
    'docs/sdlc/input/IDEA-001.md',
    ['---', 'id: IDEA-001', 'title: Release ready', '---', '', '# Idea'].join('\n'),
  );
  write(rootDir, 'docs/sdlc/prd/PRD.md', '# PRD');
  write(
    rootDir,
    'docs/sdlc/grill/GRILL-001.yaml',
    ['id: GRILL-001', 'idea: IDEA-001', 'question: Ship it?'].join('\n'),
  );
  write(
    rootDir,
    'docs/sdlc/prd/REQ-001.yaml',
    [
      'id: REQ-001',
      'text: Release requirement',
      'derived_from:',
      '  - GRILL-001',
      'priority: must',
    ].join('\n'),
  );
  write(
    rootDir,
    'docs/sdlc/modules/MOD-001.yaml',
    [
      'id: MOD-001',
      'name: release-check',
      'responsibility: Verify release readiness',
      'surface: headless',
      'derived_from:',
      '  - REQ-001',
    ].join('\n'),
  );
  write(
    rootDir,
    'docs/sdlc/adr/ADR-001.yaml',
    [
      'id: ADR-001',
      'title: Accepted ADR',
      'status: accepted',
      'decision: Keep it deterministic.',
    ].join('\n'),
  );
  write(
    rootDir,
    'docs/sdlc/harness/harness.lock',
    [
      'generated_at: 2026-05-05T00:00:00Z',
      'verification:',
      '  format_check: pass',
      '  lint_check: pass',
      '  typecheck: pass',
      '  test_runner_empty: pass',
    ].join('\n'),
  );
  write(
    rootDir,
    'docs/sdlc/tasks/TASK-001/TASK.yaml',
    ['id: TASK-001', 'title: Approved task', 'module: MOD-001', 'satisfies:', '  - REQ-001'].join(
      '\n',
    ),
  );
  write(
    rootDir,
    'docs/sdlc/prd/spec-critique.yaml',
    'noted_at: 2026-05-05T00:00:00Z\ncritiques: []\n',
  );
  write(
    rootDir,
    'docs/sdlc/adr/arch-critique.yaml',
    'noted_at: 2026-05-05T00:00:00Z\ncritiques: []\n',
  );
  write(
    rootDir,
    'docs/sdlc/adr/pre-mortem.yaml',
    'generated_at: 2026-05-05T00:00:00Z\nfailure_modes: []\n',
  );
  write(
    rootDir,
    'docs/sdlc/approvals.log',
    [
      '2026-05-05T00:00:00Z  /crux-approve  PRD-CRUX  approved-by=tester',
      '2026-05-05T01:00:00Z  /crux-approve  ADR-001  approved-by=tester',
      '2026-05-05T02:00:00Z  /crux-task  TASK-001  approved  cycles=1',
    ].join('\n'),
  );
}

describe('createReleaseCheckCommand', () => {
  let rootDir = '';

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-release-check-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('emits release-ready, appends approvals.log, and does not create REL artifacts on a clean repo', async () => {
    buildReleaseReadyRepo(rootDir);
    const command = createReleaseCheckCommand();

    const result = await command([], {
      rootDir,
      now: () => new Date('2026-05-06T00:00:00Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('release-ready');
    expect(result.stdout).toContain('gates-1-to-7-closed');
    expect(result.stdout).toContain('no-open-incidents');
    expect(result.stderr).toBe('');
    expect(fs.readFileSync(path.join(rootDir, 'docs/sdlc/approvals.log'), 'utf8')).toContain(
      '/crux-release-check  release-ready',
    );
    expect(fs.existsSync(path.join(rootDir, 'docs/sdlc/releases'))).toBe(false);
  });

  it.each([
    ['gates-1-to-7-closed', (dir: string) => fs.rmSync(path.join(dir, 'docs/sdlc/prd/PRD.md'))],
    [
      'orphan-check-clean',
      (dir: string) =>
        write(
          dir,
          'docs/sdlc/tasks/TASK-002/TASK.yaml',
          [
            'id: TASK-002',
            'title: Broken task',
            'module: MOD-001',
            'satisfies:',
            '  - REQ-MISSING-001',
          ].join('\n'),
        ),
    ],
    [
      'no-proposed-adrs',
      (dir: string) =>
        write(
          dir,
          'docs/sdlc/adr/ADR-001.yaml',
          ['id: ADR-001', 'title: Proposed ADR', 'status: proposed', 'decision: Pending.'].join(
            '\n',
          ),
        ),
    ],
    [
      'no-escalated-reviews',
      (dir: string) =>
        write(
          dir,
          'docs/sdlc/tasks/TASK-001/REVIEW-1.yaml',
          ['task: TASK-001', 'verdict: escalate', 'cycle_number: 1'].join('\n'),
        ),
    ],
    [
      'no-cycle-gte-3',
      (dir: string) =>
        write(
          dir,
          'docs/sdlc/tasks/TASK-001/REVIEW-3.yaml',
          ['task: TASK-001', 'verdict: request_changes', 'cycle_number: 3'].join('\n'),
        ),
    ],
    [
      'harness-lock-all-pass',
      (dir: string) => fs.rmSync(path.join(dir, 'docs/sdlc/harness/harness.lock')),
    ],
    [
      'critiques-resolved',
      (dir: string) =>
        write(
          dir,
          'docs/sdlc/prd/spec-critique.yaml',
          [
            'noted_at: 2026-05-05T00:00:00Z',
            'critiques:',
            '  - id: SPEC-CRIT-001',
            '    target: [REQ-001]',
            '    finding: unresolved',
          ].join('\n'),
        ),
    ],
    [
      'no-open-incidents',
      (dir: string) =>
        write(
          dir,
          'docs/sdlc/incidents/INC-001.yaml',
          ['id: INC-001', 'title: Open incident', 'chg_events_opened:', '  - CHG-001'].join('\n'),
        ),
    ],
  ])('reports a named failure when checklist item %s fails', async (itemName, mutate) => {
    buildReleaseReadyRepo(rootDir);
    mutate(rootDir);
    const command = createReleaseCheckCommand();

    const result = await command([], {
      rootDir,
      now: () => new Date('2026-05-06T00:00:00Z'),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(itemName);
    expect(result.stdout).toContain('not release-ready');
  });
});
