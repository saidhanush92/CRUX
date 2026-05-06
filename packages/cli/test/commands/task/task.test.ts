import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTaskCommand } from '../../../src/commands/task/index.js';

interface SpawnCall {
  readonly agentName: string;
  readonly prompt: string;
  readonly isolated?: boolean;
}

const tempDirs: string[] = [];

function makeTempRepo(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-task-'));
  tempDirs.push(rootDir);

  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'tasks', 'TASK-CRUX-900'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'prd'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'adr'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'modules'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'stack'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'costs'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'packages', 'cli', 'src', 'commands', 'task'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(rootDir, 'packages', 'cli', 'test', 'commands', 'task'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'tasks', 'TASK-CRUX-900', 'TASK.yaml'),
    [
      'id: TASK-CRUX-900',
      "title: 'Implement task orchestration'",
      'module: MOD-CRUX-003',
      'satisfies:',
      '  - REQ-CRUX-017',
      '  - REQ-CRUX-023',
      'honors_adrs:',
      '  - ADR-CRUX-004',
      '  - ADR-CRUX-010',
      'touches_files:',
      '  - packages/cli/src/commands/task/**',
      '  - packages/cli/test/commands/task/**',
      'estimated_cost_usd: 3.5',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'prd', 'REQ-CRUX-017.yaml'),
    [
      'id: REQ-CRUX-017',
      'text: |',
      '  In /crux-task, the test-writer, coder, and reviewer phases must run as three separate subagent invocations.',
      'derived_from:',
      '  - GRILL-CRUX-013',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'prd', 'REQ-CRUX-023.yaml'),
    [
      'id: REQ-CRUX-023',
      'text: |',
      '  /crux-task must produce PR_DESCRIPTION.md after approval.',
      'derived_from:',
      '  - GRILL-CRUX-019',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'adr', 'ADR-CRUX-004.yaml'),
    [
      'id: ADR-CRUX-004',
      "title: 'Subagent isolation'",
      'status: accepted',
      'decision: |',
      '  Separate stage identities.',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'adr', 'ADR-CRUX-010.yaml'),
    [
      'id: ADR-CRUX-010',
      "title: 'PR description generation'",
      'status: accepted',
      'decision: |',
      '  Emit markdown only.',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'modules', 'MOD-CRUX-003.yaml'),
    [
      'id: MOD-CRUX-003',
      'name: cli',
      'surface: headless',
      'derived_from:',
      '  - REQ-CRUX-017',
      '  - REQ-CRUX-023',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'stack', 'stack.yaml'),
    [
      'crux_mode: compressed',
      'quality_gates:',
      '  typecheck: pnpm tsc --noEmit',
      '  lint: pnpm eslint .',
      'constraints:',
      '  - text: "no runtime dependency may be added unless declared here first"',
      '    source: stack-template-default',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(path.join(rootDir, 'docs', 'sdlc', 'approvals.log'), '# approvals\n', 'utf8');
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'costs', 'log.csv'),
    [
      'task_id,agent,tokens_estimated,wall_seconds,notes',
      'TASK-CRUX-900,test-writer,1200,61,red',
      'TASK-CRUX-900,coder,1500,62,green',
      'TASK-CRUX-900,reviewer,900,63,approve',
    ].join('\n'),
    'utf8',
  );

  return rootDir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('createTaskCommand', () => {
  it('halts when a referenced ADR is not yet accepted', async () => {
    const rootDir = makeTempRepo();
    fs.writeFileSync(
      path.join(rootDir, 'docs', 'sdlc', 'adr', 'ADR-CRUX-010.yaml'),
      [
        'id: ADR-CRUX-010',
        "title: 'PR description generation'",
        'status: proposed',
        'decision: |',
        '  Emit markdown only.',
      ].join('\n'),
      'utf8',
    );

    const handler = createTaskCommand({
      spawnSubagent: async () => 'unused',
      awaitSubagent: async () => undefined,
    });

    const result = await handler(['TASK-CRUX-900'], {
      rootDir,
      now: () => new Date('2026-05-06T00:00:00.000Z'),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('approve the ADR first');
  });

  it('uses isolated test-writer, coder, and reviewer invocations and writes PR_DESCRIPTION.md', async () => {
    const rootDir = makeTempRepo();
    const calls: SpawnCall[] = [];

    const handler = createTaskCommand({
      spawnSubagent: async (_rootDir, options) => {
        calls.push({
          agentName: options.agentName,
          prompt: options.prompt,
          isolated: options.isolated,
        });
        return `${options.agentName}-${calls.length}`;
      },
      awaitSubagent: async (_rootDir, handle) => {
        if (handle === 'test-writer-1') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'tasks', 'TASK-CRUX-900', 'TEST_PLAN.yaml'),
            [
              'task: TASK-CRUX-900',
              'test_layers:',
              '  unit:',
              '    - covers: isolated subagents',
              '      file: packages/cli/test/commands/task/task.test.ts',
              'coverage_target: 80',
            ].join('\n'),
            'utf8',
          );
        }

        if (handle === 'coder-2') {
          fs.writeFileSync(
            path.join(rootDir, 'packages', 'cli', 'src', 'commands', 'task', 'implementation.ts'),
            'export const implemented = true;\n',
            'utf8',
          );
        }

        if (handle === 'reviewer-3') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'tasks', 'TASK-CRUX-900', 'REVIEW-1.yaml'),
            [
              'task: TASK-CRUX-900',
              'reviewer: reviewer',
              'verdict: approve',
              'cycle_number: 1',
              'concerns: []',
            ].join('\n'),
            'utf8',
          );
        }
      },
    });

    const result = await handler(['TASK-CRUX-900'], {
      rootDir,
      now: () => new Date('2026-05-06T00:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(calls.map((call) => call.agentName)).toEqual(['test-writer', 'coder', 'reviewer']);
    expect(calls.every((call) => call.isolated === true)).toBe(true);
    expect(calls[1]?.prompt).not.toContain('Apply .claude/skills/tdd-workflow/SKILL.md');
    expect(calls[2]?.prompt).not.toContain('May read tests but may NOT modify them.');
    const prDescription = fs.readFileSync(
      path.join(rootDir, 'docs', 'sdlc', 'tasks', 'TASK-CRUX-900', 'PR_DESCRIPTION.md'),
      'utf8',
    );
    expect(prDescription).toContain('TASK-CRUX-900');
    expect(prDescription).toContain('REQ-CRUX-017');
    expect(prDescription).toContain('ADR-CRUX-010');
    expect(prDescription).toContain('GRILL-CRUX-019');
    expect(prDescription).toContain('Cycles: 1');
    expect(fs.readFileSync(path.join(rootDir, 'docs', 'sdlc', 'approvals.log'), 'utf8')).toContain(
      '/crux-task  TASK-CRUX-900  approved  cycles=1',
    );
    expect(result.stdout).toContain('cost estimate vs. actual');
  });

  it('loops coder and reviewer until approval and carries reviewer concerns into the next coder brief', async () => {
    const rootDir = makeTempRepo();
    const calls: SpawnCall[] = [];

    const handler = createTaskCommand({
      spawnSubagent: async (_rootDir, options) => {
        calls.push({
          agentName: options.agentName,
          prompt: options.prompt,
          isolated: options.isolated,
        });
        return `${options.agentName}-${calls.length}`;
      },
      awaitSubagent: async (_rootDir, handle) => {
        if (handle === 'test-writer-1') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'tasks', 'TASK-CRUX-900', 'TEST_PLAN.yaml'),
            [
              'task: TASK-CRUX-900',
              'test_layers:',
              '  unit:',
              '    - covers: review loops',
              '      file: packages/cli/test/commands/task/task.test.ts',
            ].join('\n'),
            'utf8',
          );
        }

        if (handle === 'reviewer-3') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'tasks', 'TASK-CRUX-900', 'REVIEW-1.yaml'),
            [
              'task: TASK-CRUX-900',
              'reviewer: reviewer',
              'verdict: request_changes',
              'cycle_number: 1',
              'concerns:',
              '  - severity: medium',
              '    finding: |',
              '      Add the missing edge case.',
            ].join('\n'),
            'utf8',
          );
        }

        if (handle === 'reviewer-5') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'tasks', 'TASK-CRUX-900', 'REVIEW-2.yaml'),
            [
              'task: TASK-CRUX-900',
              'reviewer: reviewer',
              'verdict: approve',
              'cycle_number: 2',
              'concerns: []',
            ].join('\n'),
            'utf8',
          );
        }
      },
    });

    const result = await handler(['TASK-CRUX-900'], {
      rootDir,
      now: () => new Date('2026-05-06T00:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(calls.map((call) => call.agentName)).toEqual([
      'test-writer',
      'coder',
      'reviewer',
      'coder',
      'reviewer',
    ]);
    expect(calls[3]?.prompt).toContain('Add the missing edge case.');
    expect(result.stdout).toContain('cycles=2');
  });
});
