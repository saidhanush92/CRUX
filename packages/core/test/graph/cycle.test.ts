/**
 * cycle.test.ts
 *
 * Locks the detectCycles contract described in TASK-CRUX-004.
 *
 * The function must:
 *   - Accept modules: { id: string; depends_on: string[] }[].
 *   - Return { hasCycle: false } for acyclic graphs.
 *   - Return { hasCycle: true; cycles: string[][] } for graphs with cycles,
 *     where each cycle is an ordered list of ids closing the loop.
 *   - Detect multiple disjoint cycles.
 *   - Detect self-loops.
 *   - Report edges to non-existent modules as unknownTargets (not cycles).
 *   - Never mutate input modules.
 *   - Produce deterministic (sorted) output.
 *
 * Sources:
 *   - TASK-CRUX-004 (touches_files: packages/core/src/graph/cycle.ts)
 *   - REQ-CRUX-021 (cycle detection; no auto-break; non-zero exit on cycle)
 *
 * These tests are intentionally RED until the coder creates:
 *   packages/core/src/graph/cycle.ts
 */

import { describe, it, expect } from 'vitest';
import type { ModuleNode, CycleReport } from '../../src/graph/cycle.js';
import { detectCycles } from '../../src/graph/cycle.js';

// ---------------------------------------------------------------------------
// Type-level shape assertions
// ---------------------------------------------------------------------------

describe('ModuleNode type', () => {
  it('accepts id and depends_on fields', () => {
    const node: ModuleNode = { id: 'MOD-A', depends_on: ['MOD-B'] };
    expect(node.id).toBe('MOD-A');
    expect(node.depends_on).toEqual(['MOD-B']);
  });

  it('accepts an empty depends_on list', () => {
    const node: ModuleNode = { id: 'MOD-Z', depends_on: [] };
    expect(node.depends_on).toHaveLength(0);
  });
});

describe('CycleReport type', () => {
  it('hasCycle false variant has no cycles field', () => {
    const report: CycleReport = { hasCycle: false };
    expect(report.hasCycle).toBe(false);
  });

  it('hasCycle true variant carries a cycles array', () => {
    const report: CycleReport = {
      hasCycle: true,
      cycles: [['MOD-A', 'MOD-B', 'MOD-A']],
    };
    expect(report.hasCycle).toBe(true);
    expect(report.cycles).toHaveLength(1);
  });
});

// ===========================================================================
// SECTION 1 — Acyclic graphs
// ===========================================================================

describe('detectCycles — acyclic graphs', () => {
  it('returns hasCycle false for an empty module list', () => {
    // Arrange
    const modules: ModuleNode[] = [];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(false);
  });

  it('returns hasCycle false for a single module with no dependencies', () => {
    // Arrange
    const modules: ModuleNode[] = [{ id: 'MOD-A', depends_on: [] }];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(false);
  });

  it('returns hasCycle false for a linear two-module chain', () => {
    // Arrange: MOD-A → MOD-B
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: [] },
    ];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(false);
  });

  it('returns hasCycle false for a diamond dependency graph', () => {
    // Arrange: MOD-A → [MOD-B, MOD-C]; MOD-B → MOD-D; MOD-C → MOD-D
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B', 'MOD-C'] },
      { id: 'MOD-B', depends_on: ['MOD-D'] },
      { id: 'MOD-C', depends_on: ['MOD-D'] },
      { id: 'MOD-D', depends_on: [] },
    ];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(false);
  });
});

// ===========================================================================
// SECTION 2 — Simple cycles
// ===========================================================================

describe('detectCycles — simple cycles', () => {
  it('returns hasCycle true for a two-node mutual dependency', () => {
    // Arrange: MOD-A → MOD-B → MOD-A
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-A'] },
    ];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(true);
  });

  it('cycle array for two-node cycle closes the loop (first node repeated at end)', () => {
    // Arrange: MOD-A → MOD-B → MOD-A
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-A'] },
    ];

    // Act
    const result = detectCycles(modules);

    // Assert — cycle closes: first and last element are the same
    expect(result.hasCycle).toBe(true);
    if (!result.hasCycle) return; // narrow type
    expect(result.cycles).toHaveLength(1);
    const cycle = result.cycles[0]!;
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  });

  it('returns hasCycle true for a three-node cycle', () => {
    // Arrange: MOD-A → MOD-B → MOD-C → MOD-A
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-C'] },
      { id: 'MOD-C', depends_on: ['MOD-A'] },
    ];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(true);
    if (!result.hasCycle) return;
    expect(result.cycles).toHaveLength(1);
    const cycle = result.cycles[0]!;
    // All three nodes present in the cycle
    expect(cycle).toContain('MOD-A');
    expect(cycle).toContain('MOD-B');
    expect(cycle).toContain('MOD-C');
    // Loop closes
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  });

  it('three-node cycle array contains exactly 4 entries (3 nodes + closing repeat)', () => {
    // Arrange
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-C'] },
      { id: 'MOD-C', depends_on: ['MOD-A'] },
    ];

    // Act
    const result = detectCycles(modules);

    // Assert
    if (!result.hasCycle) throw new Error('expected cycle');
    expect(result.cycles[0]!).toHaveLength(4);
  });
});

// ===========================================================================
// SECTION 3 — Self-loops
// ===========================================================================

describe('detectCycles — self-loops', () => {
  it('detects a module that depends on itself as a cycle', () => {
    // Arrange: MOD-X → MOD-X
    const modules: ModuleNode[] = [{ id: 'MOD-X', depends_on: ['MOD-X'] }];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(true);
  });

  it('self-loop cycle array contains the module id twice', () => {
    // Arrange
    const modules: ModuleNode[] = [{ id: 'MOD-X', depends_on: ['MOD-X'] }];

    // Act
    const result = detectCycles(modules);

    // Assert
    if (!result.hasCycle) throw new Error('expected cycle');
    const cycle = result.cycles[0]!;
    expect(cycle[0]).toBe('MOD-X');
    expect(cycle[cycle.length - 1]).toBe('MOD-X');
    expect(cycle).toHaveLength(2); // ['MOD-X', 'MOD-X']
  });
});

// ===========================================================================
// SECTION 4 — Multiple disjoint cycles
// ===========================================================================

describe('detectCycles — multiple disjoint cycles', () => {
  it('reports all disjoint cycles when two separate cycles exist', () => {
    // Arrange: Cycle 1: MOD-A ↔ MOD-B. Cycle 2: MOD-C ↔ MOD-D.
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-A'] },
      { id: 'MOD-C', depends_on: ['MOD-D'] },
      { id: 'MOD-D', depends_on: ['MOD-C'] },
    ];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(true);
    if (!result.hasCycle) return;
    expect(result.cycles).toHaveLength(2);
  });

  it('both cycle arrays are present and close their respective loops', () => {
    // Arrange
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-A'] },
      { id: 'MOD-C', depends_on: ['MOD-D'] },
      { id: 'MOD-D', depends_on: ['MOD-C'] },
    ];

    // Act
    const result = detectCycles(modules);
    if (!result.hasCycle) throw new Error('expected cycles');

    // Assert — each cycle closes
    for (const cycle of result.cycles) {
      expect(cycle[0]).toBe(cycle[cycle.length - 1]);
    }
  });
});

// ===========================================================================
// SECTION 5 — Unknown targets
// ===========================================================================

describe('detectCycles — unknown targets', () => {
  it('does not report an edge to a non-existent module as a cycle', () => {
    // Arrange: MOD-A depends on a module that does not exist
    const modules: ModuleNode[] = [{ id: 'MOD-A', depends_on: ['MOD-GHOST'] }];

    // Act
    const result = detectCycles(modules);

    // Assert — not a cycle
    expect(result.hasCycle).toBe(false);
  });

  it('reports edges to non-existent modules in unknownTargets', () => {
    // Arrange
    const modules: ModuleNode[] = [{ id: 'MOD-A', depends_on: ['MOD-GHOST'] }];

    // Act
    const result = detectCycles(modules);

    // Assert — unknownTargets array present with the dangling edge
    expect(result.unknownTargets).toBeDefined();
    expect(result.unknownTargets).toHaveLength(1);
    expect(result.unknownTargets![0]).toEqual({ from: 'MOD-A', to: 'MOD-GHOST' });
  });

  it('reports multiple unknown targets', () => {
    // Arrange
    const modules: ModuleNode[] = [{ id: 'MOD-A', depends_on: ['MOD-X', 'MOD-Y'] }];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.unknownTargets).toHaveLength(2);
  });

  it('unknown targets alongside a real cycle: both are reported correctly', () => {
    // Arrange: MOD-A ↔ MOD-B (cycle) plus MOD-A → MOD-GHOST (unknown)
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B', 'MOD-GHOST'] },
      { id: 'MOD-B', depends_on: ['MOD-A'] },
    ];

    // Act
    const result = detectCycles(modules);

    // Assert
    expect(result.hasCycle).toBe(true);
    expect(result.unknownTargets).toHaveLength(1);
    expect(result.unknownTargets![0]!.to).toBe('MOD-GHOST');
  });
});

// ===========================================================================
// SECTION 6 — Immutability of input
// ===========================================================================

describe('detectCycles — input immutability', () => {
  it('does not mutate the input modules array', () => {
    // Arrange
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-A'] },
    ];
    const snapshot = JSON.stringify(modules);

    // Act
    detectCycles(modules);

    // Assert
    expect(JSON.stringify(modules)).toBe(snapshot);
  });

  it('does not mutate the depends_on arrays inside each module', () => {
    // Arrange
    const depends = ['MOD-B', 'MOD-C'];
    const modules: ModuleNode[] = [
      { id: 'MOD-A', depends_on: depends },
      { id: 'MOD-B', depends_on: [] },
      { id: 'MOD-C', depends_on: [] },
    ];
    const originalLength = depends.length;

    // Act
    detectCycles(modules);

    // Assert
    expect(depends.length).toBe(originalLength);
    expect(depends[0]).toBe('MOD-B');
    expect(depends[1]).toBe('MOD-C');
  });
});

// ===========================================================================
// SECTION 7 — Deterministic output
// ===========================================================================

describe('detectCycles — deterministic output', () => {
  it('produces the same cycle list regardless of module input order', () => {
    // Arrange — two orderings of the same graph
    const order1: ModuleNode[] = [
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-C'] },
      { id: 'MOD-C', depends_on: ['MOD-A'] },
    ];
    const order2: ModuleNode[] = [
      { id: 'MOD-C', depends_on: ['MOD-A'] },
      { id: 'MOD-A', depends_on: ['MOD-B'] },
      { id: 'MOD-B', depends_on: ['MOD-C'] },
    ];

    // Act
    const r1 = detectCycles(order1);
    const r2 = detectCycles(order2);

    // Assert — both report a cycle; canonical form is identical
    expect(r1.hasCycle).toBe(true);
    expect(r2.hasCycle).toBe(true);
    if (!r1.hasCycle || !r2.hasCycle) return;
    // Sort for comparison in case multiple cycles
    const sorted1 = r1.cycles.map((c) => c.join(',')).sort();
    const sorted2 = r2.cycles.map((c) => c.join(',')).sort();
    expect(sorted1).toEqual(sorted2);
  });
});
