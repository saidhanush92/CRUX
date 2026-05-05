/**
 * interface.test.ts
 *
 * Locks the contract declared in ADR-CRUX-003:
 *   - 17 functions
 *   - 7 concern groups with exact membership
 *   - No duplicates, no extras
 *   - ADAPTER_INTERFACE_MANIFEST and ADAPTER_CONCERN_GROUPS are exported
 *
 * These tests are intentionally RED until the coder creates
 *   packages/core/src/adapter/interface.ts
 * exporting ADAPTER_INTERFACE_MANIFEST and ADAPTER_CONCERN_GROUPS.
 */

import { describe, it, expect } from 'vitest';
import { ADAPTER_INTERFACE_MANIFEST, ADAPTER_CONCERN_GROUPS } from '../../src/adapter/interface.js';

// ---------------------------------------------------------------------------
// Canonical data sourced directly from ADR-CRUX-003
// ---------------------------------------------------------------------------

const CANONICAL_GROUPS = {
  Lifecycle: ['session_start', 'session_end', 'capabilities_supported'] as const,
  Subagents: ['spawn_subagent', 'await_subagent'] as const,
  Skills: ['install_skill', 'uninstall_skill', 'list_skills'] as const,
  Hooks: ['install_hook', 'list_hooks'] as const,
  SlashCommands: ['run_command'] as const,
  FilesystemShell: ['read_file', 'write_file', 'run_shell'] as const,
  TraceCapability: ['emit_event', 'resolve_capability', 'invoke_skill'] as const,
} as const satisfies Record<string, readonly string[]>;

const CANONICAL_GROUP_NAMES = Object.keys(CANONICAL_GROUPS) as Array<keyof typeof CANONICAL_GROUPS>;

const CANONICAL_ALL_FNS: string[] = CANONICAL_GROUP_NAMES.flatMap((g) => [...CANONICAL_GROUPS[g]]);

// ---------------------------------------------------------------------------
// Helper: flatten all function names from a manifest
// ---------------------------------------------------------------------------

function allFnsInManifest(manifest: Record<string, readonly string[]>): string[] {
  return Object.values(manifest).flatMap((arr) => [...arr]);
}

// ---------------------------------------------------------------------------
// ADAPTER_INTERFACE_MANIFEST shape tests
// ---------------------------------------------------------------------------

describe('ADAPTER_INTERFACE_MANIFEST export', () => {
  it('is exported from the adapter interface module as a non-null object', () => {
    expect(ADAPTER_INTERFACE_MANIFEST).toBeDefined();
    expect(typeof ADAPTER_INTERFACE_MANIFEST).toBe('object');
    expect(ADAPTER_INTERFACE_MANIFEST).not.toBeNull();
  });

  it('is a Record<string, readonly string[]> — each value is an array', () => {
    for (const [group, fns] of Object.entries(ADAPTER_INTERFACE_MANIFEST)) {
      expect(Array.isArray(fns), `group "${group}" value must be an array`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Concern-group count tests (REQ-CRUX-005 AC#1 prerequisite)
// ---------------------------------------------------------------------------

describe('concern groups — count and names', () => {
  it('contains exactly 7 concern-group keys', () => {
    const keys = Object.keys(ADAPTER_INTERFACE_MANIFEST);
    expect(keys).toHaveLength(7);
  });

  it('concern-group names match ADR-CRUX-003 exactly (Lifecycle, Subagents, Skills, Hooks, SlashCommands, FilesystemShell, TraceCapability)', () => {
    const actualKeys = Object.keys(ADAPTER_INTERFACE_MANIFEST).sort();
    const expectedKeys = [...CANONICAL_GROUP_NAMES].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });
});

// ---------------------------------------------------------------------------
// Per-group membership tests (REQ-CRUX-005 AC#2 and AC#3)
// ---------------------------------------------------------------------------

describe('Lifecycle group', () => {
  it('contains exactly 3 functions', () => {
    expect(ADAPTER_INTERFACE_MANIFEST['Lifecycle']).toHaveLength(3);
  });

  it('contains session_start, session_end, capabilities_supported — in any order', () => {
    const members = [...(ADAPTER_INTERFACE_MANIFEST['Lifecycle'] ?? [])].sort();
    expect(members).toEqual([...CANONICAL_GROUPS.Lifecycle].sort());
  });
});

describe('Subagents group', () => {
  it('contains exactly 2 functions', () => {
    expect(ADAPTER_INTERFACE_MANIFEST['Subagents']).toHaveLength(2);
  });

  it('contains spawn_subagent, await_subagent — in any order', () => {
    const members = [...(ADAPTER_INTERFACE_MANIFEST['Subagents'] ?? [])].sort();
    expect(members).toEqual([...CANONICAL_GROUPS.Subagents].sort());
  });
});

describe('Skills group', () => {
  it('contains exactly 3 functions', () => {
    expect(ADAPTER_INTERFACE_MANIFEST['Skills']).toHaveLength(3);
  });

  it('contains install_skill, uninstall_skill, list_skills — in any order', () => {
    const members = [...(ADAPTER_INTERFACE_MANIFEST['Skills'] ?? [])].sort();
    expect(members).toEqual([...CANONICAL_GROUPS.Skills].sort());
  });
});

describe('Hooks group', () => {
  it('contains exactly 2 functions', () => {
    expect(ADAPTER_INTERFACE_MANIFEST['Hooks']).toHaveLength(2);
  });

  it('contains install_hook, list_hooks — in any order', () => {
    const members = [...(ADAPTER_INTERFACE_MANIFEST['Hooks'] ?? [])].sort();
    expect(members).toEqual([...CANONICAL_GROUPS.Hooks].sort());
  });
});

describe('SlashCommands group', () => {
  it('contains exactly 1 function', () => {
    expect(ADAPTER_INTERFACE_MANIFEST['SlashCommands']).toHaveLength(1);
  });

  it('contains run_command', () => {
    const members = [...(ADAPTER_INTERFACE_MANIFEST['SlashCommands'] ?? [])];
    expect(members).toEqual([...CANONICAL_GROUPS.SlashCommands]);
  });
});

describe('FilesystemShell group', () => {
  it('contains exactly 3 functions', () => {
    expect(ADAPTER_INTERFACE_MANIFEST['FilesystemShell']).toHaveLength(3);
  });

  it('contains read_file, write_file, run_shell — in any order', () => {
    const members = [...(ADAPTER_INTERFACE_MANIFEST['FilesystemShell'] ?? [])].sort();
    expect(members).toEqual([...CANONICAL_GROUPS.FilesystemShell].sort());
  });
});

describe('TraceCapability group', () => {
  it('contains exactly 3 functions', () => {
    expect(ADAPTER_INTERFACE_MANIFEST['TraceCapability']).toHaveLength(3);
  });

  it('contains emit_event, resolve_capability, invoke_skill — in any order', () => {
    const members = [...(ADAPTER_INTERFACE_MANIFEST['TraceCapability'] ?? [])].sort();
    expect(members).toEqual([...CANONICAL_GROUPS.TraceCapability].sort());
  });
});

// ---------------------------------------------------------------------------
// Total function-count tests (REQ-CRUX-005 AC#1)
// ---------------------------------------------------------------------------

describe('total function count across all groups', () => {
  it('is exactly 17 — the count committed in ADR-CRUX-003 for v1.0', () => {
    const total = allFnsInManifest(ADAPTER_INTERFACE_MANIFEST).length;
    expect(total).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// Uniqueness / no-extra-functions tests (REQ-CRUX-005 AC#2)
// ---------------------------------------------------------------------------

describe('function name uniqueness', () => {
  it('no function name appears in more than one concern group', () => {
    const all = allFnsInManifest(ADAPTER_INTERFACE_MANIFEST);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const fn of all) {
      if (seen.has(fn)) duplicates.push(fn);
      seen.add(fn);
    }
    expect(duplicates).toEqual([]);
  });

  it('no function name is duplicated within the same concern group', () => {
    for (const [group, fns] of Object.entries(ADAPTER_INTERFACE_MANIFEST)) {
      const set = new Set(fns);
      expect(set.size, `group "${group}" has duplicate function names`).toBe(fns.length);
    }
  });
});

describe('canonical function names — completeness and no extras', () => {
  it('all 17 ADR-CRUX-003 canonical function names are present in the manifest', () => {
    const allInManifest = new Set(allFnsInManifest(ADAPTER_INTERFACE_MANIFEST));
    for (const fn of CANONICAL_ALL_FNS) {
      expect(allInManifest.has(fn), `canonical function "${fn}" is missing from the manifest`).toBe(
        true,
      );
    }
  });

  it('no extra function names beyond the 17 ADR-canonical ones appear in any group', () => {
    const canonicalSet = new Set(CANONICAL_ALL_FNS);
    const extras = allFnsInManifest(ADAPTER_INTERFACE_MANIFEST).filter(
      (fn) => !canonicalSet.has(fn),
    );
    expect(extras).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ADAPTER_CONCERN_GROUPS export tests
// ---------------------------------------------------------------------------

describe('ADAPTER_CONCERN_GROUPS export', () => {
  it('is exported from the adapter interface module', () => {
    expect(ADAPTER_CONCERN_GROUPS).toBeDefined();
  });

  it('is an array', () => {
    expect(Array.isArray(ADAPTER_CONCERN_GROUPS)).toBe(true);
  });

  it('contains exactly 7 entries', () => {
    expect(ADAPTER_CONCERN_GROUPS).toHaveLength(7);
  });

  it('contains all 7 group names from ADR-CRUX-003', () => {
    const sorted = [...ADAPTER_CONCERN_GROUPS].sort();
    const expected = [...CANONICAL_GROUP_NAMES].sort();
    expect(sorted).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Concern-group expansion guard (REQ-CRUX-005 AC#3 meta-test)
// Verifies that ADAPTER_INTERFACE_MANIFEST is the single source of truth:
// every group's locked count is asserted, so silently expanding a group
// breaks this test suite deterministically.
// ---------------------------------------------------------------------------

describe('concern-group expansion guard (REQ-CRUX-005 AC#3)', () => {
  it('each group count matches its ADR-CRUX-003 locked value — expanding any group breaks this test', () => {
    const lockedCounts: Record<string, number> = {
      Lifecycle: 3,
      Subagents: 2,
      Skills: 3,
      Hooks: 2,
      SlashCommands: 1,
      FilesystemShell: 3,
      TraceCapability: 3,
    };

    for (const [group, expectedCount] of Object.entries(lockedCounts)) {
      const actual = ADAPTER_INTERFACE_MANIFEST[group]?.length ?? -1;
      expect(
        actual,
        `concern group "${group}" count must be locked at ${expectedCount}; got ${actual} — expanding a group silently is forbidden (REQ-CRUX-005 AC#3)`,
      ).toBe(expectedCount);
    }
  });

  it('total locked count sums to exactly 17 — any group expansion breaks the headline total', () => {
    const lockedTotal = Object.values(ADAPTER_INTERFACE_MANIFEST).reduce(
      (sum, fns) => sum + fns.length,
      0,
    );
    expect(lockedTotal).toBe(17);
  });
});
