import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createIncidentCommand } from '../../../src/commands/incident/index.js';

function write(rootDir: string, relativePath: string, content: string): void {
  const target = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

describe('createIncidentCommand', () => {
  let rootDir = '';

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-incident-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('rejects unsupported subcommands with the v1 usage text', async () => {
    const command = createIncidentCommand();

    const result = await command(['open'], { rootDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: /crux-incident report');
    expect(result.stdout).toBe('');
  });

  it('writes INC, CHG, AMD, and prevention TASK artifacts without touching SKILL.md bytes', async () => {
    write(
      rootDir,
      'docs/sdlc/prd/REQ-INC-001.yaml',
      ['id: REQ-INC-001', 'text: Incident requirement', 'priority: must'].join('\n'),
    );
    write(
      rootDir,
      '.claude/skills/tdd-workflow/SKILL.md',
      ['---', 'name: tdd-workflow', '---', '# Existing skill body'].join('\n'),
    );

    const skillPath = path.join(rootDir, '.claude/skills/tdd-workflow/SKILL.md');
    const beforeSkill = fs.readFileSync(skillPath, 'utf8');
    const command = createIncidentCommand();

    const result = await command(
      [
        'report',
        '--title',
        'Release check failed in production',
        '--observed',
        'Users saw a broken release status banner.',
        '--violated',
        'REQ-INC-001',
        '--detection-source',
        'prod',
        '--severity',
        'high',
        '--skill',
        'tdd-workflow',
      ],
      { rootDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('INC-001');
    expect(result.stdout).toContain('CHG-001');
    expect(result.stdout).toContain('AMD-001');
    expect(result.stdout).toContain('TASK-001');
    expect(result.stdout).toContain('Investigate root_cause');

    const incidentPath = path.join(rootDir, 'docs/sdlc/incidents/INC-001.yaml');
    const changePath = path.join(rootDir, 'docs/sdlc/chg/CHG-001.yaml');
    const amendmentPath = path.join(rootDir, 'docs/sdlc/amendments/AMD-001.yaml');
    const taskPath = path.join(rootDir, 'docs/sdlc/tasks/TASK-001/TASK.yaml');

    expect(fs.existsSync(incidentPath)).toBe(true);
    expect(fs.existsSync(changePath)).toBe(true);
    expect(fs.existsSync(amendmentPath)).toBe(true);
    expect(fs.existsSync(taskPath)).toBe(true);
    expect(fs.readFileSync(incidentPath, 'utf8')).toContain('# TODO: complete after investigation');
    expect(fs.readFileSync(taskPath, 'utf8')).toContain('Prevent recurrence of INC-001');
    expect(fs.readFileSync(skillPath, 'utf8')).toBe(beforeSkill);
    expect(result.stderr).toBe('');
  });
});
