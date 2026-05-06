/**
 * resolve.test.ts
 *
 * Locks the resolveAmendmentsForSkill contract described in TASK-CRUX-004.
 *
 * The function must:
 *   - Read .claude/skills/<skillName>/SKILL.md verbatim.
 *   - Scan docs/sdlc/amendments/ for AMD YAML files whose target_skill matches.
 *   - Append "## Active amendments" section with matching entries.
 *   - Render severity:high entries with "**BLOCKING:**" prefix.
 *   - Sort multiple matching amendments lexicographically by id.
 *   - Skip (not throw) AMD files with missing required fields; log console.error.
 *   - NEVER write to SKILL.md.
 *   - Throw SkillNotFoundError (named error) when SKILL.md is absent.
 *   - Return SKILL.md body unchanged when amendments directory is missing.
 *
 * Sources:
 *   - TASK-CRUX-004 (touches_files: packages/core/src/amendments/**)
 *   - REQ-CRUX-018 (amendment-writer must never modify SKILL.md bytes;
 *                   severity:high renders as BLOCKING)
 *   - ADR-CRUX-005 (resolveAmendmentsForSkill in MOD-CRUX-001 public surface)
 *
 * These tests are intentionally RED until the coder creates:
 *   packages/core/src/amendments/resolve.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { resolveAmendmentsForSkill, SkillNotFoundError } from '../../src/amendments/resolve.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-amd-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/**
 * Build the standard directory layout inside tmpDir:
 *   .claude/skills/<skillName>/SKILL.md
 *   docs/sdlc/amendments/          (created if amdFiles provided)
 */
function setupSkill(skillName: string, skillContent: string): void {
  const skillDir = path.join(tmpDir, '.claude', 'skills', skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8');
}

function setupAmendmentsDir(): void {
  const amdDir = path.join(tmpDir, 'docs', 'sdlc', 'amendments');
  fs.mkdirSync(amdDir, { recursive: true });
}

function writeAmendment(filename: string, content: string): void {
  const amdDir = path.join(tmpDir, 'docs', 'sdlc', 'amendments');
  fs.writeFileSync(path.join(amdDir, filename), content, 'utf8');
}

const MINIMAL_SKILL_BODY = `# My Skill\n\nSome instructions here.\n`;

const AMD_MATCHING_LOW = `\
id: AMD-001
triggered_by: incident
target_skill: my-skill
rule: |
  Always double-check your work.
applies_when: |
  When the task involves external API calls.
severity: low
`;

const AMD_MATCHING_HIGH = `\
id: AMD-002
triggered_by: incident
target_skill: my-skill
rule: |
  Never skip validation.
applies_when: |
  All tasks.
severity: high
`;

const AMD_OTHER_SKILL = `\
id: AMD-003
triggered_by: incident
target_skill: other-skill
rule: |
  Irrelevant rule.
applies_when: |
  Never.
severity: low
`;

// ===========================================================================
// SECTION 1 — No amendments scenario
// ===========================================================================

describe('resolveAmendmentsForSkill — no amendments', () => {
  it('returns SKILL.md body verbatim when amendments directory does not exist', () => {
    // Arrange — no docs/sdlc/amendments/ directory at all
    setupSkill('my-skill', MINIMAL_SKILL_BODY);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert
    expect(result).toBe(MINIMAL_SKILL_BODY);
  });

  it('returns SKILL.md body verbatim when amendments directory is empty', () => {
    // Arrange
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert
    expect(result).toBe(MINIMAL_SKILL_BODY);
  });

  it('returns SKILL.md body verbatim when no AMD files target this skill', () => {
    // Arrange
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-003.yaml', AMD_OTHER_SKILL);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert
    expect(result).toBe(MINIMAL_SKILL_BODY);
  });
});

// ===========================================================================
// SECTION 2 — Single matching amendment
// ===========================================================================

describe('resolveAmendmentsForSkill — single matching amendment', () => {
  it('appends Active amendments section separated by double newline', () => {
    // Arrange
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-001.yaml', AMD_MATCHING_LOW);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert — section header present
    expect(result).toContain('\n\n## Active amendments\n\n');
  });

  it('formats amendment line with id, severity, applies_when, and rule', () => {
    // Arrange
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-001.yaml', AMD_MATCHING_LOW);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert — expected line format
    expect(result).toContain(
      '- **AMD-001** [severity: low] applies_when=When the task involves external API calls.: Always double-check your work.',
    );
  });

  it('prefixes severity:high amendment with BLOCKING', () => {
    // Arrange
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-002.yaml', AMD_MATCHING_HIGH);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert
    expect(result).toContain('**BLOCKING:** - **AMD-002** [severity: high]');
  });

  it('starts with the original SKILL.md content', () => {
    // Arrange
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-001.yaml', AMD_MATCHING_LOW);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert — SKILL.md text appears at the start
    expect(result.startsWith(MINIMAL_SKILL_BODY)).toBe(true);
  });
});

// ===========================================================================
// SECTION 3 — Multiple matching amendments
// ===========================================================================

describe('resolveAmendmentsForSkill — multiple matching amendments', () => {
  const AMD_MATCHING_MED = `\
id: AMD-010
triggered_by: cross-pattern
target_skill: my-skill
rule: |
  Check edge cases before submitting.
applies_when: |
  Any review step.
severity: medium
`;

  it('lists multiple matching amendments in lexicographic order by id', () => {
    // Arrange — write in reverse order to verify sorting
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-010.yaml', AMD_MATCHING_MED);
    writeAmendment('AMD-002.yaml', AMD_MATCHING_HIGH);
    writeAmendment('AMD-001.yaml', AMD_MATCHING_LOW);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert — AMD-001 appears before AMD-002, AMD-002 before AMD-010
    const idx001 = result.indexOf('AMD-001');
    const idx002 = result.indexOf('AMD-002');
    const idx010 = result.indexOf('AMD-010');
    expect(idx001).toBeGreaterThan(-1);
    expect(idx002).toBeGreaterThan(-1);
    expect(idx010).toBeGreaterThan(-1);
    expect(idx001).toBeLessThan(idx002);
    expect(idx002).toBeLessThan(idx010);
  });

  it('excludes AMD files whose target_skill does not match', () => {
    // Arrange
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-001.yaml', AMD_MATCHING_LOW);
    writeAmendment('AMD-003.yaml', AMD_OTHER_SKILL);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert — only AMD-001 line appears, AMD-003 must not appear
    expect(result).toContain('AMD-001');
    expect(result).not.toContain('AMD-003');
  });
});

// ===========================================================================
// SECTION 4 — Robustness: malformed AMD files
// ===========================================================================

describe('resolveAmendmentsForSkill — malformed AMD files', () => {
  it('skips AMD file missing target_skill field and logs console.error', () => {
    // Arrange
    const AMD_NO_TARGET = `\
id: AMD-005
triggered_by: incident
rule: |
  A rule with no target skill.
applies_when: |
  Always.
severity: low
`;
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-005.yaml', AMD_NO_TARGET);
    // Also add a valid one so the section is still created
    writeAmendment('AMD-001.yaml', AMD_MATCHING_LOW);

    const errorSpy = vi.spyOn(console, 'error');

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert — does not throw; AMD-005 skipped; console.error called
    expect(result).not.toContain('AMD-005');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('skips AMD file missing rule field and logs console.error', () => {
    // Arrange
    const AMD_NO_RULE = `\
id: AMD-006
triggered_by: incident
target_skill: my-skill
applies_when: |
  Always.
severity: low
`;
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-006.yaml', AMD_NO_RULE);

    const errorSpy = vi.spyOn(console, 'error');

    // Act
    expect(() => resolveAmendmentsForSkill('my-skill', tmpDir)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('skips AMD file missing severity field and logs console.error', () => {
    // Arrange
    const AMD_NO_SEVERITY = `\
id: AMD-007
triggered_by: incident
target_skill: my-skill
rule: |
  A rule without severity.
applies_when: |
  Always.
`;
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-007.yaml', AMD_NO_SEVERITY);

    const errorSpy = vi.spyOn(console, 'error');

    // Act
    expect(() => resolveAmendmentsForSkill('my-skill', tmpDir)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ===========================================================================
// SECTION 5 — SKILL.md immutability
// ===========================================================================

describe('resolveAmendmentsForSkill — SKILL.md immutability', () => {
  it('never modifies SKILL.md byte content after the call', () => {
    // Arrange
    setupSkill('my-skill', MINIMAL_SKILL_BODY);
    setupAmendmentsDir();
    writeAmendment('AMD-001.yaml', AMD_MATCHING_LOW);
    writeAmendment('AMD-002.yaml', AMD_MATCHING_HIGH);

    const skillPath = path.join(tmpDir, '.claude', 'skills', 'my-skill', 'SKILL.md');
    const before = fs.readFileSync(skillPath, 'utf8');

    // Act
    resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert — byte-level equality
    const after = fs.readFileSync(skillPath, 'utf8');
    expect(after).toBe(before);
  });
});

// ===========================================================================
// SECTION 6 — Error: missing SKILL.md
// ===========================================================================

describe('resolveAmendmentsForSkill — missing skill', () => {
  it('throws SkillNotFoundError when SKILL.md does not exist', () => {
    // Arrange — no skill directory created at all

    // Act & Assert
    expect(() => resolveAmendmentsForSkill('nonexistent-skill', tmpDir)).toThrow(
      SkillNotFoundError,
    );
  });

  it('includes the skill name in the SkillNotFoundError message', () => {
    // Arrange
    // Act & Assert
    expect(() => resolveAmendmentsForSkill('nonexistent-skill', tmpDir)).toThrow(
      /nonexistent-skill/,
    );
  });

  it('SkillNotFoundError is an instance of Error', () => {
    // Arrange
    // Act & Assert
    try {
      resolveAmendmentsForSkill('no-such-skill', tmpDir);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(SkillNotFoundError);
    }
  });
});

// ===========================================================================
// SECTION 7 — Return type is a string
// ===========================================================================

describe('resolveAmendmentsForSkill — return type', () => {
  it('returns a string in all code paths', () => {
    // Arrange — no amendments dir
    setupSkill('my-skill', MINIMAL_SKILL_BODY);

    // Act
    const result = resolveAmendmentsForSkill('my-skill', tmpDir);

    // Assert
    expect(typeof result).toBe('string');
  });
});
