import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { modulesCommand } from '../../../src/commands/modules/index.js';

function createRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-modules-test-'));
}

function writeFile(rootDir: string, relativePath: string, content: string): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function read(rootDir: string, relativePath: string): string {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const cleanupDirs: string[] = [];

afterEach(() => {
  for (const dir of cleanupDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('modulesCommand', () => {
  it('writes module artifacts from approved PRD requirements', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    writeFile(rootDir, 'docs/sdlc/prd/PRD.md', '# PRD: Example\n');
    writeFile(
      rootDir,
      'docs/sdlc/approvals.log',
      '# header\n2026-05-06T12:00:00.000Z  /crux-approve  PRD  approved-by=Tester\n',
    );
    writeFile(
      rootDir,
      'docs/sdlc/prd/REQ-001.yaml',
      [
        'id: REQ-001',
        'text: |',
        '  Build a CLI orchestration flow.',
        'derived_from:',
        '  - GRILL-001',
        'acceptance_criteria:',
        '  - CLI flow exists.',
        'priority: must',
        'gate: 2',
        'module_hint: cli-runtime',
      ].join('\n'),
    );
    writeFile(
      rootDir,
      'docs/sdlc/prd/REQ-002.yaml',
      [
        'id: REQ-002',
        'text: |',
        '  Provide a trace storage module.',
        'derived_from:',
        '  - GRILL-002',
        'acceptance_criteria:',
        '  - Trace storage exists.',
        'priority: must',
        'gate: 2',
        'module_hint: trace-store',
        'depends_on_modules:',
        '  - cli-runtime',
      ].join('\n'),
    );
    writeFile(
      rootDir,
      'docs/sdlc/prd/REQ-003.yaml',
      [
        'id: REQ-003',
        'text: |',
        '  Render a UI explorer.',
        'derived_from:',
        '  - GRILL-003',
        'acceptance_criteria:',
        '  - UI explorer exists.',
        'priority: should',
        'gate: 2',
        'module_hint: ui-shell',
        'surface_hint: ui',
        'depends_on_modules:',
        '  - trace-store',
      ].join('\n'),
    );

    const result = await modulesCommand(['PRD'], {
      rootDir,
      now: () => new Date('2026-05-06T13:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(read(rootDir, 'docs/sdlc/modules/MOD-001.yaml')).toContain('name: cli-runtime');
    expect(read(rootDir, 'docs/sdlc/modules/MOD-002.yaml')).toContain('name: trace-store');
    expect(read(rootDir, 'docs/sdlc/modules/MOD-003.yaml')).toContain('surface: ui');
    expect(result.stdout).toContain('MOD-001');
    expect(result.stdout).toContain('Run `/crux-architect` next');
  });

  it('writes module files but halts when a dependency cycle is detected', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    writeFile(rootDir, 'docs/sdlc/prd/PRD.md', '# PRD: Example\n');
    writeFile(
      rootDir,
      'docs/sdlc/approvals.log',
      '# header\n2026-05-06T12:00:00.000Z  /crux-approve  PRD  approved-by=Tester\n',
    );
    writeFile(
      rootDir,
      'docs/sdlc/prd/REQ-001.yaml',
      [
        'id: REQ-001',
        'text: |',
        '  Alpha responsibility.',
        'derived_from:',
        '  - GRILL-001',
        'acceptance_criteria:',
        '  - Alpha exists.',
        'priority: must',
        'gate: 2',
        'module_hint: alpha',
        'depends_on_modules:',
        '  - beta',
      ].join('\n'),
    );
    writeFile(
      rootDir,
      'docs/sdlc/prd/REQ-002.yaml',
      [
        'id: REQ-002',
        'text: |',
        '  Beta responsibility.',
        'derived_from:',
        '  - GRILL-002',
        'acceptance_criteria:',
        '  - Beta exists.',
        'priority: must',
        'gate: 2',
        'module_hint: beta',
        'depends_on_modules:',
        '  - alpha',
      ].join('\n'),
    );

    const result = await modulesCommand(['PRD'], {
      rootDir,
      now: () => new Date('2026-05-06T13:00:00.000Z'),
    });

    expect(result.exitCode).toBe(1);
    expect(read(rootDir, 'docs/sdlc/modules/MOD-001.yaml')).toContain('name: alpha');
    expect(result.stderr).toContain('CRITICAL');
    expect(result.stderr).toContain('alpha -> beta -> alpha');
  });
});
