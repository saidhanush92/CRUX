import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createArchitectCommand } from '../../../src/commands/architect/index.js';

interface SpawnCall {
  readonly agentName: string;
  readonly prompt: string;
  readonly isolated?: boolean;
}

const tempDirs: string[] = [];

function makeTempRepo(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-architect-'));
  tempDirs.push(rootDir);

  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'prd'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'modules'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'adr'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'stack'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'sdlc', 'prd', 'PRD.md'), '# PRD\n', 'utf8');
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'prd', 'REQ-CRUX-002.yaml'),
    [
      'id: REQ-CRUX-002',
      'text: Persona trade-off decisions must be explicit.',
      'derived_from:',
      '  - GRILL-CRUX-002',
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
      '  - REQ-CRUX-002',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'sdlc', 'stack', 'stack.yaml'),
    [
      'language: typescript',
      'crux_mode: compressed',
      'quality_gates:',
      '  typecheck: pnpm tsc --noEmit',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(path.join(rootDir, 'docs', 'sdlc', 'approvals.log'), '# approvals\n', 'utf8');

  return rootDir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('createArchitectCommand', () => {
  it('halts when PERSONA.md is missing', async () => {
    const rootDir = makeTempRepo();
    const handler = createArchitectCommand({
      spawnSubagent: async () => 'unused',
      awaitSubagent: async () => undefined,
    });

    const result = await handler([], { rootDir, now: () => new Date('2026-05-06T00:00:00.000Z') });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('docs/sdlc/PERSONA.md');
  });

  it('runs architect first, then arch-critic and pre-mortem, and logs accepted risks', async () => {
    const rootDir = makeTempRepo();
    const calls: SpawnCall[] = [];

    fs.writeFileSync(
      path.join(rootDir, 'docs', 'sdlc', 'PERSONA.md'),
      '# Persona\n\nPrimary: founding team.\n',
      'utf8',
    );

    const handler = createArchitectCommand({
      spawnSubagent: async (_rootDir, options) => {
        calls.push({
          agentName: options.agentName,
          prompt: options.prompt,
          isolated: options.isolated,
        });
        return `${options.agentName}-${calls.length}`;
      },
      awaitSubagent: async (_rootDir, handle) => {
        if (handle === 'architect-1') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'adr', 'ADR-CRUX-099.yaml'),
            [
              'id: ADR-CRUX-099',
              "title: 'Architect test ADR'",
              'status: proposed',
              'decision: |',
              '  Keep the architecture testable.',
              'revisit_when: |',
              '  Revisit when tests say so.',
              'validated_by:',
              '  - command orchestration test',
            ].join('\n'),
            'utf8',
          );
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'stack', 'stack.yaml'),
            [
              'language: typescript',
              'crux_mode: compressed',
              'quality_gates:',
              '  typecheck: pnpm tsc --noEmit',
              'cost_halt_multiplier: 2.0',
            ].join('\n'),
            'utf8',
          );
        }

        if (handle === 'arch-critic-2') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'adr', 'arch-critique.yaml'),
            [
              'noted_at: 2026-05-06T00:00:00Z',
              'critiques:',
              '  - id: ARCH-CRIT-001',
              '    severity: low',
              '    target:',
              '      - ADR-CRUX-099',
              '    finding: |',
              '      Looks good.',
              '    resolved: true',
            ].join('\n'),
            'utf8',
          );
        }

        if (handle === 'pre-mortem-3') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'adr', 'pre-mortem.yaml'),
            [
              'generated_at: 2026-05-06T00:00:00Z',
              'failure_modes:',
              '  - id: PM-CRUX-123',
              '    classification: accept-as-known-risk',
              '    title: |',
              '      Cosmetic markdown quirk.',
              '  - id: PM-CRUX-124',
              '    classification: route-to-test',
              '    title: |',
              '      Add more coverage.',
            ].join('\n'),
            'utf8',
          );
        }
      },
    });

    const result = await handler([], { rootDir, now: () => new Date('2026-05-06T00:00:00.000Z') });

    expect(result.exitCode).toBe(0);
    expect(calls.map((call) => call.agentName)).toEqual(['architect', 'arch-critic', 'pre-mortem']);
    expect(calls[0]?.prompt).toContain('docs/sdlc/PERSONA.md');
    expect(calls[1]?.prompt).toContain('persona_trade_off');
    expect(calls[2]?.isolated).toBe(true);
    expect(result.stdout).toContain('ADR-CRUX-099');
    expect(result.stdout).toContain('arch-critic verdict: clean');
    expect(result.stdout).toContain('pre-mortem verdict: 2 failure modes');
    expect(fs.readFileSync(path.join(rootDir, 'docs', 'sdlc', 'approvals.log'), 'utf8')).toContain(
      'PM-CRUX-123  kind=accepted-risk',
    );
  });

  it('hard-blocks when critique output or route-to-ADR-clause items remain unresolved', async () => {
    const rootDir = makeTempRepo();

    fs.writeFileSync(
      path.join(rootDir, 'docs', 'sdlc', 'PERSONA.md'),
      '# Persona\n\nPrimary: founding team.\n',
      'utf8',
    );

    const handler = createArchitectCommand({
      spawnSubagent: async (_rootDir, options) => options.agentName,
      awaitSubagent: async (_rootDir, handle) => {
        if (handle === 'architect') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'adr', 'ADR-CRUX-100.yaml'),
            [
              'id: ADR-CRUX-100',
              "title: 'Blocked ADR'",
              'status: proposed',
              'decision: |',
              '  Test block.',
            ].join('\n'),
            'utf8',
          );
        }

        if (handle === 'arch-critic') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'adr', 'arch-critique.yaml'),
            [
              'critiques:',
              '  - id: ARCH-CRIT-002',
              '    severity: high',
              '    target:',
              '      - ADR-CRUX-100',
              '    finding: |',
              '      Needs work.',
              '    resolved: false',
            ].join('\n'),
            'utf8',
          );
        }

        if (handle === 'pre-mortem') {
          fs.writeFileSync(
            path.join(rootDir, 'docs', 'sdlc', 'adr', 'pre-mortem.yaml'),
            [
              'failure_modes:',
              '  - id: PM-CRUX-200',
              '    classification: route-to-ADR-clause',
              '    routing_target: ADR-CRUX-100',
              '    resolved: false',
            ].join('\n'),
            'utf8',
          );
        }
      },
    });

    const result = await handler([], { rootDir, now: () => new Date('2026-05-06T00:00:00.000Z') });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Resolve any route-to-ADR-clause items first');
    expect(result.stdout).toContain('1 concerns flagged');
  });
});
