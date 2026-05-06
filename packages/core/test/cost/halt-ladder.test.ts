/**
 * halt-ladder.test.ts
 *
 * Locks the halt-rebase ladder contract for TASK-CRUX-005.
 *
 * These tests are intentionally RED until the coder creates:
 *   packages/core/src/cost/halt-ladder.ts
 * exporting: createHaltLadder, HaltLadder, HaltLadderOptions, AccrueResult, ConfirmResult
 *
 * Sources:
 *   - TASK-CRUX-005 (touches_files: packages/core/src/cost/**)
 *   - REQ-CRUX-011 (per-task halt at configurable multiplier, default 2.0x)
 *   - ADR-CRUX-009 (soft warn at 1.0x, hard halt at 2.0x, rebase ladder up to 5.0x,
 *                   three-strike auto-stop, CHG event signal)
 */

import { describe, it, expect } from 'vitest';
import type { AccrueResult } from '../../src/cost/halt-ladder.js';
import { createHaltLadder } from '../../src/cost/halt-ladder.js';

// ---------------------------------------------------------------------------
// Exported type shape
// ---------------------------------------------------------------------------

describe('createHaltLadder export', () => {
  it('is a callable function', () => {
    expect(typeof createHaltLadder).toBe('function');
  });

  it('returns an object with accrue, confirm, currentCeiling, currentCost methods', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    expect(typeof ladder.accrue).toBe('function');
    expect(typeof ladder.confirm).toBe('function');
    expect(typeof ladder.currentCeiling).toBe('function');
    expect(typeof ladder.currentCost).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('createHaltLadder — initial state', () => {
  it('starts with currentCost of 0', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    expect(ladder.currentCost()).toBe(0);
  });

  it('sets initial ceiling to multiplier * estimatedCost (2.0 × $1.00 = $2.00)', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    expect(ladder.currentCeiling()).toBeCloseTo(2.0);
  });

  it('respects a custom multiplier of 1.5 (REQ-CRUX-011 AC#2)', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 1.5 });
    expect(ladder.currentCeiling()).toBeCloseTo(1.5);
  });

  it('scales ceiling proportionally with estimatedCost', () => {
    const ladder = createHaltLadder({ estimatedCost: 2.5, multiplier: 2.0 });
    expect(ladder.currentCeiling()).toBeCloseTo(5.0);
  });
});

// ---------------------------------------------------------------------------
// accrue — basic accumulation, no halt
// ---------------------------------------------------------------------------

describe('accrue — cost accumulation below ceiling', () => {
  it('tracks currentCost after a single accrue call', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(0.5);
    expect(ladder.currentCost()).toBeCloseTo(0.5);
  });

  it('accumulates across multiple accrue calls', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(0.3);
    ladder.accrue(0.4);
    ladder.accrue(0.2);
    expect(ladder.currentCost()).toBeCloseTo(0.9);
  });

  it('returns halt: false when cost is below ceiling', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    const result = ladder.accrue(1.0); // cost = $1.00, ceiling = $2.00
    expect(result.halt).toBe(false);
  });

  it('returns autoStop: false when cost is below ceiling', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    const result = ladder.accrue(1.0);
    expect(result.autoStop).toBe(false);
  });

  it('returns currentCost in AccrueResult', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    const result = ladder.accrue(0.75);
    expect(result.currentCost).toBeCloseTo(0.75);
  });
});

// ---------------------------------------------------------------------------
// accrue — soft-warn at 1.0× estimatedCost (ADR-CRUX-009)
// ---------------------------------------------------------------------------

describe('accrue — soft-warn signal at 1.0x estimatedCost', () => {
  it('returns softWarn: true when cost first crosses 1.0× estimatedCost', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    const result = ladder.accrue(1.05); // crosses $1.00 soft threshold
    expect(result.softWarn).toBe(true);
  });

  it('returns softWarn: false for amounts that stay below 1.0× estimatedCost', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    const result = ladder.accrue(0.99);
    expect(result.softWarn).toBe(false);
  });

  it('emits softWarn only once (first crossing), not on subsequent accrues above 1.0x', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(1.05); // first crossing
    const second = ladder.accrue(0.1); // still above 1.0x but already warned
    expect(second.softWarn).toBe(false);
  });

  it('returns halt: false at the soft-warn crossing (soft-warn does not stop execution)', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    const result = ladder.accrue(1.05);
    expect(result.halt).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// accrue — first hard halt at 2.0× estimatedCost (REQ-CRUX-011 AC#1, ADR-CRUX-009)
// ---------------------------------------------------------------------------

describe('accrue — first hard halt at 2.0x (REQ-CRUX-011 AC#1)', () => {
  it('returns halt: true when accrued cost crosses 2.0× estimatedCost', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(1.0); // below ceiling
    const result = ladder.accrue(1.5); // now at $2.50 — crosses $2.00 ceiling
    expect(result.halt).toBe(true);
  });

  it('returns ceilingCrossed = 2.0 on first halt', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    const result = ladder.accrue(2.5);
    expect(result.ceilingCrossed).toBeCloseTo(2.0);
  });

  it('returns autoStop: false on first halt (user confirmation still possible)', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    const result = ladder.accrue(2.5);
    expect(result.autoStop).toBe(false);
  });

  it('does not fire again immediately after first halt on the next small increment', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(2.5); // triggers first halt
    // Confirm to continue
    ladder.confirm();
    // Ceiling is now $3.00. A small increment should not re-halt.
    const result = ladder.accrue(0.1); // total ~$2.6
    expect(result.halt).toBe(false);
  });

  it('halts at 1.5× when multiplier is set to 1.5 (REQ-CRUX-011 AC#2)', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 1.5 });
    const result = ladder.accrue(1.6); // crosses $1.50 ceiling
    expect(result.halt).toBe(true);
    expect(result.ceilingCrossed).toBeCloseTo(1.5);
  });
});

// ---------------------------------------------------------------------------
// confirm — raises ceiling by 1.0× estimatedCost (ADR-CRUX-009 halt-rebase policy)
// ---------------------------------------------------------------------------

describe('confirm — ceiling rebase', () => {
  it('raises the ceiling from 2.0x to 3.0x after the first confirmation', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(2.5);
    const result = ladder.confirm();
    expect(result.newCeiling).toBeCloseTo(3.0);
    expect(ladder.currentCeiling()).toBeCloseTo(3.0);
  });

  it('increments ceilingsConfirmedCount to 1 after first confirmation', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(2.5);
    const result = ladder.confirm();
    expect(result.ceilingsConfirmedCount).toBe(1);
  });

  it('raises ceiling from 3.0x to 4.0x after second confirmation', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(2.5);
    ladder.confirm(); // ceiling → 3.0
    ladder.accrue(0.6); // crosses 3.0
    const result = ladder.confirm(); // ceiling → 4.0
    expect(result.newCeiling).toBeCloseTo(4.0);
    expect(result.ceilingsConfirmedCount).toBe(2);
  });

  it('raises ceiling from 4.0x to 5.0x after third confirmation', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(2.5);
    ladder.confirm();
    ladder.accrue(0.6);
    ladder.confirm();
    ladder.accrue(0.6); // crosses 4.0 cumulative
    const result = ladder.confirm(); // ceiling → 5.0
    expect(result.newCeiling).toBeCloseTo(5.0);
    expect(result.ceilingsConfirmedCount).toBe(3);
  });

  it('sets autoStop: false on ConfirmResult for confirmations 1 and 2', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(2.5);
    const r1 = ladder.confirm();
    expect(r1.autoStop).toBe(false);

    ladder.accrue(0.6);
    const r2 = ladder.confirm();
    expect(r2.autoStop).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full ADR-CRUX-009 ladder: estimate=$1.0, multiplier=2.0
// Halt at $2.00, $3.00, $4.00, auto-stop at $5.00
// ---------------------------------------------------------------------------

describe('full halt-rebase ladder (ADR-CRUX-009 validated_by scenario)', () => {
  function buildFullLadder() {
    return createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
  }

  it('fires halt at $2.00 on first overrun (ceiling 2.0x)', () => {
    const ladder = buildFullLadder();
    const result = ladder.accrue(2.5); // overruns to $2.50
    expect(result.halt).toBe(true);
    expect(result.ceilingCrossed).toBeCloseTo(2.0);
    expect(result.autoStop).toBe(false);
  });

  it('after confirming halt 1: ceiling moves to $3.00 and cost $2.50 does not re-halt', () => {
    const ladder = buildFullLadder();
    ladder.accrue(2.5);
    ladder.confirm(); // ceiling → $3.00
    // Cost is already at $2.50 — it should NOT re-halt since $2.50 < $3.00
    const noHalt = ladder.accrue(0.0);
    expect(noHalt.halt).toBe(false);
  });

  it('fires halt at $3.00 after running to $3.50 with ceiling at 3.0x', () => {
    const ladder = buildFullLadder();
    ladder.accrue(2.5);
    ladder.confirm(); // ceiling → $3.00
    const result = ladder.accrue(1.0); // total $3.50 — crosses $3.00
    expect(result.halt).toBe(true);
    expect(result.ceilingCrossed).toBeCloseTo(3.0);
    expect(result.autoStop).toBe(false);
  });

  it('fires halt at $4.00 after running to $4.50 with ceiling at 4.0x', () => {
    const ladder = buildFullLadder();
    ladder.accrue(2.5);
    ladder.confirm();
    ladder.accrue(1.0);
    ladder.confirm(); // ceiling → $4.00
    const result = ladder.accrue(1.0); // total $4.50 — crosses $4.00
    expect(result.halt).toBe(true);
    expect(result.ceilingCrossed).toBeCloseTo(4.0);
    expect(result.autoStop).toBe(false);
  });

  it('fires auto-stop when cost crosses $5.00 ceiling after three confirms', () => {
    const ladder = buildFullLadder();
    ladder.accrue(2.5);
    ladder.confirm();
    ladder.accrue(1.0);
    ladder.confirm();
    ladder.accrue(1.0);
    ladder.confirm(); // ceiling → $5.00
    const result = ladder.accrue(1.0); // total $5.50 — crosses $5.00
    expect(result.halt).toBe(true);
    expect(result.autoStop).toBe(true);
  });

  it('includes recommendedAction: "revise-estimate-or-split" on auto-stop AccrueResult', () => {
    const ladder = buildFullLadder();
    ladder.accrue(2.5);
    ladder.confirm();
    ladder.accrue(1.0);
    ladder.confirm();
    ladder.accrue(1.0);
    ladder.confirm();
    const result = ladder.accrue(1.0);
    expect(result.recommendedAction).toBe('revise-estimate-or-split');
  });

  it('does not include recommendedAction on normal (non-autoStop) halts', () => {
    const ladder = buildFullLadder();
    const result = ladder.accrue(2.5); // first halt
    expect((result as AccrueResult).recommendedAction).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Auto-stop — no further accrual should fire additional halts after auto-stop
// ---------------------------------------------------------------------------

describe('auto-stop boundary — behaviour after the 5.0x ceiling is reached', () => {
  it('third confirm returns autoStop: true to signal the cycle should hard-stop', () => {
    // Note: the autoStop can also surface on the confirm result itself
    // to let the caller know the NEXT halt will be auto-stop.
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(2.5);
    ladder.confirm();
    ladder.accrue(1.0);
    ladder.confirm();
    ladder.accrue(1.0);
    const result = ladder.confirm(); // third confirm
    // The ConfirmResult signals that auto-stop is now armed
    expect(result.autoStop).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// currentCeiling getter
// ---------------------------------------------------------------------------

describe('currentCeiling getter', () => {
  it('reflects updated ceiling after each confirmation', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    expect(ladder.currentCeiling()).toBeCloseTo(2.0);
    ladder.accrue(2.5);
    ladder.confirm();
    expect(ladder.currentCeiling()).toBeCloseTo(3.0);
    ladder.accrue(0.6);
    ladder.confirm();
    expect(ladder.currentCeiling()).toBeCloseTo(4.0);
  });
});

// ---------------------------------------------------------------------------
// currentCost getter
// ---------------------------------------------------------------------------

describe('currentCost getter', () => {
  it('sums all amounts passed to accrue', () => {
    const ladder = createHaltLadder({ estimatedCost: 1.0, multiplier: 2.0 });
    ladder.accrue(0.25);
    ladder.accrue(0.75);
    ladder.accrue(1.0);
    expect(ladder.currentCost()).toBeCloseTo(2.0);
  });
});
