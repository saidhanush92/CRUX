import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runInitCommand } from '../../../src/commands/init/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-init-'));
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

describe('runInitCommand', () => {
  it('creates stack.yaml and logs /crux-init for a greenfield repo', async () => {
    const result = await runInitCommand(['--greenfield'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'stack', 'stack.yaml'))).toBe(true);
    const log = fs.readFileSync(path.join(tmpDir, 'docs', 'sdlc', 'approvals.log'), 'utf8');
    expect(log).toContain('/crux-init');
  });

  it('creates a gap report and starter IDEA in brownfield mode', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    for (let index = 0; index < 25; index++) {
      fs.writeFileSync(path.join(tmpDir, 'src', `file-${index}.ts`), 'export const x = 1;\n');
    }

    const result = await runInitCommand([], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'gate0', 'gap-report.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'input', 'IDEA-001.md'))).toBe(true);
  });
});
