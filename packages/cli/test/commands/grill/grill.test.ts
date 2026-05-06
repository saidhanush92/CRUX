import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { grillCommand } from '../../../src/commands/grill/index.js';

function createRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-grill-test-'));
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

describe('grillCommand', () => {
  it('creates a thin deterministic grill pass and defaults design_gate_enabled to false', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    fs.mkdirSync(path.join(rootDir, 'docs', 'sdlc', 'input'), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, 'docs', 'sdlc', 'input', 'IDEA-001.md'),
      [
        '---',
        'id: IDEA-001',
        'ingested_at: 2026-05-06T00:00:00.000Z',
        'source_path: brief.md',
        'classification: ticket',
        'depth: surface',
        '---',
        '',
        'Fix flaky task retries fast.',
      ].join('\n'),
      'utf8',
    );

    const result = await grillCommand(['IDEA-001'], {
      rootDir,
      now: () => new Date('2026-05-06T12:13:14.000Z'),
    });

    const grillDir = path.join(rootDir, 'docs', 'sdlc', 'grill');
    const grillFiles = fs.readdirSync(grillDir).filter((entry) => entry.endsWith('.yaml'));

    expect(result.exitCode).toBe(0);
    expect(grillFiles).toHaveLength(6);
    expect(read(rootDir, 'docs/sdlc/input/IDEA-001.md')).toContain('design_gate_enabled: false');
    expect(read(rootDir, 'docs/sdlc/grill/GRILL-001.yaml')).toContain('state: pending');
    expect(read(rootDir, 'docs/sdlc/grill/GRILL-001.yaml')).toContain('source: inferred');
    expect(result.stdout).toContain('input too thin');
    expect(result.stdout).toContain('Generated 6 grill questions');
  });
});
