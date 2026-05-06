import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createStatusCommand } from '../../../src/commands/status/index.js';

const NOW = new Date('2026-05-06T12:00:00Z');

function write(rootDir: string, relativePath: string, content: string): void {
  const target = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

describe('createStatusCommand', () => {
  let rootDir = '';

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-status-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('reports the empty-repo guidance without mutating artifacts', async () => {
    const command = createStatusCommand();

    const result = await command([], { rootDir, now: () => NOW });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('no gates open');
    expect(result.stdout).toContain('Critiques: 0 spec, 0 arch, 0 pre-mortem unresolved');
    expect(result.stdout).toContain('/crux-init');
    expect(result.stdout).toContain('/crux-idea');
    expect(result.stderr).toBe('');
  });

  it('summarizes gates, critiques, costs, and recent events from the SDLC tree', async () => {
    write(
      rootDir,
      'docs/sdlc/input/IDEA-001.md',
      ['---', 'id: IDEA-001', 'title: Trace everything', '---', '', '# Idea'].join('\n'),
    );
    write(rootDir, 'docs/sdlc/prd/PRD.md', '# PRD');
    write(
      rootDir,
      'docs/sdlc/prd/REQ-001.yaml',
      [
        'id: REQ-001',
        'text: Requirement one',
        'derived_from:',
        '  - GRILL-001',
        'priority: must',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/prd/REQ-002.yaml',
      [
        'id: REQ-002',
        'text: Requirement two',
        'derived_from:',
        '  - GRILL-001',
        'priority: should',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/grill/GRILL-001.yaml',
      ['id: GRILL-001', 'idea: IDEA-001', 'question: Why?', 'answer: Because.'].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/modules/MOD-001.yaml',
      [
        'id: MOD-001',
        'name: cli',
        'responsibility: status',
        'surface: headless',
        'derived_from:',
        '  - REQ-001',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/adr/ADR-001.yaml',
      ['id: ADR-001', 'title: Accepted ADR', 'status: accepted', 'decision: Use YAML.'].join('\n'),
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
      'docs/sdlc/tasks/TASK-002/TASK.yaml',
      ['id: TASK-002', 'title: In-cycle task', 'module: MOD-001', 'satisfies:', '  - REQ-001'].join(
        '\n',
      ),
    );
    write(
      rootDir,
      'docs/sdlc/tasks/TASK-002/REVIEW-1.yaml',
      ['task: TASK-002', 'verdict: request_changes', 'cycle_number: 1'].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/tasks/TASK-003/TASK.yaml',
      ['id: TASK-003', 'title: Open task', 'module: MOD-001', 'satisfies:', '  - REQ-001'].join(
        '\n',
      ),
    );
    write(
      rootDir,
      'docs/sdlc/prd/spec-critique.yaml',
      [
        'noted_at: 2026-05-05T00:00:00Z',
        'critiques:',
        '  - id: SPEC-CRIT-001',
        '    target: [REQ-001]',
        '    finding: Needs more precision.',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/adr/arch-critique.yaml',
      ['noted_at: 2026-05-05T00:00:00Z', 'critiques: []'].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/adr/pre-mortem.yaml',
      [
        'generated_at: 2026-05-05T00:00:00Z',
        'failure_modes:',
        '  - id: PM-001',
        '    classification: route-to-ADR-clause',
        '    routing_target: ADR-001',
        '    title: Unresolved failure mode',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/costs/log.csv',
      [
        'task_id,agent,tokens_estimated,wall_seconds,notes',
        'TASK-001,test-writer,900,80,first',
        'TASK-002,coder,1400,120,second',
        'TASK-001,reviewer,1000,100,third',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/approvals.log',
      [
        '2026-05-05T00:00:00Z  /crux-approve  PRD-CRUX  approved-by=tester',
        '2026-05-05T01:00:00Z  /crux-approve  ADR-001  approved-by=tester',
        '2026-05-05T02:00:00Z  /crux-task  TASK-001  approved  cycles=1',
        '2026-05-05T03:00:00Z  /crux-task  TASK-004  approved  cycles=2',
        '2026-05-05T04:00:00Z  /crux-task  TASK-005  approved  cycles=1',
        '2026-05-05T05:00:00Z  /crux-task  TASK-006  approved  cycles=1',
      ].join('\n'),
    );

    const command = createStatusCommand();
    const result = await command([], { rootDir, now: () => NOW });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1 input');
    expect(result.stdout).toContain('closed');
    expect(result.stdout).toContain('7 build');
    expect(result.stdout).toContain('1 open / 1 in-cycle / 1 approved');
    expect(result.stdout).toContain('Critiques: 1 spec, 0 arch, 1 pre-mortem unresolved');
    expect(result.stdout).toContain('Cost');
    expect(result.stdout).toContain('TASK-001');
    expect(result.stdout).toContain('Recent');
    expect(result.stdout).toContain('/crux-task  TASK-006  approved');
    expect(result.stderr).toBe('');
  });
});
