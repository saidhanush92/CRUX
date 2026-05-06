import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runStatusCommand } from '../../../src/commands/status/index.js';
import { runTraceCommand } from '../../../src/commands/trace/index.js';
import { runIncidentCommand } from '../../../src/commands/incident/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-audit-'));
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

describe('audit commands', () => {
  it('renders gate status summary', async () => {
    const result = await runStatusCommand([], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Gates');
    expect(result.stdout).toContain('Critiques:');
  });

  it('walks trace links for an artifact id', async () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'prd'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'prd', 'REQ-001.yaml'),
      'id: REQ-001\ntext: |\n  Requirement one\n',
      'utf8',
    );
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'modules'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'modules', 'MOD-001.yaml'),
      'id: MOD-001\nderived_from:\n  - REQ-001\nresponsibility: |\n  module summary\n',
      'utf8',
    );

    const result = await runTraceCommand(['REQ-001'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('UPSTREAM');
    expect(result.stdout).toContain('DOWNSTREAM');
    expect(result.stdout).toContain('MOD-001.yaml');
  });

  it('opens an incident and cascades CHG, AMD, and prevention TASK artifacts', async () => {
    const result = await runIncidentCommand(['report'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('INC-001');
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'incidents', 'INC-001.yaml'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'chg', 'CHG-001.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'amendments', 'AMD-001.yaml'))).toBe(
      true,
    );
  });
});
