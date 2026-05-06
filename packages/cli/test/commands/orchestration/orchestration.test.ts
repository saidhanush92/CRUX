import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runArchitectCommand } from '../../../src/commands/architect/index.js';
import { runTaskCommand } from '../../../src/commands/task/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-orchestration-'));
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

describe('orchestration commands', () => {
  it('writes PERSONA.md and critique files during /crux-architect', async () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'stack'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'stack', 'stack.yaml'),
      'language: typescript\n',
    );

    const result = await runArchitectCommand([], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'PERSONA.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'adr', 'arch-critique.yaml'))).toBe(
      true,
    );
  });

  it('runs three isolated subagent stages and writes task artifacts', async () => {
    const taskDir = path.join(tmpDir, 'docs', 'sdlc', 'tasks', 'TASK-001');
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskDir, 'TASK.yaml'),
      'id: TASK-001\ntitle: Test task\nmodule: MOD-001\nsatisfies: []\nhonors_adrs: []\ntouches_files:\n  - packages/cli/**\nrisk: low\nparallelizable_with: []\ndepends_on: []\nestimated_cost_usd: 1.0\n',
      'utf8',
    );

    const result = await runTaskCommand(['TASK-001'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(taskDir, 'TEST_PLAN.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(taskDir, 'REVIEW-1.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(taskDir, 'PR_DESCRIPTION.md'))).toBe(true);
    const subagentsDir = path.join(tmpDir, '.crux', 'subagents');
    const requestFiles = fs
      .readdirSync(subagentsDir)
      .filter((name) => name.endsWith('.request.json'));
    expect(requestFiles.length).toBe(3);
  });
});
