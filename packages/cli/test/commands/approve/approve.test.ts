import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { approveCommand } from '../../../src/commands/approve/index.js';

function createRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-approve-test-'));
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

describe('approveCommand', () => {
  it('approves an ADR by flipping status and logging the approval event', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    writeFile(
      rootDir,
      'docs/sdlc/adr/ADR-001.yaml',
      [
        'id: ADR-001',
        'title: Choose headless CLI',
        'status: proposed',
        'decision: |',
        '  Keep the CLI deterministic.',
      ].join('\n'),
    );

    const originalUser = process.env.USERNAME;
    process.env.USERNAME = 'Worker A';

    try {
      const result = await approveCommand(['ADR-001'], {
        rootDir,
        now: () => new Date('2026-05-06T14:15:16.000Z'),
      });

      expect(result.exitCode).toBe(0);
      expect(read(rootDir, 'docs/sdlc/adr/ADR-001.yaml')).toContain('status: accepted');
      expect(read(rootDir, 'docs/sdlc/adr/ADR-001.yaml')).toContain('approved_by: Worker A');
      expect(read(rootDir, 'docs/sdlc/approvals.log')).toContain(
        '2026-05-06T14:15:16.000Z  /crux-approve  ADR-001  approved-by=Worker A',
      );
    } finally {
      if (originalUser === undefined) {
        delete process.env.USERNAME;
      } else {
        process.env.USERNAME = originalUser;
      }
    }
  });

  it('halts when the artifact is already approved', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    writeFile(
      rootDir,
      'docs/sdlc/prd/REQ-001.yaml',
      [
        'id: REQ-001',
        'text: |',
        '  Preserve explicit approvals.',
        'derived_from:',
        '  - GRILL-001',
        'acceptance_criteria:',
        '  - Approval is explicit.',
        'priority: must',
        'gate: 2',
        'approved_by: Existing User',
        'approved_at: 2026-05-05T00:00:00.000Z',
      ].join('\n'),
    );

    const result = await approveCommand(['REQ-001'], {
      rootDir,
      now: () => new Date('2026-05-06T14:15:16.000Z'),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('already approved');
    expect(result.stderr).toContain('Existing User');
  });
});
