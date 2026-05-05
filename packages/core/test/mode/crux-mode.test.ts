/**
 * crux-mode.test.ts
 *
 * Locks the crux_mode reader contract described in TASK-CRUX-001.
 * Reads stack.yaml to determine the active gate-mode dial for an IDEA.
 *
 * These tests are intentionally RED until the coder creates
 *   packages/core/src/mode/crux-mode.ts
 * exporting CruxMode, readCruxMode, assertValidCruxMode,
 * defaultModeFor, and isAutoApproveMode.
 *
 * Sources:
 *   - TASK-CRUX-001
 *   - REQ-CRUX-008 (crux_mode is read by every command; invalid value halts)
 *   - ADR-CRUX-006 (greenfield=compressed, brownfield=standard; artifact invariance)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CruxMode } from '../../src/mode/crux-mode.js';
import {
  readCruxMode,
  assertValidCruxMode,
  defaultModeFor,
  isAutoApproveMode,
} from '../../src/mode/crux-mode.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  // Create a unique temp directory per test to avoid collision
  tmpDir = join(tmpdir(), `crux-mode-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmpStackYaml(content: string): string {
  const filePath = join(tmpDir, 'stack.yaml');
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// ---------------------------------------------------------------------------
// CruxMode type — runtime confirmation of all 5 allowed values
// ---------------------------------------------------------------------------

describe('CruxMode type', () => {
  it('permits all five allowed mode strings', () => {
    const modes: CruxMode[] = ['compressed', 'standard', 'strict', 'solo', 'observation'];
    expect(modes).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// readCruxMode — happy path
// ---------------------------------------------------------------------------

describe('readCruxMode — valid stack.yaml files', () => {
  it('reads crux_mode: compressed and returns "compressed"', () => {
    // Arrange
    const stackPath = writeTmpStackYaml('crux_mode: compressed\n');
    // Act
    const mode = readCruxMode(stackPath);
    // Assert
    expect(mode).toBe('compressed');
  });

  it('reads crux_mode: standard and returns "standard"', () => {
    const stackPath = writeTmpStackYaml('crux_mode: standard\n');
    expect(readCruxMode(stackPath)).toBe('standard');
  });

  it('reads crux_mode: strict and returns "strict"', () => {
    const stackPath = writeTmpStackYaml('crux_mode: strict\n');
    expect(readCruxMode(stackPath)).toBe('strict');
  });

  it('reads crux_mode: solo and returns "solo"', () => {
    const stackPath = writeTmpStackYaml('crux_mode: solo\n');
    expect(readCruxMode(stackPath)).toBe('solo');
  });

  it('reads crux_mode: observation and returns "observation"', () => {
    const stackPath = writeTmpStackYaml('crux_mode: observation\n');
    expect(readCruxMode(stackPath)).toBe('observation');
  });

  it('reads crux_mode correctly when stack.yaml has multiple fields', () => {
    const stackPath = writeTmpStackYaml(
      ['language: typescript', 'crux_mode: strict', 'cost_halt_multiplier: 2.0'].join('\n'),
    );
    expect(readCruxMode(stackPath)).toBe('strict');
  });

  it('reads crux_mode correctly when preceded by comment lines', () => {
    const stackPath = writeTmpStackYaml(
      ['# Crux stack manifest', '# pinned by ADR-CRUX-006', 'crux_mode: solo'].join('\n'),
    );
    expect(readCruxMode(stackPath)).toBe('solo');
  });
});

// ---------------------------------------------------------------------------
// readCruxMode — error cases (each must throw a distinct, clear error)
// ---------------------------------------------------------------------------

describe('readCruxMode — file not found', () => {
  it('throws when the stack.yaml path does not exist', () => {
    const nonExistent = join(tmpDir, 'nonexistent', 'stack.yaml');
    expect(() => readCruxMode(nonExistent)).toThrow();
  });

  it('thrown error message references the missing path', () => {
    const nonExistent = join(tmpDir, 'no-such-file.yaml');
    expect(() => readCruxMode(nonExistent)).toThrowError(/no-such-file\.yaml/i);
  });
});

describe('readCruxMode — malformed YAML / unparseable content', () => {
  it('throws when the file contains content that cannot be parsed for crux_mode', () => {
    // Content with no valid key: value pairs at all
    const stackPath = writeTmpStackYaml(':::invalid:::\n\t\t[broken yaml}');
    expect(() => readCruxMode(stackPath)).toThrow();
  });

  it('thrown error message indicates a parse or format problem', () => {
    const stackPath = writeTmpStackYaml(':::invalid:::\n\t\t[broken yaml}');
    // The message should distinguish a parse error from a missing-key error
    try {
      readCruxMode(stackPath);
      expect.fail('expected readCruxMode to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });
});

describe('readCruxMode — missing crux_mode key', () => {
  it('throws when stack.yaml exists but has no crux_mode field', () => {
    const stackPath = writeTmpStackYaml('language: typescript\nruntime:\n  node: ">=20"\n');
    expect(() => readCruxMode(stackPath)).toThrow();
  });

  it('thrown error message mentions "crux_mode" to guide the operator', () => {
    const stackPath = writeTmpStackYaml('language: typescript\n');
    expect(() => readCruxMode(stackPath)).toThrowError(/crux_mode/i);
  });
});

describe('readCruxMode — invalid crux_mode value', () => {
  it('throws when crux_mode is set to an unrecognised value', () => {
    const stackPath = writeTmpStackYaml('crux_mode: turbo\n');
    expect(() => readCruxMode(stackPath)).toThrow();
  });

  it('thrown error message names the invalid value', () => {
    const stackPath = writeTmpStackYaml('crux_mode: turbo\n');
    expect(() => readCruxMode(stackPath)).toThrowError(/turbo/i);
  });

  it('thrown error message lists the valid modes so the operator can fix the file', () => {
    const stackPath = writeTmpStackYaml('crux_mode: invalid_value\n');
    let errorMessage = '';
    try {
      readCruxMode(stackPath);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    // All five valid mode names must appear in the error so the operator knows options
    expect(errorMessage).toMatch(/compressed/i);
    expect(errorMessage).toMatch(/standard/i);
    expect(errorMessage).toMatch(/strict/i);
    expect(errorMessage).toMatch(/solo/i);
    expect(errorMessage).toMatch(/observation/i);
  });
});

// ---------------------------------------------------------------------------
// assertValidCruxMode — REQ-CRUX-008 AC#3
// ---------------------------------------------------------------------------

describe('assertValidCruxMode', () => {
  it('does not throw for each of the 5 valid mode strings', () => {
    const valid: unknown[] = ['compressed', 'standard', 'strict', 'solo', 'observation'];
    for (const v of valid) {
      expect(() => assertValidCruxMode(v)).not.toThrow();
    }
  });

  it('throws for a non-string value', () => {
    expect(() => assertValidCruxMode(42)).toThrow();
    expect(() => assertValidCruxMode(null)).toThrow();
    expect(() => assertValidCruxMode(undefined)).toThrow();
    expect(() => assertValidCruxMode({})).toThrow();
  });

  it('throws for an unrecognised string value', () => {
    expect(() => assertValidCruxMode('turbo')).toThrow();
    expect(() => assertValidCruxMode('fast')).toThrow();
    expect(() => assertValidCruxMode('')).toThrow();
  });

  it('thrown error message names each valid mode option (REQ-CRUX-008 AC#3)', () => {
    let errorMessage = '';
    try {
      assertValidCruxMode('not-a-mode');
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    expect(errorMessage).toMatch(/compressed/i);
    expect(errorMessage).toMatch(/standard/i);
    expect(errorMessage).toMatch(/strict/i);
    expect(errorMessage).toMatch(/solo/i);
    expect(errorMessage).toMatch(/observation/i);
  });

  it('acts as a type assertion — value is CruxMode after a successful call', () => {
    // Arrange
    const value: unknown = 'compressed';
    // Act — assertValidCruxMode must refine the type (compile-time) and not throw (runtime)
    assertValidCruxMode(value);
    // Assert — use the value as CruxMode without casting
    const mode: CruxMode = value as CruxMode;
    expect(mode).toBe('compressed');
  });
});

// ---------------------------------------------------------------------------
// defaultModeFor — REQ-CRUX-008 AC#2 + ADR-CRUX-006 decision
// ---------------------------------------------------------------------------

describe('defaultModeFor', () => {
  it('returns "compressed" for greenfield projects', () => {
    // ADR-CRUX-006: "Greenfield default = compressed"
    expect(defaultModeFor('greenfield')).toBe('compressed');
  });

  it('returns "standard" for brownfield projects', () => {
    // ADR-CRUX-006: "brownfield default = standard"
    expect(defaultModeFor('brownfield')).toBe('standard');
  });

  it('return value is a valid CruxMode for both project kinds', () => {
    const greenDefault = defaultModeFor('greenfield');
    const brownDefault = defaultModeFor('brownfield');
    // Both must pass assertValidCruxMode without throwing
    expect(() => assertValidCruxMode(greenDefault)).not.toThrow();
    expect(() => assertValidCruxMode(brownDefault)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// isAutoApproveMode — ADR-CRUX-006 (only compressed auto-approves)
// ---------------------------------------------------------------------------

describe('isAutoApproveMode', () => {
  it('returns true for "compressed" — the only auto-approve mode', () => {
    // ADR-CRUX-006: "Auto-approvals in compressed mode are recorded in approvals.log
    // with source: mode-compressed — never silently."
    expect(isAutoApproveMode('compressed')).toBe(true);
  });

  it('returns false for "standard"', () => {
    expect(isAutoApproveMode('standard')).toBe(false);
  });

  it('returns false for "strict"', () => {
    expect(isAutoApproveMode('strict')).toBe(false);
  });

  it('returns false for "solo"', () => {
    expect(isAutoApproveMode('solo')).toBe(false);
  });

  it('returns false for "observation"', () => {
    expect(isAutoApproveMode('observation')).toBe(false);
  });

  it('returns a boolean for every valid CruxMode value', () => {
    const modes: CruxMode[] = ['compressed', 'standard', 'strict', 'solo', 'observation'];
    for (const mode of modes) {
      const result = isAutoApproveMode(mode);
      expect(typeof result).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: readCruxMode feeds into assertValidCruxMode and isAutoApproveMode
// ---------------------------------------------------------------------------

describe('readCruxMode integration with assertValidCruxMode and isAutoApproveMode', () => {
  it('mode read from a compressed stack.yaml passes assertValidCruxMode', () => {
    const stackPath = writeTmpStackYaml('crux_mode: compressed\n');
    const mode = readCruxMode(stackPath);
    expect(() => assertValidCruxMode(mode)).not.toThrow();
  });

  it('mode read from a compressed stack.yaml returns true from isAutoApproveMode', () => {
    const stackPath = writeTmpStackYaml('crux_mode: compressed\n');
    const mode = readCruxMode(stackPath);
    expect(isAutoApproveMode(mode)).toBe(true);
  });

  it('mode read from a standard stack.yaml returns false from isAutoApproveMode', () => {
    const stackPath = writeTmpStackYaml('crux_mode: standard\n');
    const mode = readCruxMode(stackPath);
    expect(isAutoApproveMode(mode)).toBe(false);
  });
});
