/**
 * halt-ladder.ts — per-task cost halt and rebase ladder
 *
 * Implements REQ-CRUX-011 and ADR-CRUX-009:
 *   - Soft warn at 1.0× estimatedCost (advisory, fires once)
 *   - Hard halt at multiplier × estimatedCost (default 2.0×)
 *   - On confirm: ceiling += 1.0× estimatedCost
 *   - After 3 confirms (5.0× ceiling): auto-stop on next crossing
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HaltLadderOptions {
  estimatedCost: number;
  multiplier: number;
}

export interface AccrueResult {
  halt: boolean;
  autoStop: boolean;
  softWarn: boolean;
  currentCost: number;
  ceilingCrossed?: number;
  recommendedAction?: 'revise-estimate-or-split';
}

export interface ConfirmResult {
  newCeiling: number;
  ceilingsConfirmedCount: number;
  autoStop: boolean;
}

export interface HaltLadder {
  accrue(amount: number): AccrueResult;
  confirm(): ConfirmResult;
  currentCeiling(): number;
  currentCost(): number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONFIRMS = 3;
const CEILING_STEP_MULTIPLIER = 1.0;
const SOFT_WARN_MULTIPLIER = 1.0;

// ---------------------------------------------------------------------------
// createHaltLadder
// ---------------------------------------------------------------------------

export function createHaltLadder(options: HaltLadderOptions): HaltLadder {
  const { estimatedCost, multiplier } = options;

  let cost = 0;
  let ceiling = multiplier * estimatedCost;
  let confirmsCount = 0;
  let softWarnEmitted = false;

  function accrue(amount: number): AccrueResult {
    cost += amount;

    const softWarnThreshold = SOFT_WARN_MULTIPLIER * estimatedCost;
    let softWarn = false;

    if (!softWarnEmitted && cost >= softWarnThreshold) {
      softWarnEmitted = true;
      softWarn = true;
    }

    if (cost >= ceiling) {
      const crossed = ceiling;
      const isAutoStop = confirmsCount >= MAX_CONFIRMS;

      const result: AccrueResult = {
        halt: true,
        autoStop: isAutoStop,
        softWarn,
        currentCost: cost,
        ceilingCrossed: crossed,
      };

      if (isAutoStop) {
        result.recommendedAction = 'revise-estimate-or-split';
      }

      return result;
    }

    return {
      halt: false,
      autoStop: false,
      softWarn,
      currentCost: cost,
    };
  }

  function confirm(): ConfirmResult {
    confirmsCount += 1;
    ceiling += CEILING_STEP_MULTIPLIER * estimatedCost;

    const isAutoStopArmed = confirmsCount >= MAX_CONFIRMS;

    return {
      newCeiling: ceiling,
      ceilingsConfirmedCount: confirmsCount,
      autoStop: isAutoStopArmed,
    };
  }

  function currentCeiling(): number {
    return ceiling;
  }

  function currentCost(): number {
    return cost;
  }

  return { accrue, confirm, currentCeiling, currentCost };
}
