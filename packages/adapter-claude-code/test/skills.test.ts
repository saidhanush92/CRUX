/**
 * skills.test.ts
 *
 * Tests for the Skills concern group (ADR-CRUX-003):
 *   install_skill, uninstall_skill, list_skills
 *
 * Key contracts:
 *  - install_skill copies <source>/SKILL.md to <rootDir>/.claude/skills/<skillName>/SKILL.md
 *  - install_skill throws SkillSourceMissingError if source has no SKILL.md
 *  - install_skill throws SkillAlreadyPresentError if skill already installed
 *  - uninstall_skill removes the skill directory; idempotent on absent skill
 *  - list_skills scans .claude/skills/ for sub-dirs containing SKILL.md
 *
 * All tests are RED until the coder creates:
 *   packages/adapter-claude-code/src/skills.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { SessionId } from '../../core/src/adapter/types.js';
import { ADAPTER_INTERFACE_MANIFEST } from '../../core/src/adapter/interface.js';

import { session_start, session_end } from '../src/lifecycle.js';
import {
  install_skill,
  uninstall_skill,
  list_skills,
  SkillAlreadyPresentError,
  SkillSourceMissingError,
} from '../src/skills.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-test-skills-'));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Creates a fake skill source directory containing a SKILL.md file.
 * Returns the source path.
 */
function makeSkillSource(
  baseDir: string,
  skillName: string,
  content = `# ${skillName} skill`,
): string {
  const sourceDir = path.join(baseDir, 'skill-sources', skillName);
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'SKILL.md'), content, 'utf8');
  return sourceDir;
}

/**
 * Returns the expected install directory for a skill.
 */
function installedSkillDir(rootDir: string, skillName: string): string {
  return path.join(rootDir, '.claude', 'skills', skillName);
}

/**
 * Returns the expected path to the installed SKILL.md.
 */
function installedSkillMd(rootDir: string, skillName: string): string {
  return path.join(installedSkillDir(rootDir, skillName), 'SKILL.md');
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let sessionId: SessionId;

beforeEach(async () => {
  tmpDir = makeTempDir();
  sessionId = await session_start({ metadata: { rootDir: tmpDir } });
});

afterEach(async () => {
  await session_end(sessionId).catch(() => {});
  removeTempDir(tmpDir);
});

// ---------------------------------------------------------------------------
// install_skill
// ---------------------------------------------------------------------------

describe('install_skill', () => {
  it('resolves with an object containing skillId (non-empty string) and path', async () => {
    // Arrange
    const source = makeSkillSource(tmpDir, 'my-skill');

    // Act
    const result = await install_skill(tmpDir, { sessionId, skillName: 'my-skill', source });

    // Assert
    expect(result).toBeDefined();
    expect(typeof result.skillId).toBe('string');
    expect((result.skillId as string).length).toBeGreaterThan(0);
    expect(typeof result.path).toBe('string');
  });

  it('creates the SKILL.md at <rootDir>/.claude/skills/<skillName>/SKILL.md', async () => {
    const source = makeSkillSource(tmpDir, 'tdd-workflow');

    await install_skill(tmpDir, { sessionId, skillName: 'tdd-workflow', source });

    expect(fs.existsSync(installedSkillMd(tmpDir, 'tdd-workflow'))).toBe(true);
  });

  it('installed SKILL.md content matches the source content exactly', async () => {
    const content = '# Custom TDD Skill\n\nsome unique content — marker-XYZ';
    const source = makeSkillSource(tmpDir, 'custom-tdd', content);

    await install_skill(tmpDir, { sessionId, skillName: 'custom-tdd', source });

    const installed = fs.readFileSync(installedSkillMd(tmpDir, 'custom-tdd'), 'utf8');
    expect(installed).toBe(content);
  });

  it('returned path matches the installed skill directory', async () => {
    const source = makeSkillSource(tmpDir, 'example-skill');

    const { path: returnedPath } = await install_skill(tmpDir, {
      sessionId,
      skillName: 'example-skill',
      source,
    });

    expect(returnedPath).toBe(installedSkillDir(tmpDir, 'example-skill'));
  });

  it('creates intermediate directories under .claude/skills/ as needed', async () => {
    const source = makeSkillSource(tmpDir, 'new-skill');
    // .claude/skills/ does not exist yet
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'skills'))).toBe(false);

    await install_skill(tmpDir, { sessionId, skillName: 'new-skill', source });

    expect(fs.existsSync(installedSkillDir(tmpDir, 'new-skill'))).toBe(true);
  });

  it('throws SkillSourceMissingError when source directory has no SKILL.md', async () => {
    // Arrange — source dir exists but SKILL.md is absent
    const emptySource = path.join(tmpDir, 'empty-source');
    fs.mkdirSync(emptySource, { recursive: true });

    // Act + Assert
    await expect(
      install_skill(tmpDir, { sessionId, skillName: 'empty', source: emptySource }),
    ).rejects.toThrow(SkillSourceMissingError);
  });

  it('throws SkillSourceMissingError when source directory does not exist at all', async () => {
    const nonexistent = path.join(tmpDir, 'does-not-exist');

    await expect(
      install_skill(tmpDir, { sessionId, skillName: 'ghost', source: nonexistent }),
    ).rejects.toThrow(SkillSourceMissingError);
  });

  it('SkillSourceMissingError is an instance of Error', async () => {
    const nonexistent = path.join(tmpDir, 'nope');
    const err = await install_skill(tmpDir, {
      sessionId,
      skillName: 'ghost',
      source: nonexistent,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
  });

  it('throws SkillAlreadyPresentError on second install of the same skill name', async () => {
    const source = makeSkillSource(tmpDir, 'collision-skill');

    // First install — must succeed
    await install_skill(tmpDir, { sessionId, skillName: 'collision-skill', source });

    // Second install — must throw
    await expect(
      install_skill(tmpDir, { sessionId, skillName: 'collision-skill', source }),
    ).rejects.toThrow(SkillAlreadyPresentError);
  });

  it('SkillAlreadyPresentError message contains the skill name', async () => {
    const source = makeSkillSource(tmpDir, 'dupe-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'dupe-skill', source });

    const err = await install_skill(tmpDir, {
      sessionId,
      skillName: 'dupe-skill',
      source,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SkillAlreadyPresentError);
    expect((err as Error).message).toContain('dupe-skill');
  });

  it('SkillAlreadyPresentError is an instance of Error', async () => {
    const source = makeSkillSource(tmpDir, 'err-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'err-skill', source });

    const err = await install_skill(tmpDir, {
      sessionId,
      skillName: 'err-skill',
      source,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// uninstall_skill
// ---------------------------------------------------------------------------

describe('uninstall_skill', () => {
  it('resolves (void) and removes the skill directory when skill is installed', async () => {
    const source = makeSkillSource(tmpDir, 'removable-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'removable-skill', source });

    await expect(
      uninstall_skill(tmpDir, { sessionId, skillName: 'removable-skill' }),
    ).resolves.toBeUndefined();

    expect(fs.existsSync(installedSkillDir(tmpDir, 'removable-skill'))).toBe(false);
  });

  it('SKILL.md is gone after uninstall', async () => {
    const source = makeSkillSource(tmpDir, 'bye-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'bye-skill', source });

    await uninstall_skill(tmpDir, { sessionId, skillName: 'bye-skill' });

    expect(fs.existsSync(installedSkillMd(tmpDir, 'bye-skill'))).toBe(false);
  });

  it('is idempotent — removing an absent skill resolves without throwing', async () => {
    await expect(
      uninstall_skill(tmpDir, { sessionId, skillName: 'never-installed' }),
    ).resolves.toBeUndefined();
  });

  it('allows reinstall after uninstall (no residual lock)', async () => {
    const source = makeSkillSource(tmpDir, 'reinstall-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'reinstall-skill', source });
    await uninstall_skill(tmpDir, { sessionId, skillName: 'reinstall-skill' });

    await expect(
      install_skill(tmpDir, { sessionId, skillName: 'reinstall-skill', source }),
    ).resolves.toBeDefined();
  });

  it('does not affect other installed skills', async () => {
    const srcA = makeSkillSource(tmpDir, 'skill-a');
    const srcB = makeSkillSource(tmpDir, 'skill-b');
    await install_skill(tmpDir, { sessionId, skillName: 'skill-a', source: srcA });
    await install_skill(tmpDir, { sessionId, skillName: 'skill-b', source: srcB });

    await uninstall_skill(tmpDir, { sessionId, skillName: 'skill-a' });

    expect(fs.existsSync(installedSkillMd(tmpDir, 'skill-b'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// list_skills
// ---------------------------------------------------------------------------

describe('list_skills', () => {
  it('returns an empty array when no skills are installed', async () => {
    const skills = await list_skills(tmpDir, sessionId);

    expect(Array.isArray(skills)).toBe(true);
    expect(skills).toHaveLength(0);
  });

  it('returns an empty array when the .claude/skills/ directory does not exist', async () => {
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'skills'))).toBe(false);

    const skills = await list_skills(tmpDir, sessionId);

    expect(skills).toHaveLength(0);
  });

  it('returns one descriptor after installing one skill', async () => {
    const source = makeSkillSource(tmpDir, 'alpha-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'alpha-skill', source });

    const skills = await list_skills(tmpDir, sessionId);

    expect(skills).toHaveLength(1);
  });

  it('each descriptor has skillId (string), name (string), and path (string)', async () => {
    const source = makeSkillSource(tmpDir, 'beta-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'beta-skill', source });

    const [skill] = await list_skills(tmpDir, sessionId);

    expect(skill).toBeDefined();
    expect(typeof skill!.skillId).toBe('string');
    expect(typeof skill!.name).toBe('string');
    expect(typeof skill!.path).toBe('string');
  });

  it('descriptor name matches the installed skill name', async () => {
    const source = makeSkillSource(tmpDir, 'gamma-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'gamma-skill', source });

    const [skill] = await list_skills(tmpDir, sessionId);

    expect(skill!.name).toBe('gamma-skill');
  });

  it('descriptor path points to the installed skill directory', async () => {
    const source = makeSkillSource(tmpDir, 'delta-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'delta-skill', source });

    const [skill] = await list_skills(tmpDir, sessionId);

    expect(skill!.path).toBe(installedSkillDir(tmpDir, 'delta-skill'));
  });

  it('returns descriptors for all installed skills', async () => {
    const names = ['skill-a', 'skill-b', 'skill-c'];
    for (const name of names) {
      const source = makeSkillSource(tmpDir, name);
      await install_skill(tmpDir, { sessionId, skillName: name, source });
    }

    const skills = await list_skills(tmpDir, sessionId);

    expect(skills).toHaveLength(3);
    const returnedNames = skills.map((s) => s.name).sort();
    expect(returnedNames).toEqual([...names].sort());
  });

  it('excludes sub-dirs that have no SKILL.md (invalid skill)', async () => {
    // Manually create an incomplete skill directory (no SKILL.md)
    const skillsDir = path.join(tmpDir, '.claude', 'skills');
    fs.mkdirSync(path.join(skillsDir, 'incomplete-skill'), { recursive: true });

    const skills = await list_skills(tmpDir, sessionId);

    expect(skills.map((s) => s.name)).not.toContain('incomplete-skill');
  });

  it('does not include a skill after it has been uninstalled', async () => {
    const source = makeSkillSource(tmpDir, 'transient-skill');
    await install_skill(tmpDir, { sessionId, skillName: 'transient-skill', source });
    await uninstall_skill(tmpDir, { sessionId, skillName: 'transient-skill' });

    const skills = await list_skills(tmpDir, sessionId);

    expect(skills.map((s) => s.name)).not.toContain('transient-skill');
  });
});

// ---------------------------------------------------------------------------
// Manifest conformance — Skills group
// ---------------------------------------------------------------------------

describe('skills module manifest conformance', () => {
  it('exports all 3 Skills functions declared in ADAPTER_INTERFACE_MANIFEST', async () => {
    const mod = await import('../src/skills.js');
    const exported = Object.keys(mod);

    for (const fn of ADAPTER_INTERFACE_MANIFEST['Skills']) {
      expect(exported, `skills module must export "${fn}"`).toContain(fn);
    }
  });

  it('SkillAlreadyPresentError is exported from the skills module', async () => {
    const mod = await import('../src/skills.js');
    expect(mod['SkillAlreadyPresentError']).toBeDefined();
    expect(typeof mod['SkillAlreadyPresentError']).toBe('function');
  });

  it('SkillSourceMissingError is exported from the skills module', async () => {
    const mod = await import('../src/skills.js');
    expect(mod['SkillSourceMissingError']).toBeDefined();
    expect(typeof mod['SkillSourceMissingError']).toBe('function');
  });
});
