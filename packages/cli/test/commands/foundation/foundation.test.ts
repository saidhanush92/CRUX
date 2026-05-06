import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runIdeaCommand } from '../../../src/commands/idea/index.js';
import { runGrillCommand } from '../../../src/commands/grill/index.js';
import { runPrdCommand } from '../../../src/commands/prd/index.js';
import { runModulesCommand } from '../../../src/commands/modules/index.js';
import { runApproveCommand } from '../../../src/commands/approve/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-foundation-'));
}

function removeTempDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTempDir();
  fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'input'), { recursive: true });
});

afterEach(() => {
  removeTempDir(tmpDir);
});

describe('foundation commands', () => {
  it('ingests an idea file with annotations', async () => {
    const sourcePath = path.join(tmpDir, 'brief.md');
    fs.writeFileSync(sourcePath, 'We should use CRUX. TBD design trade-off.\n', 'utf8');

    const result = await runIdeaCommand(['brief.md'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    const ideaPath = path.join(tmpDir, 'docs', 'sdlc', 'input', 'IDEA-001.md');
    const ideaRaw = fs.readFileSync(ideaPath, 'utf8');
    expect(ideaRaw).toContain('## Crux annotations');
    expect(ideaRaw).toContain('design_gate_enabled: false');
  });

  it('creates grill files with scaled question count for a thin idea', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'input', 'IDEA-001.md'),
      '---\nid: IDEA-001\ndepth: surface\n---\nshort idea text\n',
      'utf8',
    );

    const result = await runGrillCommand(['IDEA-001'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('input too thin');
    const grillDir = path.join(tmpDir, 'docs', 'sdlc', 'grill');
    const files = fs.readdirSync(grillDir);
    expect(files.length).toBeLessThanOrEqual(7);
  });

  it('writes PRD and REQ artifacts from grill output', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'input', 'IDEA-001.md'),
      '---\nid: IDEA-001\ndepth: surface\n---\nsmall idea\n',
      'utf8',
    );
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'grill'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'grill', 'GRILL-001.yaml'),
      'id: GRILL-001\nidea: IDEA-001\nquestion: |\n  What should happen?\nanswer: use durable artifacts\n',
      'utf8',
    );

    const result = await runPrdCommand(['IDEA-001'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'prd', 'PRD.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'prd', 'REQ-001.yaml'))).toBe(true);
  });

  it('writes module files from REQ artifacts', async () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'prd'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'prd', 'REQ-001.yaml'),
      'id: REQ-001\ntext: |\n  Requirement one\nderived_from:\n  - GRILL-001\nacceptance_criteria:\n  - works\npriority: must\ngate: 2\n',
      'utf8',
    );

    const result = await runModulesCommand([], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'sdlc', 'modules', 'MOD-001.yaml'))).toBe(true);
  });

  it('approves a YAML artifact and appends approvals.log', async () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'adr'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'sdlc', 'adr', 'ADR-001.yaml'),
      'id: ADR-001\ntitle: Test ADR\nstatus: proposed\n',
      'utf8',
    );

    const result = await runApproveCommand(['ADR-001'], { rootDir: tmpDir });

    expect(result.exitCode).toBe(0);
    const raw = fs.readFileSync(path.join(tmpDir, 'docs', 'sdlc', 'adr', 'ADR-001.yaml'), 'utf8');
    expect(raw).toContain('status: accepted');
    expect(raw).toContain('approved_at:');
  });
});
