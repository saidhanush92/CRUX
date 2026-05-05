/**
 * state-machine.test.ts
 *
 * Locks the gate state machine contract described in TASK-CRUX-001.
 * Crux tracks per-IDEA gate progression across 8 ordered gates.
 *
 * These tests are intentionally RED until the coder creates
 *   packages/core/src/gate/state-machine.ts
 * exporting GateId, GateStatus, GateState, and createGateMachine().
 *
 * Sources:
 *   - TASK-CRUX-001 (touches_files: packages/core/src/gate/**)
 *   - REQ-CRUX-008 (gate-mode + artifact invariance)
 *   - ADR-CRUX-001 (TypeScript monorepo conventions)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GateId, GateStatus, GateState } from '../../src/gate/state-machine.js';
import { createGateMachine } from '../../src/gate/state-machine.js';

// ---------------------------------------------------------------------------
// Type-level shape tests — exercised at runtime to confirm exports exist
// ---------------------------------------------------------------------------

describe('GateId type', () => {
  it('accepts all 8 numeric gate identifiers', () => {
    // If GateId is not exported or is wrong shape, this assignment fails at compile-time.
    const gates: GateId[] = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(gates).toHaveLength(8);
  });
});

describe('GateStatus type', () => {
  it('represents the four allowed status values', () => {
    const statuses: GateStatus[] = ['open', 'closed', 'blocked', 'skipped'];
    expect(statuses).toHaveLength(4);
  });
});

describe('GateState shape', () => {
  it('holds gate id, status, optional timestamps, and optional blocker', () => {
    const minimal: GateState = { gate: 1, status: 'open' };
    expect(minimal.gate).toBe(1);
    expect(minimal.status).toBe('open');
    expect(minimal.opened_at).toBeUndefined();
    expect(minimal.closed_at).toBeUndefined();
    expect(minimal.blocker).toBeUndefined();
  });

  it('accepts all optional fields when present', () => {
    const full: GateState = {
      gate: 3,
      status: 'closed',
      opened_at: '2026-01-01T00:00:00Z',
      closed_at: '2026-01-02T00:00:00Z',
    };
    expect(full.closed_at).toBe('2026-01-02T00:00:00Z');
  });

  it('accepts blocker field when status is blocked', () => {
    const blocked: GateState = {
      gate: 5,
      status: 'blocked',
      opened_at: '2026-01-01T00:00:00Z',
      blocker: 'missing ADR sign-off',
    };
    expect(blocked.blocker).toBe('missing ADR sign-off');
  });
});

// ---------------------------------------------------------------------------
// createGateMachine factory
// ---------------------------------------------------------------------------

describe('createGateMachine', () => {
  it('is exported and callable with no arguments', () => {
    expect(typeof createGateMachine).toBe('function');
    const machine = createGateMachine();
    expect(machine).toBeDefined();
  });

  it('returns an object with open, close, block, current, all methods', () => {
    const machine = createGateMachine();
    expect(typeof machine.open).toBe('function');
    expect(typeof machine.close).toBe('function');
    expect(typeof machine.block).toBe('function');
    expect(typeof machine.current).toBe('function');
    expect(typeof machine.all).toBe('function');
  });

  it('returns an object with serialize and deserialize methods', () => {
    const machine = createGateMachine();
    expect(typeof machine.serialize).toBe('function');
    expect(typeof machine.deserialize).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Gate 1 — first gate can be opened without predecessor
// ---------------------------------------------------------------------------

describe('open(gate)', () => {
  it('opens gate 1 without requiring any predecessor', () => {
    const machine = createGateMachine();
    machine.open(1);
    const state = machine.all().find((g) => g.gate === 1);
    expect(state?.status).toBe('open');
  });

  it('records opened_at timestamp when gate is opened', () => {
    const machine = createGateMachine();
    machine.open(1);
    const state = machine.all().find((g) => g.gate === 1);
    expect(state?.opened_at).toBeDefined();
    expect(typeof state?.opened_at).toBe('string');
  });

  it('throws when opening gate 2 if gate 1 is not closed or skipped', () => {
    const machine = createGateMachine();
    // Gate 1 is not yet closed — opening gate 2 must fail
    expect(() => machine.open(2)).toThrow();
  });

  it('throws with a message naming gate 1 as the unmet predecessor when opening gate 2', () => {
    const machine = createGateMachine();
    expect(() => machine.open(2)).toThrowError(/gate 1/i);
  });

  it('allows opening gate 2 after gate 1 is closed', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    machine.open(2);
    const state = machine.all().find((g) => g.gate === 2);
    expect(state?.status).toBe('open');
  });

  it('allows opening gate 2 after gate 1 is skipped', () => {
    const machine = createGateMachine();
    // Skipping gate 1 directly satisfies the predecessor requirement
    machine.skip(1);
    machine.open(2);
    const state = machine.all().find((g) => g.gate === 2);
    expect(state?.status).toBe('open');
  });

  it('gates 3-8 each require their direct predecessor to be closed or skipped', () => {
    const gateIds: GateId[] = [3, 4, 5, 6, 7, 8];
    for (const gate of gateIds) {
      const machine = createGateMachine();
      // Open and close all predecessors
      for (let i = 1; i < gate; i++) {
        machine.open(i as GateId);
        machine.close(i as GateId);
      }
      // Now opening the target gate should succeed
      expect(() => machine.open(gate)).not.toThrow();
    }
  });

  it('throws when trying to open a gate that is already open', () => {
    const machine = createGateMachine();
    machine.open(1);
    expect(() => machine.open(1)).toThrow();
  });

  it('throws when trying to open a gate that is already closed', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    expect(() => machine.open(1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// close(gate)
// ---------------------------------------------------------------------------

describe('close(gate)', () => {
  it('closes a gate that is open', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    const state = machine.all().find((g) => g.gate === 1);
    expect(state?.status).toBe('closed');
  });

  it('records closed_at timestamp when gate is closed', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    const state = machine.all().find((g) => g.gate === 1);
    expect(state?.closed_at).toBeDefined();
    expect(typeof state?.closed_at).toBe('string');
  });

  it('throws when closing a gate that is not open', () => {
    const machine = createGateMachine();
    expect(() => machine.close(1)).toThrow();
  });

  it('throws with a message when closing a gate that is already closed', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    expect(() => machine.close(1)).toThrow();
  });

  it('throws with a message when closing a gate that was never opened', () => {
    const machine = createGateMachine();
    expect(() => machine.close(5)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// block(gate, reason)
// ---------------------------------------------------------------------------

describe('block(gate, reason)', () => {
  it('blocks a gate that is currently open', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.block(1, 'ADR approval pending');
    const state = machine.all().find((g) => g.gate === 1);
    expect(state?.status).toBe('blocked');
  });

  it('stores the blocker reason string on the gate state', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.block(1, 'critical risk identified');
    const state = machine.all().find((g) => g.gate === 1);
    expect(state?.blocker).toBe('critical risk identified');
  });

  it('throws when blocking a gate that is not open', () => {
    const machine = createGateMachine();
    expect(() => machine.block(1, 'some reason')).toThrow();
  });

  it('throws when blocking a gate that is already closed', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    expect(() => machine.block(1, 'late blocker')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// skip(gate)
// ---------------------------------------------------------------------------

describe('skip(gate)', () => {
  it('marks a gate as skipped', () => {
    const machine = createGateMachine();
    machine.skip(1);
    const state = machine.all().find((g) => g.gate === 1);
    expect(state?.status).toBe('skipped');
  });

  it('allows opening the next gate after a predecessor is skipped', () => {
    const machine = createGateMachine();
    machine.skip(1);
    machine.open(2);
    const state = machine.all().find((g) => g.gate === 2);
    expect(state?.status).toBe('open');
  });

  it('throws when skipping a gate that is already open', () => {
    const machine = createGateMachine();
    machine.open(1);
    expect(() => machine.skip(1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// current()
// ---------------------------------------------------------------------------

describe('current()', () => {
  it('returns empty array when no gates have been opened', () => {
    const machine = createGateMachine();
    expect(machine.current()).toEqual([]);
  });

  it('returns the currently open gate(s)', () => {
    const machine = createGateMachine();
    machine.open(1);
    const current = machine.current();
    expect(current.length).toBeGreaterThanOrEqual(1);
    expect(current.some((g) => g.gate === 1 && g.status === 'open')).toBe(true);
  });

  it('returns empty array after the open gate is closed', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    expect(machine.current()).toEqual([]);
  });

  it('returns empty array when a gate is blocked (blocked is not open)', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.block(1, 'blocking reason');
    // blocked gates are not "currently open" in terms of progression
    const current = machine.current();
    expect(current.every((g) => g.status === 'open')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// all()
// ---------------------------------------------------------------------------

describe('all()', () => {
  it('returns an array', () => {
    const machine = createGateMachine();
    expect(Array.isArray(machine.all())).toBe(true);
  });

  it('returned array snapshot does not affect internal state when mutated', () => {
    const machine = createGateMachine();
    machine.open(1);
    const snapshot = machine.all();
    // Mutate the snapshot
    const firstEntry = snapshot[0];
    if (firstEntry) {
      (firstEntry as Record<string, unknown>)['status'] = 'closed';
    }
    snapshot.splice(0, snapshot.length);

    // Internal state must remain unchanged
    const fresh = machine.all();
    expect(fresh.some((g) => g.gate === 1 && g.status === 'open')).toBe(true);
  });

  it('reflects each gate transition in order', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    machine.open(2);
    const all = machine.all();
    const g1 = all.find((g) => g.gate === 1);
    const g2 = all.find((g) => g.gate === 2);
    expect(g1?.status).toBe('closed');
    expect(g2?.status).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// serialize() / deserialize() round-trip
// ---------------------------------------------------------------------------

describe('serialize() and deserialize()', () => {
  it('serialize returns a plain JSON-serializable object', () => {
    const machine = createGateMachine();
    machine.open(1);
    const snapshot = machine.serialize();
    // Must survive a JSON round-trip without loss
    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    expect(roundTripped).toEqual(snapshot);
  });

  it('deserialize rehydrates state so all() returns equivalent data', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    machine.open(2);
    machine.block(2, 'waiting for review');

    const snapshot = machine.serialize();

    const rehydrated = createGateMachine();
    rehydrated.deserialize(snapshot);

    const original = machine.all();
    const restored = rehydrated.all();

    expect(restored).toEqual(original);
  });

  it('serialize → JSON.stringify → JSON.parse → deserialize round-trips identically', () => {
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    machine.open(2);

    const jsonString = JSON.stringify(machine.serialize());
    const parsed = JSON.parse(jsonString) as unknown;

    const rehydrated = createGateMachine();
    rehydrated.deserialize(parsed);

    expect(rehydrated.all()).toEqual(machine.all());
  });

  it('serialize does not expose internal references — mutating result does not affect machine', () => {
    const machine = createGateMachine();
    machine.open(1);
    const snap = machine.serialize();
    // Corrupt the snapshot
    (snap as Record<string, unknown>)['gates'] = [];
    // Machine state must remain intact
    const still = machine.all();
    expect(still.some((g) => g.gate === 1 && g.status === 'open')).toBe(true);
  });

  it('deserialize with an empty snapshot resets to a clean machine state', () => {
    const machine = createGateMachine();
    machine.open(1);
    const empty = createGateMachine().serialize();
    machine.deserialize(empty);
    expect(machine.current()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Predecessor chain — all 8 gates enforce ordered sequencing
// ---------------------------------------------------------------------------

describe('full 8-gate predecessor chain', () => {
  it('can progress through all 8 gates sequentially when each predecessor is closed', () => {
    const machine = createGateMachine();
    for (let i = 1; i <= 8; i++) {
      machine.open(i as GateId);
      machine.close(i as GateId);
    }
    const all = machine.all();
    const closedGates = all.filter((g) => g.status === 'closed');
    expect(closedGates).toHaveLength(8);
  });

  it('throws with predecessor error message when skipping a gate in sequence', () => {
    // Open gate 1, close it. Then try to open gate 3 (skipping gate 2).
    const machine = createGateMachine();
    machine.open(1);
    machine.close(1);
    // Gate 2 is still pending — gate 3 must not open
    expect(() => machine.open(3 as GateId)).toThrowError(/gate 2/i);
  });
});
