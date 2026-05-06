/**
 * cascade.test.ts
 *
 * Locks the INC/CHG/AMD cascade plumbing contract for TASK-CRUX-006.
 *
 * These tests are intentionally RED until the coder creates:
 *   packages/core/src/incidents/cascade.ts
 * exporting: emitIncident, emitChange, emitAmendment, runCascade
 *
 * Sources:
 *   - TASK-CRUX-006 (touches_files: packages/core/src/incidents/**)
 *   - REQ-CRUX-010 (INC->CHG->AMD cascade; no daemon; AC#1 and AC#2)
 *   - ADR-CRUX-005 (amendments never edit SKILL.md bytes; write to docs/sdlc/amendments/)
 *   - templates/INCIDENT.yaml.tmpl
 *   - templates/CHG.yaml.tmpl
 *   - templates/AMENDMENT.yaml.tmpl
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  emitIncident,
  emitChange,
  emitAmendment,
  runCascade,
} from '../../src/incidents/cascade.js';

// ---------------------------------------------------------------------------
// Repo root (packages/core/test/incidents → up 5 levels)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Temp dir per test
// ---------------------------------------------------------------------------

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cascade-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Bootstrap a minimal synthetic rootDir structure that cascade functions need:
 *   docs/sdlc/incidents/
 *   docs/sdlc/chg/
 *   docs/sdlc/amendments/
 *   .claude/skills/<skillName>/SKILL.md  (optional)
 */
function buildRoot(opts: { skillName?: string; skillContent?: string } = {}): string {
  fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'incidents'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'chg'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'docs', 'sdlc', 'amendments'), { recursive: true });

  if (opts.skillName) {
    const skillDir = path.join(tmpDir, '.claude', 'skills', opts.skillName);
    fs.mkdirSync(skillDir, { recursive: true });
    const content = opts.skillContent ?? `---\nname: ${opts.skillName}\n---\n# Skill body\n`;
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');
  }

  return tmpDir;
}

/**
 * Read the contents of docs/sdlc/<subdir>/ from a root directory.
 * Returns a list of filenames.
 */
function listArtifacts(root: string, subdir: 'incidents' | 'chg' | 'amendments'): string[] {
  const dir = path.join(root, 'docs', 'sdlc', subdir);
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'));
  } catch {
    return [];
  }
}

// ===========================================================================
// SECTION 1 — Export shape
// ===========================================================================

describe('cascade module export shape', () => {
  it('emitIncident is a callable function', () => {
    expect(typeof emitIncident).toBe('function');
  });

  it('emitChange is a callable function', () => {
    expect(typeof emitChange).toBe('function');
  });

  it('emitAmendment is a callable function', () => {
    expect(typeof emitAmendment).toBe('function');
  });

  it('runCascade is a callable function', () => {
    expect(typeof runCascade).toBe('function');
  });
});

// ===========================================================================
// SECTION 2 — emitIncident
// ===========================================================================

describe('emitIncident — basic file creation', () => {
  it('returns an id starting with INC-', () => {
    const root = buildRoot();
    const result = emitIncident(root, {
      title: 'Test incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Something went wrong.',
    });
    expect(result.id).toMatch(/^INC-/);
  });

  it('returns a path that ends with .yaml', () => {
    const root = buildRoot();
    const result = emitIncident(root, {
      title: 'Test incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Root cause here.',
    });
    expect(result.path).toMatch(/\.yaml$/);
  });

  it('writes the file to docs/sdlc/incidents/', () => {
    const root = buildRoot();
    const result = emitIncident(root, {
      title: 'Test incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Root cause here.',
    });
    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.path).toContain(path.join('docs', 'sdlc', 'incidents'));
  });

  it('written file contains the incident id', () => {
    const root = buildRoot();
    const result = emitIncident(root, {
      title: 'Coverage dropped below 80%',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Tests were skipped.',
    });
    const content = fs.readFileSync(result.path, 'utf8');
    expect(content).toContain(result.id);
  });

  it('written file contains the title', () => {
    const root = buildRoot();
    const result = emitIncident(root, {
      title: 'Coverage dropped below 80%',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Tests were skipped.',
    });
    const content = fs.readFileSync(result.path, 'utf8');
    expect(content).toContain('Coverage dropped below 80%');
  });

  it('written file contains the violated artifact reference', () => {
    const root = buildRoot();
    const result = emitIncident(root, {
      title: 'Test incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Root cause.',
    });
    const content = fs.readFileSync(result.path, 'utf8');
    expect(content).toContain('REQ-CRUX-010');
  });

  it('written file is valid YAML (parseable)', () => {
    const root = buildRoot();
    const result = emitIncident(root, {
      title: 'Parseable incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Root cause.',
    });
    const content = fs.readFileSync(result.path, 'utf8');
    // Must contain key: value lines
    expect(content).toMatch(/^\w+:/m);
  });
});

describe('emitIncident — monotonic id allocation', () => {
  it('allocates INC-001 when incidents/ is empty', () => {
    const root = buildRoot();
    const result = emitIncident(root, {
      title: 'First incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Root cause.',
    });
    // The id should be the first sequential id (001 or 1 depending on format)
    expect(result.id).toMatch(/^INC-0*1$/);
  });

  it('allocates sequential ids on two consecutive emitIncident calls', () => {
    const root = buildRoot();
    const first = emitIncident(root, {
      title: 'First',
      violated: ['REQ-CRUX-010'],
      root_cause: 'First cause.',
    });
    const second = emitIncident(root, {
      title: 'Second',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Second cause.',
    });
    expect(first.id).not.toBe(second.id);
    // Both files exist
    expect(fs.existsSync(first.path)).toBe(true);
    expect(fs.existsSync(second.path)).toBe(true);
  });

  it('second id is numerically greater than the first', () => {
    const root = buildRoot();
    const first = emitIncident(root, {
      title: 'First',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
    });
    const second = emitIncident(root, {
      title: 'Second',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
    });
    const firstNum = parseInt(first.id.replace(/^INC-0*/, ''), 10);
    const secondNum = parseInt(second.id.replace(/^INC-0*/, ''), 10);
    expect(secondNum).toBeGreaterThan(firstNum);
  });

  it('three consecutive emits produce three distinct files', () => {
    const root = buildRoot();
    const ids = [
      emitIncident(root, { title: 'A', violated: [], root_cause: 'A' }).id,
      emitIncident(root, { title: 'B', violated: [], root_cause: 'B' }).id,
      emitIncident(root, { title: 'C', violated: [], root_cause: 'C' }).id,
    ];
    expect(new Set(ids).size).toBe(3);
    expect(listArtifacts(root, 'incidents')).toHaveLength(3);
  });
});

// ===========================================================================
// SECTION 3 — emitChange
// ===========================================================================

describe('emitChange — basic file creation', () => {
  it('returns an id starting with CHG-', () => {
    const root = buildRoot();
    const result = emitChange(root, {
      trigger_event: 'INC-001 triggered a review of REQ-CRUX-010.',
      classification: 'bug',
      affected_artifacts: ['REQ-CRUX-010'],
    });
    expect(result.id).toMatch(/^CHG-/);
  });

  it('writes the file to docs/sdlc/chg/', () => {
    const root = buildRoot();
    const result = emitChange(root, {
      trigger_event: 'INC-001 triggered this.',
      classification: 'bug',
      affected_artifacts: [],
    });
    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.path).toContain(path.join('docs', 'sdlc', 'chg'));
  });

  it('written file contains the CHG id', () => {
    const root = buildRoot();
    const result = emitChange(root, {
      trigger_event: 'Test event',
      classification: 'reqs_misaligned',
      affected_artifacts: ['ADR-CRUX-005'],
    });
    const content = fs.readFileSync(result.path, 'utf8');
    expect(content).toContain(result.id);
  });

  it('written file contains the trigger event text', () => {
    const root = buildRoot();
    const result = emitChange(root, {
      trigger_event: 'Unique trigger text XYZ-999',
      classification: 'bug',
      affected_artifacts: [],
    });
    const content = fs.readFileSync(result.path, 'utf8');
    expect(content).toContain('Unique trigger text XYZ-999');
  });

  it('allocates CHG-001 when chg/ is empty', () => {
    const root = buildRoot();
    const result = emitChange(root, {
      trigger_event: 'First change',
      classification: 'bug',
      affected_artifacts: [],
    });
    expect(result.id).toMatch(/^CHG-0*1$/);
  });

  it('two consecutive emitChange calls produce different ids', () => {
    const root = buildRoot();
    const first = emitChange(root, {
      trigger_event: 'First',
      classification: 'bug',
      affected_artifacts: [],
    });
    const second = emitChange(root, {
      trigger_event: 'Second',
      classification: 'new_scope',
      affected_artifacts: [],
    });
    expect(first.id).not.toBe(second.id);
    expect(listArtifacts(root, 'chg')).toHaveLength(2);
  });
});

// ===========================================================================
// SECTION 4 — emitAmendment
// ===========================================================================

describe('emitAmendment — basic file creation', () => {
  it('returns an id starting with AMD-', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'tdd-workflow',
      rule: 'Always run the full test suite before marking a task complete.',
      applies_when: 'Any code change is made.',
      severity: 'high',
    });
    expect(result.id).toMatch(/^AMD-/);
  });

  it('writes the file to docs/sdlc/amendments/', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'tdd-workflow',
      rule: 'Some rule.',
      applies_when: 'Always.',
      severity: 'medium',
    });
    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.path).toContain(path.join('docs', 'sdlc', 'amendments'));
  });

  it('written file contains the AMD id', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'tdd-workflow',
      rule: 'Check tests first.',
      applies_when: 'All tasks.',
      severity: 'low',
    });
    const content = fs.readFileSync(result.path, 'utf8');
    expect(content).toContain(result.id);
  });

  it('written file contains the target_skill', () => {
    const root = buildRoot({ skillName: 'code-review' });
    const result = emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'code-review',
      rule: 'Review all security-sensitive code paths.',
      applies_when: 'Auth-related changes.',
      severity: 'high',
    });
    const content = fs.readFileSync(result.path, 'utf8');
    expect(content).toContain('code-review');
  });

  it('allocates AMD-001 when amendments/ is empty', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'tdd-workflow',
      rule: 'Rule text.',
      applies_when: 'Always.',
      severity: 'medium',
    });
    expect(result.id).toMatch(/^AMD-0*1$/);
  });

  it('two consecutive emitAmendment calls produce different ids', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const first = emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'tdd-workflow',
      rule: 'Rule A.',
      applies_when: 'Case A.',
      severity: 'low',
    });
    const second = emitAmendment(root, {
      triggered_by: 'cross-pattern',
      target_skill: 'tdd-workflow',
      rule: 'Rule B.',
      applies_when: 'Case B.',
      severity: 'medium',
    });
    expect(first.id).not.toBe(second.id);
    expect(listArtifacts(root, 'amendments')).toHaveLength(2);
  });
});

// ===========================================================================
// SECTION 5 — emitAmendment MUST NOT touch SKILL.md (ADR-CRUX-005)
// ===========================================================================

describe('emitAmendment — SKILL.md byte integrity (ADR-CRUX-005)', () => {
  it('does not modify the SKILL.md byte content of the targeted skill', () => {
    const skillContent = `---
name: tdd-workflow
provides_capabilities:
  - testing.tdd-loop
  - quality.coverage-floor
---
# Test-Driven Development Workflow

This is the canonical skill body. It must NEVER be modified by an amendment.
`;
    const root = buildRoot({ skillName: 'tdd-workflow', skillContent });

    const skillPath = path.join(root, '.claude', 'skills', 'tdd-workflow', 'SKILL.md');
    const beforeBytes = fs.readFileSync(skillPath);
    const beforeHash = beforeBytes.toString('hex');

    emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'tdd-workflow',
      rule: 'New rule that must not mutate SKILL.md.',
      applies_when: 'Every invocation.',
      severity: 'high',
    });

    const afterBytes = fs.readFileSync(skillPath);
    const afterHash = afterBytes.toString('hex');

    expect(afterHash).toBe(beforeHash);
  });

  it('does not modify SKILL.md when emitAmendment targets a different skill', () => {
    const root = buildRoot({ skillName: 'code-review' });
    // Also place a tdd-workflow SKILL.md
    const tddSkillDir = path.join(root, '.claude', 'skills', 'tdd-workflow');
    fs.mkdirSync(tddSkillDir, { recursive: true });
    const tddContent = '# TDD skill — must remain untouched\n';
    fs.writeFileSync(path.join(tddSkillDir, 'SKILL.md'), tddContent, 'utf8');

    emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'code-review',
      rule: 'Rule for code-review.',
      applies_when: 'Always.',
      severity: 'low',
    });

    const afterContent = fs.readFileSync(path.join(tddSkillDir, 'SKILL.md'), 'utf8');
    expect(afterContent).toBe(tddContent);
  });

  it('amendment file is NOT written inside .claude/skills/', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = emitAmendment(root, {
      triggered_by: 'incident',
      target_skill: 'tdd-workflow',
      rule: 'Rule.',
      applies_when: 'Always.',
      severity: 'high',
    });
    expect(result.path).not.toContain('.claude');
    expect(result.path).not.toContain('skills');
  });
});

// ===========================================================================
// SECTION 6 — runCascade (REQ-CRUX-010 AC#1)
// ===========================================================================

describe('runCascade — produces INC + CHG + AMD (REQ-CRUX-010 AC#1)', () => {
  it('returns an object with incidentId, changeIds, and amendmentIds', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Coverage floor violated',
      violated: ['REQ-CRUX-010'],
      root_cause: 'CI skipped the test stage.',
      description: 'Tests were not run; tdd-workflow was bypassed.',
      target_skills: ['tdd-workflow'],
    });
    expect(typeof result.incidentId).toBe('string');
    expect(Array.isArray(result.changeIds)).toBe(true);
    expect(Array.isArray(result.amendmentIds)).toBe(true);
  });

  it('incidentId starts with INC-', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Test incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow was skipped.',
      target_skills: ['tdd-workflow'],
    });
    expect(result.incidentId).toMatch(/^INC-/);
  });

  it('produces at least one CHG when violated list is non-empty', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Gate failure',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow triggered issue.',
      target_skills: ['tdd-workflow'],
    });
    expect(result.changeIds.length).toBeGreaterThanOrEqual(1);
    result.changeIds.forEach((id) => expect(id).toMatch(/^CHG-/));
  });

  it('produces at least one AMD when target_skills matches a skill (REQ-CRUX-010 AC#1)', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'TDD loop broken',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Tests bypassed.',
      description: 'The tdd-workflow skill was not followed.',
      target_skills: ['tdd-workflow'],
    });
    expect(result.amendmentIds.length).toBeGreaterThanOrEqual(1);
    result.amendmentIds.forEach((id) => expect(id).toMatch(/^AMD-/));
  });

  it('INC file exists on disk after runCascade', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow issue.',
      target_skills: ['tdd-workflow'],
    });
    const incFiles = listArtifacts(root, 'incidents');
    expect(incFiles.length).toBeGreaterThanOrEqual(1);
    expect(incFiles.some((f) => f.includes(result.incidentId))).toBe(true);
  });

  it('CHG files exist on disk after runCascade', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow issue.',
      target_skills: ['tdd-workflow'],
    });
    const chgFiles = listArtifacts(root, 'chg');
    expect(chgFiles.length).toBeGreaterThanOrEqual(result.changeIds.length);
  });

  it('AMD files exist on disk after runCascade', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Incident',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow issue.',
      target_skills: ['tdd-workflow'],
    });
    const amdFiles = listArtifacts(root, 'amendments');
    expect(amdFiles.length).toBeGreaterThanOrEqual(result.amendmentIds.length);
  });
});

// ===========================================================================
// SECTION 7 — runCascade is synchronous / no daemon (REQ-CRUX-010 AC#2)
// ===========================================================================

describe('runCascade — synchronous, no background process (REQ-CRUX-010 AC#2)', () => {
  it('completes synchronously — files exist immediately after the call returns', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });

    // No await, no callback — purely synchronous
    runCascade(root, {
      title: 'Sync test',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow triggered.',
      target_skills: ['tdd-workflow'],
    });

    // Files must be readable immediately with no delay
    const incFiles = listArtifacts(root, 'incidents');
    const chgFiles = listArtifacts(root, 'chg');
    const amdFiles = listArtifacts(root, 'amendments');

    expect(incFiles.length).toBeGreaterThanOrEqual(1);
    expect(chgFiles.length).toBeGreaterThanOrEqual(1);
    expect(amdFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('does not return a Promise (is not async)', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Sync check',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow.',
      target_skills: ['tdd-workflow'],
    });
    // If runCascade returns a Promise this check would fail
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.incidentId).toBe('string');
  });
});

// ===========================================================================
// SECTION 8 — artifact linkage (derived_from / triggered_by)
// ===========================================================================

describe('cascade artifact linkage', () => {
  it('INC file references the violated artifact', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Linkage test',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow issue.',
      target_skills: ['tdd-workflow'],
    });
    const incPath = path.join(root, 'docs', 'sdlc', 'incidents', `${result.incidentId}.yaml`);
    const content = fs.readFileSync(incPath, 'utf8');
    expect(content).toContain('REQ-CRUX-010');
  });

  it('CHG file references the triggering INC id or event', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    const result = runCascade(root, {
      title: 'Linkage test',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow issue.',
      target_skills: ['tdd-workflow'],
    });

    const chgFiles = listArtifacts(root, 'chg');
    expect(chgFiles.length).toBeGreaterThanOrEqual(1);

    const firstChgPath = path.join(root, 'docs', 'sdlc', 'chg', chgFiles[0]!);
    const content = fs.readFileSync(firstChgPath, 'utf8');
    // CHG should reference the INC id or the violated REQ
    const mentionsInc = content.includes(result.incidentId);
    const mentionsReq = content.includes('REQ-CRUX-010');
    expect(mentionsInc || mentionsReq).toBe(true);
  });

  it('AMD file references the target_skill', () => {
    const root = buildRoot({ skillName: 'tdd-workflow' });
    runCascade(root, {
      title: 'AMD linkage test',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow issue.',
      target_skills: ['tdd-workflow'],
    });

    const amdFiles = listArtifacts(root, 'amendments');
    expect(amdFiles.length).toBeGreaterThanOrEqual(1);

    const firstAmdPath = path.join(root, 'docs', 'sdlc', 'amendments', amdFiles[0]!);
    const content = fs.readFileSync(firstAmdPath, 'utf8');
    expect(content).toContain('tdd-workflow');
  });
});

// ===========================================================================
// SECTION 9 — SKILL.md untouched across full cascade (ADR-CRUX-005)
// ===========================================================================

describe('runCascade — SKILL.md byte integrity (ADR-CRUX-005)', () => {
  it('does not mutate the targeted SKILL.md during a full cascade', () => {
    const skillContent = `---
name: tdd-workflow
provides_capabilities:
  - testing.tdd-loop
  - quality.coverage-floor
---
# TDD Workflow

This content must not change after a cascade run.
`;
    const root = buildRoot({ skillName: 'tdd-workflow', skillContent });
    const skillPath = path.join(root, '.claude', 'skills', 'tdd-workflow', 'SKILL.md');

    const beforeHash = fs.readFileSync(skillPath).toString('hex');

    runCascade(root, {
      title: 'Cascade integrity test',
      violated: ['REQ-CRUX-010'],
      root_cause: 'Cause.',
      description: 'tdd-workflow triggered.',
      target_skills: ['tdd-workflow'],
    });

    const afterHash = fs.readFileSync(skillPath).toString('hex');
    expect(afterHash).toBe(beforeHash);
  });
});
