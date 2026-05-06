import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runHarnessCommand } from '../../../src/commands/harness/index.js';
import { runReleaseCheckCommand } from '../../../src/commands/release-check/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-release-'));
}

function removeTempDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTempDir();
});

afterEach(() => {
  removeTempDir(tmpDir);
});

describe('release and harness commands', () => {
  it('requires --accept-defaults for non-interactive harness runs', async () => {
    const result = await runHarnessCommand([], { rootDir: tmpDir });
    expect(result.exitCode).toBe(1);
  });

  it('writes harness.lock when defaults are accepted and no collisions exist', async () => {
    const result = await runHarnessCommand(['--accept-defaults'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'harness', 'harness.lock'))).toBe(true);
  });

  it('fails release-check when harness.lock is missing', async () => {
    const result = await runReleaseCheckCommand([], { rootDir: tmpDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('harness.lock present and verification all-pass');
  });

  it('reports release-ready and logs the verdict when harness.lock is present', async () => {
    // Set up a minimal release-ready repo with all gate artifacts
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'input'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'input', 'IDEA-001.md'),
      '---\nid: IDEA-001\n---\n# Idea\n',
    );
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'prd'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'sdlc', 'prd', 'PRD.md'), '# PRD\n');
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'modules'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'modules', 'MOD-001.yaml'),
      'id: MOD-001\nname: mod\n',
    );
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'adr'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'adr', 'ADR-001.yaml'),
      'id: ADR-001\nstatus: accepted\n',
    );
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'harness'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'harness', 'harness.lock'),
      'verification: pass\n',
    );

    const result = await runReleaseCheckCommand([], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('release-ready');
    expect(fs.readFileSync(path.join(tmpDir, 'docs', 'sdlc', 'approvals.log'), 'utf8')).toContain(
      '/crux-release-check',
    );
  });
});
