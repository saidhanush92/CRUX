/**
 * index.ts — barrel re-export for the cost module
 */

export type { LedgerRow } from './ledger.js';
export { appendLedgerRow, shouldLog, readLedger } from './ledger.js';

export type { HaltLadder, HaltLadderOptions, AccrueResult, ConfirmResult } from './halt-ladder.js';
export { createHaltLadder } from './halt-ladder.js';
