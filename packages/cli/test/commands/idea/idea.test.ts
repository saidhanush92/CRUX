import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ideaCommand } from '../../../src/commands/idea/index.js';

function createRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-idea-test-'));
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

describe('ideaCommand', () => {
  it('ingests an input file into IDEA frontmatter plus annotations without mutating the body', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    const sourcePath = path.join(rootDir, 'brief.md');
    fs.writeFileSync(
      sourcePath,
      [
        '# Ship trace explorer',
        '',
        'We should launch a trace explorer next sprint.',
        'This will reduce onboarding time by 50%.',
        'TBD: do we support export?',
        'We picked markdown over SQLite because portability matters.',
      ].join('\n'),
      'utf8',
    );

    const result = await ideaCommand(['brief.md'], {
      rootDir,
      now: () => new Date('2026-05-06T11:12:13.000Z'),
    });

    const idea = read(rootDir, 'docs/sdlc/input/IDEA-001.md');
    expect(result.exitCode).toBe(0);
    expect(idea).toContain('id: IDEA-001');
    expect(idea).toContain('classification: brief');
    expect(idea).toContain('depth: surface');
    expect(idea).toContain('# Ship trace explorer');
    expect(idea).toContain('## Crux annotations');
    expect(idea).toContain('## Claims (unverified)');
    expect(idea).toContain('This will reduce onboarding time by 50%.');
    expect(idea).toContain('## Unknowns');
    expect(idea).toContain('TBD: do we support export?');
    expect(idea).toContain('## Implicit decisions');
    expect(idea).toContain('We picked markdown over SQLite because portability matters.');
    expect(result.stdout).toContain('classification: brief');
    expect(result.stdout).toContain('claims=1 unknowns=1 implicit_decisions=1');
  });

  it('asks for a source path when no argument is provided', async () => {
    const rootDir = createRepo();
    cleanupDirs.push(rootDir);

    const result = await ideaCommand([], {
      rootDir,
      now: () => new Date('2026-05-06T11:12:13.000Z'),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('pass a path');
  });
});
