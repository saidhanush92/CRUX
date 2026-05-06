import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTraceCommand } from '../../../src/commands/trace/index.js';

function write(rootDir: string, relativePath: string, content: string): void {
  const target = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

describe('createTraceCommand', () => {
  let rootDir = '';

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-trace-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('renders upstream and downstream trees with critique context and orphan markers', async () => {
    write(
      rootDir,
      'docs/sdlc/input/IDEA-TRACE-001.md',
      ['---', 'id: IDEA-TRACE-001', 'title: Trace tree', '---', '', '# Idea'].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/grill/GRILL-TRACE-001.yaml',
      ['id: GRILL-TRACE-001', 'idea: IDEA-TRACE-001', 'question: Start here?'].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/prd/REQ-TRACE-001.yaml',
      [
        'id: REQ-TRACE-001',
        'text: Trace every requirement',
        'derived_from:',
        '  - GRILL-TRACE-001',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/modules/MOD-TRACE-001.yaml',
      [
        'id: MOD-TRACE-001',
        'name: trace-cli',
        'responsibility: trace command',
        'derived_from:',
        '  - REQ-TRACE-001',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/tasks/TASK-TRACE-001/TASK.yaml',
      [
        'id: TASK-TRACE-001',
        'title: Implement trace command',
        'module: MOD-TRACE-001',
        'satisfies:',
        '  - REQ-TRACE-001',
        'honors_adrs:',
        '  - ADR-MISSING-001',
        'touches_files:',
        '  - packages/cli/src/commands/trace/index.ts',
      ].join('\n'),
    );
    write(
      rootDir,
      'docs/sdlc/prd/spec-critique.yaml',
      [
        'noted_at: 2026-05-05T00:00:00Z',
        'critiques:',
        '  - id: SPEC-CRIT-TRACE-001',
        '    category: vague',
        '    severity: medium',
        '    target: [REQ-TRACE-001]',
        '    finding: Clarify trace wording.',
      ].join('\n'),
    );

    const command = createTraceCommand();
    const result = await command(['REQ-TRACE-001'], { rootDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('UPSTREAM');
    expect(result.stdout).toContain('REQ-TRACE-001');
    expect(result.stdout).toContain('GRILL-TRACE-001');
    expect(result.stdout).toContain('IDEA-TRACE-001');
    expect(result.stdout).toContain('SPEC-CRIT-TRACE-001');
    expect(result.stdout).toContain('DOWNSTREAM');
    expect(result.stdout).toContain('MOD-TRACE-001');
    expect(result.stdout).toContain('TASK-TRACE-001');
    expect(result.stdout).toContain('packages/cli/src/commands/trace/index.ts');
    expect(result.stdout).toContain('Orphan markers');
    expect(result.stdout).toContain('ADR-MISSING-001');
    expect(result.stderr).toBe('');
  });

  it('returns the prefix map when the requested artifact id cannot be resolved', async () => {
    const command = createTraceCommand();

    const result = await command(['REQ-DOES-NOT-EXIST'], { rootDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('REQ-DOES-NOT-EXIST');
    expect(result.stderr).toContain('REQ -> docs/sdlc/prd');
    expect(result.stdout).toBe('');
  });
});
