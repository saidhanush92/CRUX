/**
 * registry.test.ts
 *
 * Locks the capability registry consumer contract for TASK-CRUX-006.
 *
 * These tests are intentionally RED until the coder creates:
 *   packages/core/src/capabilities/registry.ts
 * exporting: loadRegistry, hasCapability, validateSkillCapabilities,
 *            listGoverningGate, Registry, ValidationResult, RegistryNotFoundError
 *
 * Sources:
 *   - TASK-CRUX-006 (touches_files: packages/core/src/capabilities/**)
 *   - REQ-CRUX-010 (capability registry is queryable; skills' frontmatter validated)
 *   - ADR-CRUX-005 (amendment layering — registry underpins skill resolution)
 *   - capabilities/registry.v1.yaml (real fixture used in integration tests)
 *   - capabilities/local.yaml (optional per-project extensions)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  loadRegistry,
  hasCapability,
  validateSkillCapabilities,
  listGoverningGate,
  RegistryNotFoundError,
} from '../../src/capabilities/registry.js';

// ---------------------------------------------------------------------------
// Repo root (packages/core/test/capabilities → up 5 levels)
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// Temp dir per test
// ---------------------------------------------------------------------------

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-registry-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeCapabilitiesDir(
  opts: {
    registry?: string;
    local?: string;
  } = {},
): string {
  const capDir = path.join(tmpDir, 'capabilities');
  fs.mkdirSync(capDir, { recursive: true });

  if (opts.registry !== undefined) {
    fs.writeFileSync(path.join(capDir, 'registry.v1.yaml'), opts.registry, 'utf8');
  }

  if (opts.local !== undefined) {
    fs.writeFileSync(path.join(capDir, 'local.yaml'), opts.local, 'utf8');
  }

  return tmpDir;
}

const MINIMAL_REGISTRY_YAML = `
version: 1.0.0
namespaces:
  - testing
  - quality

capabilities:
  - id: testing.tdd-loop
    description: Drive development by writing failing tests first.
    governs_gate: 7
  - id: quality.coverage-floor
    description: Enforce a minimum coverage threshold.
    governs_gate: 7
  - id: testing.unit
    description: Write isolated unit tests.
    governs_gate: 7
`.trimStart();

const MINIMAL_LOCAL_YAML = `
version: 0.1.0
capabilities:
  - id: local.project-specific
    description: A project-specific capability.
`.trimStart();

// ===========================================================================
// SECTION 1 — Export shape
// ===========================================================================

describe('loadRegistry export shape', () => {
  it('is a callable function', () => {
    expect(typeof loadRegistry).toBe('function');
  });

  it('hasCapability is a callable function', () => {
    expect(typeof hasCapability).toBe('function');
  });

  it('validateSkillCapabilities is a callable function', () => {
    expect(typeof validateSkillCapabilities).toBe('function');
  });

  it('listGoverningGate is a callable function', () => {
    expect(typeof listGoverningGate).toBe('function');
  });

  it('RegistryNotFoundError is a constructor/class', () => {
    expect(typeof RegistryNotFoundError).toBe('function');
  });
});

// ===========================================================================
// SECTION 2 — loadRegistry happy path (synthetic fixtures)
// ===========================================================================

describe('loadRegistry — happy path with synthetic registry', () => {
  it('returns a Registry object with a version field', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(typeof registry.version).toBe('string');
    expect(registry.version).toBe('1.0.0');
  });

  it('returns a Registry object with a namespaces field', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(typeof registry.namespaces).toBe('object');
    expect(registry.namespaces).not.toBeNull();
  });

  it('has a testing namespace after loading', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(registry.namespaces['testing']).toBeDefined();
  });

  it('has testing.tdd-loop capability entry under testing namespace', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const testingNs = registry.namespaces['testing'];
    expect(testingNs).toBeDefined();
    expect(testingNs!['tdd-loop']).toBeDefined();
  });

  it('capability entry has a description', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const entry = registry.namespaces['testing']!['tdd-loop'];
    expect(typeof entry!.description).toBe('string');
    expect(entry!.description.length).toBeGreaterThan(0);
  });

  it('capability entry has governs_gate as a number', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const entry = registry.namespaces['testing']!['tdd-loop'];
    expect(typeof entry!.governs_gate).toBe('number');
    expect(entry!.governs_gate).toBe(7);
  });
});

// ===========================================================================
// SECTION 3 — loadRegistry with local.yaml
// ===========================================================================

describe('loadRegistry — local.yaml merge', () => {
  it('succeeds when local.yaml is absent (no local namespace)', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    // local namespace must be absent
    expect(registry.namespaces['local']).toBeUndefined();
  });

  it('adds local namespace when local.yaml is present', () => {
    const root = writeCapabilitiesDir({
      registry: MINIMAL_REGISTRY_YAML,
      local: MINIMAL_LOCAL_YAML,
    });
    const registry = loadRegistry(root);
    expect(registry.namespaces['local']).toBeDefined();
  });

  it('local capability is accessible via local namespace', () => {
    const root = writeCapabilitiesDir({
      registry: MINIMAL_REGISTRY_YAML,
      local: MINIMAL_LOCAL_YAML,
    });
    const registry = loadRegistry(root);
    const localNs = registry.namespaces['local'];
    expect(localNs).toBeDefined();
    expect(localNs!['project-specific']).toBeDefined();
  });

  it('local capabilities do not pollute registry namespaces', () => {
    const root = writeCapabilitiesDir({
      registry: MINIMAL_REGISTRY_YAML,
      local: MINIMAL_LOCAL_YAML,
    });
    const registry = loadRegistry(root);
    // Testing namespace must not contain local capabilities
    const testingNs = registry.namespaces['testing'];
    expect(testingNs!['project-specific']).toBeUndefined();
  });
});

// ===========================================================================
// SECTION 4 — loadRegistry against real registry.v1.yaml
// ===========================================================================

describe('loadRegistry — real capabilities/registry.v1.yaml', () => {
  it('loads the real registry without throwing', () => {
    expect(() => loadRegistry(REPO_ROOT)).not.toThrow();
  });

  it('returns version 1.0.0 from the real registry', () => {
    const registry = loadRegistry(REPO_ROOT);
    expect(registry.version).toBe('1.0.0');
  });

  it('has testing.tdd-loop in the real registry', () => {
    const registry = loadRegistry(REPO_ROOT);
    expect(registry.namespaces['testing']?.['tdd-loop']).toBeDefined();
  });

  it('has quality.coverage-floor in the real registry', () => {
    const registry = loadRegistry(REPO_ROOT);
    expect(registry.namespaces['quality']?.['coverage-floor']).toBeDefined();
  });

  it('has process.adr-authoring in the real registry', () => {
    const registry = loadRegistry(REPO_ROOT);
    expect(registry.namespaces['process']?.['adr-authoring']).toBeDefined();
  });

  it('has language.typescript in the real registry', () => {
    const registry = loadRegistry(REPO_ROOT);
    expect(registry.namespaces['language']?.['typescript']).toBeDefined();
  });
});

// ===========================================================================
// SECTION 5 — loadRegistry error paths
// ===========================================================================

describe('loadRegistry — error paths', () => {
  it('throws RegistryNotFoundError when registry.v1.yaml is absent', () => {
    const emptyRoot = writeCapabilitiesDir(); // no registry written
    expect(() => loadRegistry(emptyRoot)).toThrow(RegistryNotFoundError);
  });

  it('RegistryNotFoundError is instanceof Error', () => {
    const emptyRoot = writeCapabilitiesDir();
    let caught: unknown;
    try {
      loadRegistry(emptyRoot);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(RegistryNotFoundError);
  });

  it('throws an error with the file path in the message when registry is missing', () => {
    const emptyRoot = writeCapabilitiesDir();
    let caught: unknown;
    try {
      loadRegistry(emptyRoot);
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toContain('registry.v1.yaml');
  });

  it('throws when registry YAML is malformed', () => {
    const root = writeCapabilitiesDir({
      registry: ': this is not: valid: yaml mapping\n  -broken',
    });
    expect(() => loadRegistry(root)).toThrow();
  });

  it('error message from malformed YAML includes the file path', () => {
    const root = writeCapabilitiesDir({
      registry: ': broken\n  -broken',
    });
    let caught: unknown;
    try {
      loadRegistry(root);
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toMatch(/registry\.v1\.yaml/);
  });

  it('throws when a namespace contains duplicate capability ids', () => {
    const duplicateRegistryYaml = `
version: 1.0.0
namespaces:
  - testing

capabilities:
  - id: testing.tdd-loop
    description: First entry.
    governs_gate: 7
  - id: testing.tdd-loop
    description: Duplicate entry — should throw.
    governs_gate: 7
`.trimStart();

    const root = writeCapabilitiesDir({ registry: duplicateRegistryYaml });
    expect(() => loadRegistry(root)).toThrow();
  });
});

// ===========================================================================
// SECTION 6 — hasCapability
// ===========================================================================

describe('hasCapability', () => {
  it('returns true for a capability that exists in the registry', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(hasCapability(registry, 'testing.tdd-loop')).toBe(true);
  });

  it('returns true for quality.coverage-floor', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(hasCapability(registry, 'quality.coverage-floor')).toBe(true);
  });

  it('returns false for a capability that does not exist', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(hasCapability(registry, 'testing.nonexistent')).toBe(false);
  });

  it('returns false for a namespace that does not exist', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(hasCapability(registry, 'nosuchnamespace.something')).toBe(false);
  });

  it('returns false for an id without a dot separator', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(hasCapability(registry, 'testing')).toBe(false);
  });

  it('returns true for a local capability when local.yaml was loaded', () => {
    const root = writeCapabilitiesDir({
      registry: MINIMAL_REGISTRY_YAML,
      local: MINIMAL_LOCAL_YAML,
    });
    const registry = loadRegistry(root);
    expect(hasCapability(registry, 'local.project-specific')).toBe(true);
  });

  it('returns false for local capability when local.yaml was not loaded', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    expect(hasCapability(registry, 'local.project-specific')).toBe(false);
  });

  it('works against the real registry for testing.tdd-loop', () => {
    const registry = loadRegistry(REPO_ROOT);
    expect(hasCapability(registry, 'testing.tdd-loop')).toBe(true);
  });

  it('works against the real registry for quality.coverage-floor', () => {
    const registry = loadRegistry(REPO_ROOT);
    expect(hasCapability(registry, 'quality.coverage-floor')).toBe(true);
  });
});

// ===========================================================================
// SECTION 7 — validateSkillCapabilities
// ===========================================================================

describe('validateSkillCapabilities', () => {
  it('returns valid: true when all declared capabilities exist in registry', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const result = validateSkillCapabilities(
      { provides_capabilities: ['testing.tdd-loop', 'quality.coverage-floor'] },
      registry,
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns valid: false when a declared capability is missing from registry', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const result = validateSkillCapabilities(
      { provides_capabilities: ['testing.tdd-loop', 'testing.phantom-cap'] },
      registry,
    );
    expect(result.valid).toBe(false);
  });

  it('populates missing array with ids absent from registry', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const result = validateSkillCapabilities(
      { provides_capabilities: ['testing.tdd-loop', 'testing.ghost', 'process.unknown'] },
      registry,
    );
    expect(result.missing).toContain('testing.ghost');
    expect(result.missing).toContain('process.unknown');
    expect(result.missing).not.toContain('testing.tdd-loop');
  });

  it('returns valid: true when provides_capabilities is empty', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const result = validateSkillCapabilities({ provides_capabilities: [] }, registry);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns valid: true when provides_capabilities is undefined', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const result = validateSkillCapabilities({}, registry);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('validates real tdd-workflow skill frontmatter against real registry', () => {
    // The actual tdd-workflow SKILL.md declares testing.tdd-loop and quality.coverage-floor
    const registry = loadRegistry(REPO_ROOT);
    const result = validateSkillCapabilities(
      {
        provides_capabilities: ['testing.tdd-loop', 'quality.coverage-floor'],
      },
      registry,
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns missing list for a skill claiming a capability not in real registry', () => {
    const registry = loadRegistry(REPO_ROOT);
    const result = validateSkillCapabilities(
      {
        provides_capabilities: ['testing.tdd-loop', 'testing.does-not-exist-v99'],
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('testing.does-not-exist-v99');
  });
});

// ===========================================================================
// SECTION 8 — listGoverningGate
// ===========================================================================

describe('listGoverningGate', () => {
  it('returns capability ids that govern the given gate number', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const ids = listGoverningGate(registry, 7);
    expect(ids).toContain('testing.tdd-loop');
    expect(ids).toContain('quality.coverage-floor');
    expect(ids).toContain('testing.unit');
  });

  it('returns empty array when no capability governs the requested gate', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    // Gate 99 does not exist in the minimal fixture
    const ids = listGoverningGate(registry, 99);
    expect(ids).toHaveLength(0);
  });

  it('does not include capabilities from a different gate', () => {
    const registryYaml = `
version: 1.0.0
namespaces:
  - testing
  - ops

capabilities:
  - id: testing.tdd-loop
    description: TDD.
    governs_gate: 7
  - id: ops.github-actions
    description: CI.
    governs_gate: 5
`.trimStart();
    const root = writeCapabilitiesDir({ registry: registryYaml });
    const registry = loadRegistry(root);

    const gate7 = listGoverningGate(registry, 7);
    expect(gate7).toContain('testing.tdd-loop');
    expect(gate7).not.toContain('ops.github-actions');

    const gate5 = listGoverningGate(registry, 5);
    expect(gate5).toContain('ops.github-actions');
    expect(gate5).not.toContain('testing.tdd-loop');
  });

  it('returns ids in namespace.capability format', () => {
    const root = writeCapabilitiesDir({ registry: MINIMAL_REGISTRY_YAML });
    const registry = loadRegistry(root);
    const ids = listGoverningGate(registry, 7);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });

  it('works against the real registry for gate 7', () => {
    const registry = loadRegistry(REPO_ROOT);
    const ids = listGoverningGate(registry, 7);
    expect(ids).toContain('testing.tdd-loop');
    expect(ids).toContain('quality.coverage-floor');
    expect(Array.isArray(ids)).toBe(true);
  });

  it('works against the real registry for gate 5', () => {
    const registry = loadRegistry(REPO_ROOT);
    const ids = listGoverningGate(registry, 5);
    expect(ids).toContain('language.typescript');
    expect(ids).toContain('framework.vitest');
  });
});
