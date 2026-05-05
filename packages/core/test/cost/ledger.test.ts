/**
 * ledger.test.ts
 *
 * Locks the CSV cost-ledger contract for TASK-CRUX-005.
 *
 * These tests are intentionally RED until the coder creates:
 *   packages/core/src/cost/ledger.ts
 * exporting: appendLedgerRow, shouldLog, readLedger, LedgerRow
 *
 * Sources:
 *   - TASK-CRUX-005 (touches_files: packages/core/src/cost/**)
 *   - REQ-CRUX-012 (append-only CSV, 60-second threshold, required fields)
 *   - ADR-CRUX-009 (CSV at docs/sdlc/costs/log.csv, storage scope)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { LedgerRow } from '../../src/cost/ledger.js';
import { appendLedgerRow, shouldLog, readLedger } from '../../src/cost/ledger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-ledger-test-'));
  return dir;
}

function ledgerPath(rootDir: string): string {
  return path.join(rootDir, 'docs', 'sdlc', 'costs', 'log.csv');
}

function readRaw(rootDir: string): string {
  return fs.readFileSync(ledgerPath(rootDir), 'utf8');
}

const SAMPLE_ROW: LedgerRow = {
  task_id: 'TASK-CRUX-005',
  agent: 'test-writer',
  tokens_estimated: 1500,
  wall_seconds: 90,
  notes: 'sample note',
};

// ---------------------------------------------------------------------------
// LedgerRow shape
// ---------------------------------------------------------------------------

describe('LedgerRow type', () => {
  it('accepts a well-formed row with all required fields', () => {
    const row: LedgerRow = {
      task_id: 'TASK-CRUX-001',
      agent: 'coder',
      tokens_estimated: 2000,
      wall_seconds: 120,
      notes: '',
    };
    expect(row.task_id).toBe('TASK-CRUX-001');
    expect(row.agent).toBe('coder');
    expect(row.tokens_estimated).toBe(2000);
    expect(row.wall_seconds).toBe(120);
    expect(row.notes).toBe('');
  });
});

// ---------------------------------------------------------------------------
// shouldLog
// ---------------------------------------------------------------------------

describe('shouldLog', () => {
  it('returns false for wall_seconds strictly below 60', () => {
    expect(shouldLog(59)).toBe(false);
  });

  it('returns false for wall_seconds at 59.9', () => {
    expect(shouldLog(59.9)).toBe(false);
  });

  it('returns true for wall_seconds exactly at 60', () => {
    expect(shouldLog(60)).toBe(true);
  });

  it('returns true for wall_seconds at 60.1 (REQ-CRUX-012 AC#3 boundary)', () => {
    expect(shouldLog(60.1)).toBe(true);
  });

  it('returns true for wall_seconds well above 60', () => {
    expect(shouldLog(300)).toBe(true);
  });

  it('returns false for wall_seconds of 0', () => {
    expect(shouldLog(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// appendLedgerRow — file creation
// ---------------------------------------------------------------------------

describe('appendLedgerRow — file creation', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTmpRoot();
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('creates docs/sdlc/costs/log.csv when it does not exist', async () => {
    await appendLedgerRow(rootDir, SAMPLE_ROW);
    expect(fs.existsSync(ledgerPath(rootDir))).toBe(true);
  });

  it('creates intermediate directories if they do not exist', async () => {
    await appendLedgerRow(rootDir, SAMPLE_ROW);
    const dir = path.join(rootDir, 'docs', 'sdlc', 'costs');
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('writes a header row as the first line when the file is new', async () => {
    await appendLedgerRow(rootDir, SAMPLE_ROW);
    const raw = readRaw(rootDir);
    const lines = raw.split('\n').filter(Boolean);
    expect(lines[0]).toBe('task_id,agent,tokens_estimated,wall_seconds,notes');
  });

  it('writes the data row as the second line when the file is new', async () => {
    await appendLedgerRow(rootDir, SAMPLE_ROW);
    const raw = readRaw(rootDir);
    const lines = raw.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('TASK-CRUX-005');
  });
});

// ---------------------------------------------------------------------------
// appendLedgerRow — append-only behaviour (REQ-CRUX-012 AC#2)
// ---------------------------------------------------------------------------

describe('appendLedgerRow — append-only (REQ-CRUX-012 AC#2)', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTmpRoot();
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('does NOT write a second header when appending to an existing file', async () => {
    await appendLedgerRow(rootDir, SAMPLE_ROW);
    const secondRow: LedgerRow = { ...SAMPLE_ROW, task_id: 'TASK-CRUX-006' };
    await appendLedgerRow(rootDir, secondRow);
    const raw = readRaw(rootDir);
    const lines = raw.split('\n').filter(Boolean);
    // Only one header line
    const headerLines = lines.filter((l) => l.startsWith('task_id,'));
    expect(headerLines).toHaveLength(1);
  });

  it('preserves the first row when a second row is appended', async () => {
    await appendLedgerRow(rootDir, SAMPLE_ROW);
    const secondRow: LedgerRow = { ...SAMPLE_ROW, task_id: 'TASK-CRUX-006' };
    await appendLedgerRow(rootDir, secondRow);
    const raw = readRaw(rootDir);
    expect(raw).toContain('TASK-CRUX-005');
    expect(raw).toContain('TASK-CRUX-006');
  });

  it('increments line count correctly on each append', async () => {
    for (let i = 0; i < 5; i++) {
      await appendLedgerRow(rootDir, { ...SAMPLE_ROW, task_id: `TASK-${i}` });
    }
    const raw = readRaw(rootDir);
    const lines = raw.split('\n').filter(Boolean);
    // 1 header + 5 data rows
    expect(lines).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// appendLedgerRow — CSV field serialisation
// ---------------------------------------------------------------------------

describe('appendLedgerRow — CSV field serialisation', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTmpRoot();
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('serialises all five required fields in the correct column order', async () => {
    const row: LedgerRow = {
      task_id: 'TASK-001',
      agent: 'planner',
      tokens_estimated: 999,
      wall_seconds: 75,
      notes: 'clean note',
    };
    await appendLedgerRow(rootDir, row);
    const parsed = readLedger(rootDir);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(row);
  });

  it('quotes a notes field that contains a comma (RFC 4180)', async () => {
    const row: LedgerRow = {
      ...SAMPLE_ROW,
      notes: 'first part, second part',
    };
    await appendLedgerRow(rootDir, row);
    const parsed = readLedger(rootDir);
    expect(parsed[0]?.notes).toBe('first part, second part');
  });

  it('quotes a notes field that contains a newline (RFC 4180)', async () => {
    const row: LedgerRow = {
      ...SAMPLE_ROW,
      notes: 'line one\nline two',
    };
    await appendLedgerRow(rootDir, row);
    const parsed = readLedger(rootDir);
    expect(parsed[0]?.notes).toBe('line one\nline two');
  });

  it('quotes a notes field that contains double-quotes, escaping them (RFC 4180)', async () => {
    const row: LedgerRow = {
      ...SAMPLE_ROW,
      notes: 'said "hello"',
    };
    await appendLedgerRow(rootDir, row);
    const parsed = readLedger(rootDir);
    expect(parsed[0]?.notes).toBe('said "hello"');
  });

  it('stores tokens_estimated as a number that round-trips through readLedger', async () => {
    await appendLedgerRow(rootDir, { ...SAMPLE_ROW, tokens_estimated: 42000 });
    const parsed = readLedger(rootDir);
    expect(parsed[0]?.tokens_estimated).toBe(42000);
  });

  it('stores wall_seconds as a number that round-trips through readLedger', async () => {
    await appendLedgerRow(rootDir, { ...SAMPLE_ROW, wall_seconds: 303.5 });
    const parsed = readLedger(rootDir);
    expect(parsed[0]?.wall_seconds).toBe(303.5);
  });
});

// ---------------------------------------------------------------------------
// readLedger — parsing
// ---------------------------------------------------------------------------

describe('readLedger', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTmpRoot();
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('returns an empty array when the log file does not exist', () => {
    expect(readLedger(rootDir)).toEqual([]);
  });

  it('returns an empty array when the log file has only a header row', async () => {
    await appendLedgerRow(rootDir, SAMPLE_ROW); // creates header + 1 row
    // Manually remove the data row by overwriting the file with header only
    const csvPath = ledgerPath(rootDir);
    fs.writeFileSync(csvPath, 'task_id,agent,tokens_estimated,wall_seconds,notes\n');
    expect(readLedger(rootDir)).toEqual([]);
  });

  it('returns exactly one row for a single appended entry', async () => {
    await appendLedgerRow(rootDir, SAMPLE_ROW);
    expect(readLedger(rootDir)).toHaveLength(1);
  });

  it('returns rows in append order', async () => {
    const first: LedgerRow = { ...SAMPLE_ROW, task_id: 'TASK-A' };
    const second: LedgerRow = { ...SAMPLE_ROW, task_id: 'TASK-B' };
    await appendLedgerRow(rootDir, first);
    await appendLedgerRow(rootDir, second);
    const rows = readLedger(rootDir);
    expect(rows[0]?.task_id).toBe('TASK-A');
    expect(rows[1]?.task_id).toBe('TASK-B');
  });
});

// ---------------------------------------------------------------------------
// Atomic append — concurrent writes must not interleave bytes mid-line
// ---------------------------------------------------------------------------

describe('appendLedgerRow — atomic concurrent appends', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTmpRoot();
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('produces the correct row count when N calls are made in parallel', async () => {
    const N = 10;
    const rows: LedgerRow[] = Array.from({ length: N }, (_, i) => ({
      ...SAMPLE_ROW,
      task_id: `TASK-PARALLEL-${i}`,
    }));
    await Promise.all(rows.map((r) => appendLedgerRow(rootDir, r)));
    const parsed = readLedger(rootDir);
    expect(parsed).toHaveLength(N);
  });

  it('does not produce a duplicate header row under concurrent appends', async () => {
    const N = 8;
    const rows: LedgerRow[] = Array.from({ length: N }, (_, i) => ({
      ...SAMPLE_ROW,
      task_id: `TASK-CONC-${i}`,
    }));
    await Promise.all(rows.map((r) => appendLedgerRow(rootDir, r)));
    const raw = readRaw(rootDir);
    const lines = raw.split('\n').filter(Boolean);
    const headerCount = lines.filter((l) => l.startsWith('task_id,')).length;
    expect(headerCount).toBe(1);
  });

  it('produces parseable rows (no byte-interleaving) under concurrent appends', async () => {
    const N = 10;
    const rows: LedgerRow[] = Array.from({ length: N }, (_, i) => ({
      ...SAMPLE_ROW,
      task_id: `TASK-ATOMIC-${i}`,
    }));
    await Promise.all(rows.map((r) => appendLedgerRow(rootDir, r)));
    // readLedger must not throw and must return N parseable rows
    const parsed = readLedger(rootDir);
    expect(parsed.every((r) => typeof r.task_id === 'string')).toBe(true);
    expect(parsed).toHaveLength(N);
  });
});

// ---------------------------------------------------------------------------
// 60-second threshold integration (REQ-CRUX-012 AC#3 — full write path)
// ---------------------------------------------------------------------------

describe('shouldLog + appendLedgerRow — 60-second threshold (REQ-CRUX-012 AC#3)', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTmpRoot();
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('produces no row in the CSV when wall_seconds is 59.9', async () => {
    const row: LedgerRow = { ...SAMPLE_ROW, wall_seconds: 59.9 };
    if (shouldLog(row.wall_seconds)) {
      await appendLedgerRow(rootDir, row);
    }
    const csvExists = fs.existsSync(ledgerPath(rootDir));
    expect(csvExists).toBe(false);
  });

  it('produces exactly one row in the CSV when wall_seconds is 60.1', async () => {
    const row: LedgerRow = { ...SAMPLE_ROW, wall_seconds: 60.1 };
    if (shouldLog(row.wall_seconds)) {
      await appendLedgerRow(rootDir, row);
    }
    const parsed = readLedger(rootDir);
    expect(parsed).toHaveLength(1);
  });
});
