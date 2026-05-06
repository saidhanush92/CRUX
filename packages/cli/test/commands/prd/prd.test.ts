import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prdCommand } from '../../../src/commands/prd/index.js';

function createRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-prd-test-'));
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

describe('prdCommand', () => {
  it('writes PRD, REQs, and a clean spec critique from answered GRILL artifacts', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    writeFile(
      rootDir,
      'docs/sdlc/input/IDEA-001.md',
      [
        '---',
        'id: IDEA-001',
        'ingested_at: 2026-05-06T00:00:00.000Z',
        'source_path: brief.md',
        'classification: concept_note',
        'depth: medium',
        'design_gate_enabled: false',
        '---',
        '',
        'Build a deterministic trace explorer for internal engineering teams.',
      ].join('\n'),
    );

    for (let i = 1; i <= 10; i++) {
      writeFile(
        rootDir,
        `docs/sdlc/grill/GRILL-${String(i).padStart(3, '0')}.yaml`,
        [
          `id: GRILL-${String(i).padStart(3, '0')}`,
          'idea: IDEA-001',
          `gate: ${((i - 1) % 4) + 1}`,
          'question: |',
          `  What must the system guarantee for scenario ${i}?`,
          'answer: |',
          `  The system must preserve requirement ${i} with explicit acceptance criteria.`,
          'confidence: high',
          'source: user',
          'asked_by: grill-interviewer',
          'answered_at: 2026-05-06T12:00:00.000Z',
        ].join('\n'),
      );
    }

    const result = await prdCommand(['IDEA-001'], {
      rootDir,
      now: () => new Date('2026-05-06T12:30:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(read(rootDir, 'docs/sdlc/prd/PRD.md')).toContain('# PRD: IDEA-001');
    expect(read(rootDir, 'docs/sdlc/prd/PRD.md')).toContain('REQ-001');
    expect(read(rootDir, 'docs/sdlc/prd/REQ-001.yaml')).toContain('derived_from:');
    expect(read(rootDir, 'docs/sdlc/prd/REQ-001.yaml')).toContain('gate: 2');
    expect(read(rootDir, 'docs/sdlc/prd/spec-critique.yaml')).toContain('critiques: []');
    expect(result.stdout).toContain('must=');
    expect(result.stdout).toContain('Spec-critic verdict: clean');
  });

  it('warns and stops on under-grilled inputs unless forced', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    writeFile(
      rootDir,
      'docs/sdlc/input/IDEA-001.md',
      [
        '---',
        'id: IDEA-001',
        'ingested_at: 2026-05-06T00:00:00.000Z',
        'source_path: brief.md',
        'classification: brief',
        'depth: surface',
        '---',
        '',
        'Tiny idea.',
      ].join('\n'),
    );

    const result = await prdCommand(['IDEA-001'], {
      rootDir,
      now: () => new Date('2026-05-06T12:30:00.000Z'),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('at least 10 GRILL files');
    expect(result.stderr).toContain('--force');
  });
});
