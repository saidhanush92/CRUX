/**
 * ledger.ts — append-only CSV cost ledger for CRUX
 *
 * Implements REQ-CRUX-012: structured cost logging to docs/sdlc/costs/log.csv.
 * RFC 4180 CSV quoting, atomic append via in-process mutex + sync FS operations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LedgerRow {
  task_id: string;
  agent: string;
  tokens_estimated: number;
  wall_seconds: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALL_SECONDS_THRESHOLD = 60;
const RELATIVE_LOG_PATH = path.join('docs', 'sdlc', 'costs', 'log.csv');
const HEADER = 'task_id,agent,tokens_estimated,wall_seconds,notes';

// ---------------------------------------------------------------------------
// In-process mutex (Promise chain per file path)
// ---------------------------------------------------------------------------

const mutexMap = new Map<string, Promise<void>>();

function withMutex(filePath: string, fn: () => void): Promise<void> {
  const prior = mutexMap.get(filePath) ?? Promise.resolve();
  const next = prior.then(fn);
  mutexMap.set(
    filePath,
    next.then(
      () => {
        /* completed */
      },
      () => {
        /* also clear on error to avoid stuck chain */
      },
    ),
  );
  return next;
}

// ---------------------------------------------------------------------------
// RFC 4180 CSV helpers
// ---------------------------------------------------------------------------

function quoteField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function serializeRow(row: LedgerRow): string {
  return [
    quoteField(row.task_id),
    quoteField(row.agent),
    String(row.tokens_estimated),
    String(row.wall_seconds),
    quoteField(row.notes),
  ].join(',');
}

// ---------------------------------------------------------------------------
// shouldLog (REQ-CRUX-012 AC#3)
// ---------------------------------------------------------------------------

export function shouldLog(wallSeconds: number): boolean {
  return wallSeconds >= WALL_SECONDS_THRESHOLD;
}

// ---------------------------------------------------------------------------
// appendLedgerRow (REQ-CRUX-012 AC#2 — append-only, atomic)
// ---------------------------------------------------------------------------

export function appendLedgerRow(rootDir: string, row: LedgerRow): Promise<void> {
  const filePath = path.join(rootDir, RELATIVE_LOG_PATH);

  return withMutex(filePath, () => {
    const dirPath = path.dirname(filePath);
    fs.mkdirSync(dirPath, { recursive: true });

    const isNew = !fs.existsSync(filePath);

    const fd = fs.openSync(filePath, 'a');
    try {
      if (isNew) {
        fs.writeSync(fd, `${HEADER}\n`);
      }
      fs.writeSync(fd, `${serializeRow(row)}\n`);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  });
}

// ---------------------------------------------------------------------------
// readLedger — parse CSV back to LedgerRow[]
// ---------------------------------------------------------------------------

/**
 * Parse RFC 4180 CSV line into fields.
 * Handles quoted fields with embedded commas, newlines, and doubled quotes.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      // Trailing empty field handled by the loop exit
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      if (line[i] === ',') i++;
    } else {
      // Unquoted field
      const end = line.indexOf(',', i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
  }

  return fields;
}

export function readLedger(rootDir: string): LedgerRow[] {
  const filePath = path.join(rootDir, RELATIVE_LOG_PATH);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Split on newlines — RFC 4180 allows \r\n or \n
  // We need to handle quoted fields that contain newlines.
  // Strategy: parse character by character across the whole content.
  const allRows = splitCsvRows(content);

  // First row is the header — skip it
  const dataRows = allRows.slice(1);

  return dataRows
    .filter((row) => row.trim().length > 0)
    .map((row) => {
      const fields = parseCsvLine(row);
      return {
        task_id: fields[0] ?? '',
        agent: fields[1] ?? '',
        tokens_estimated: Number(fields[2] ?? '0'),
        wall_seconds: Number(fields[3] ?? '0'),
        notes: fields[4] ?? '',
      };
    });
}

/**
 * Split CSV content into logical rows, respecting quoted fields
 * that may contain embedded newlines.
 */
function splitCsvRows(content: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      i++;
    } else if (!inQuotes && (ch === '\n' || (ch === '\r' && content[i + 1] === '\n'))) {
      rows.push(current);
      current = '';
      if (ch === '\r') i++; // skip \r in \r\n
      i++;
    } else {
      current += ch;
      i++;
    }
  }

  if (current.length > 0) {
    rows.push(current);
  }

  return rows;
}
