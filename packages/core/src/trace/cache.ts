/**
 * cache.ts
 *
 * SQLite-backed trace graph cache using sql.js (wasm).
 * ADR-CRUX-011 / REQ-CRUX-003 / ADR-CRUX-002
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import type { Database, SqlValue } from 'sql.js';
import type { Artifact, TraceEdge } from './types.js';
import { stripDoubledDrivePrefix } from './path-utils.js';

// ---------------------------------------------------------------------------
// Schema — load once at module init
// ---------------------------------------------------------------------------

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../schema/v1.sql',
);

function normaliseFilePath(p: string): string {
  return stripDoubledDrivePrefix(p);
}

const SCHEMA_SQL = fs.readFileSync(normaliseFilePath(SCHEMA_PATH), 'utf8');

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CacheClosedError extends Error {
  constructor() {
    super('TraceCache has been closed');
    this.name = 'CacheClosedError';
  }
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

async function atomicWriteBytes(filePath: string, bytes: Uint8Array): Promise<void> {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });

  const rand = crypto.randomBytes(6).toString('hex');
  const tmpPath = `${filePath}.tmp.${rand}`;

  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  try {
    await fsp.rename(tmpPath, filePath);
  } catch (renameErr: unknown) {
    try {
      await fsp.unlink(tmpPath);
    } catch {
      // ignore secondary cleanup failure
    }
    throw renameErr;
  }
}

// ---------------------------------------------------------------------------
// TraceCache interface
// ---------------------------------------------------------------------------

export interface TraceCache {
  upsertArtifact(artifact: Artifact, sha256: string, mtime: number): void;
  getArtifact(id: string): Artifact | null;
  upsertEdges(fromId: string, edges: TraceEdge[]): void;
  listEdges(fromId?: string): TraceEdge[];
  getHash(absPath: string): { sha256: string; mtime: number } | null;
  delete(id: string): void;
  listArtifacts(): Artifact[];
  flush(): Promise<void>;
  close(): void;
}

// ---------------------------------------------------------------------------
// TraceCacheImpl
// ---------------------------------------------------------------------------

class TraceCacheImpl implements TraceCache {
  private readonly db: Database;
  private readonly dbPath: string;
  private closed = false;

  constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  private assertOpen(): void {
    if (this.closed) throw new CacheClosedError();
  }

  upsertArtifact(artifact: Artifact, sha256: string, mtime: number): void {
    this.assertOpen();
    const rawJson = JSON.stringify(artifact.raw);
    this.db.run(
      `INSERT INTO artifacts (id, kind, path, raw_yaml, sha256, mtime)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         kind     = excluded.kind,
         path     = excluded.path,
         raw_yaml = excluded.raw_yaml,
         sha256   = excluded.sha256,
         mtime    = excluded.mtime`,
      [artifact.id, artifact.kind, artifact.path ?? '', rawJson, sha256, mtime],
    );
  }

  getArtifact(id: string): Artifact | null {
    this.assertOpen();
    const results = this.db.exec(`SELECT id, kind, path, raw_yaml FROM artifacts WHERE id = ?`, [
      id,
    ]);
    if (results.length === 0 || results[0] === undefined) return null;
    const row = results[0].values[0];
    if (!row) return null;
    return rowToArtifact(row);
  }

  upsertEdges(fromId: string, edges: TraceEdge[]): void {
    this.assertOpen();
    this.db.run(`DELETE FROM edges WHERE from_id = ?`, [fromId]);
    for (const edge of edges) {
      this.db.run(
        `INSERT INTO edges (from_id, to_id, relation, source_field) VALUES (?, ?, ?, ?)`,
        [edge.from, edge.to, edge.relation, edge.source_field],
      );
    }
  }

  listEdges(fromId?: string): TraceEdge[] {
    this.assertOpen();
    let results;
    if (fromId !== undefined) {
      results = this.db.exec(
        `SELECT from_id, to_id, relation, source_field FROM edges WHERE from_id = ?`,
        [fromId],
      );
    } else {
      results = this.db.exec(`SELECT from_id, to_id, relation, source_field FROM edges`);
    }
    if (results.length === 0 || results[0] === undefined) return [];
    return results[0].values.map(rowToEdge);
  }

  getHash(absPath: string): { sha256: string; mtime: number } | null {
    this.assertOpen();
    const results = this.db.exec(`SELECT sha256, mtime FROM artifacts WHERE path = ?`, [absPath]);
    if (results.length === 0 || results[0] === undefined) return null;
    const row = results[0].values[0];
    if (!row) return null;
    const sha256 = row[0];
    const mtime = row[1];
    if (typeof sha256 !== 'string' || typeof mtime !== 'number') return null;
    return { sha256, mtime };
  }

  delete(id: string): void {
    this.assertOpen();
    this.db.run(`DELETE FROM edges WHERE from_id = ?`, [id]);
    this.db.run(`DELETE FROM artifacts WHERE id = ?`, [id]);
  }

  listArtifacts(): Artifact[] {
    this.assertOpen();
    const results = this.db.exec(`SELECT id, kind, path, raw_yaml FROM artifacts`);
    if (results.length === 0 || results[0] === undefined) return [];
    return results[0].values.map(rowToArtifact);
  }

  async flush(): Promise<void> {
    this.assertOpen();
    const bytes = this.db.export();
    await atomicWriteBytes(this.dbPath, bytes);
  }

  close(): void {
    this.closed = true;
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

function rowToArtifact(row: SqlValue[]): Artifact {
  const id = row[0];
  const kind = row[1];
  const filePath = row[2];
  const rawJson = row[3];

  if (typeof id !== 'string' || typeof kind !== 'string' || typeof rawJson !== 'string') {
    throw new Error(`Malformed artifact row: ${JSON.stringify(row)}`);
  }

  const raw = JSON.parse(rawJson) as Record<string, unknown>;
  const pathVal = typeof filePath === 'string' && filePath !== '' ? filePath : undefined;

  return {
    id,
    kind: kind as Artifact['kind'],
    path: pathVal,
    raw,
  };
}

function rowToEdge(row: SqlValue[]): TraceEdge {
  const from = row[0];
  const to = row[1];
  const relation = row[2];
  const source_field = row[3];

  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    typeof relation !== 'string' ||
    typeof source_field !== 'string'
  ) {
    throw new Error(`Malformed edge row: ${JSON.stringify(row)}`);
  }

  return { from, to, relation, source_field };
}

// ---------------------------------------------------------------------------
// openCache
// ---------------------------------------------------------------------------

export async function openCache(dbPath: string): Promise<TraceCache> {
  const SQL = await initSqlJs();

  let db: Database;
  if (fs.existsSync(dbPath)) {
    const bytes = fs.readFileSync(dbPath);
    db = new SQL.Database(bytes);
  } else {
    db = new SQL.Database();
    db.run(SCHEMA_SQL);
  }

  return new TraceCacheImpl(db, dbPath);
}
