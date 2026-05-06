/**
 * cache.test.ts
 *
 * Locks the TraceCache contract described in TASK-CRUX-003.
 *
 * Tests cover: openCache, upsertArtifact, upsertEdges, getArtifact,
 * listArtifacts, listEdges, getHash, delete, flush, close.
 *
 * These tests MUST be RED until the coder creates:
 *   packages/core/src/trace/cache.ts
 *
 * ADR references:
 *   - ADR-CRUX-002 — markdown-canonical, flush atomicity (temp+fsync+rename)
 *   - ADR-CRUX-011 — sql.js binding
 *
 * Constraints:
 *   - No production-code imports from cache.ts (it doesn't exist yet).
 *   - No additional test dependencies beyond vitest and node: builtins.
 *   - Per-test unique dbPath via os.tmpdir().
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

// The module under test — does not exist yet; imports will fail RED.
import type { TraceCache } from '../../src/trace/cache.js';
import { openCache } from '../../src/trace/cache.js';

import type { Artifact, TraceEdge } from '../../src/trace/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeArtifact(id: string, overrides: Partial<Artifact> = {}): Artifact {
  return {
    id,
    kind: 'REQ',
    path: `/tmp/sdlc/${id}.yaml`,
    raw: { id, text: `Text for ${id}`, priority: 'must' },
    ...overrides,
  };
}

function makeEdge(from: string, to: string, relation = 'derived_from'): TraceEdge {
  return { from, to, relation, source_field: relation };
}

function sha256Of(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Per-test tmpdir
// ---------------------------------------------------------------------------

let tmpDir = '';

beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'crux-cache-test-'));
});

afterEach(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

function dbPath(): string {
  return path.join(tmpDir, 'trace.db');
}

// ===========================================================================
// SECTION 1 — openCache: initial creation
// ===========================================================================

describe('openCache — creates new DB when dbPath does not exist', () => {
  it('resolves to a TraceCache object without throwing', async () => {
    // Arrange
    const p = dbPath();
    expect(fs.existsSync(p)).toBe(false);

    // Act
    const cache = await openCache(p);

    // Assert — cache is a non-null object with expected methods
    expect(cache).toBeDefined();
    expect(typeof cache.upsertArtifact).toBe('function');
    expect(typeof cache.upsertEdges).toBe('function');
    expect(typeof cache.getArtifact).toBe('function');
    expect(typeof cache.listArtifacts).toBe('function');
    expect(typeof cache.listEdges).toBe('function');
    expect(typeof cache.getHash).toBe('function');
    expect(typeof cache.delete).toBe('function');
    expect(typeof cache.flush).toBe('function');
    expect(typeof cache.close).toBe('function');

    cache.close();
  });

  it('listArtifacts returns empty array on a fresh cache', async () => {
    // Arrange + Act
    const cache = await openCache(dbPath());

    // Assert
    expect(cache.listArtifacts()).toEqual([]);

    cache.close();
  });

  it('listEdges returns empty array on a fresh cache with no filter', async () => {
    const cache = await openCache(dbPath());

    expect(cache.listEdges()).toEqual([]);

    cache.close();
  });
});

// ===========================================================================
// SECTION 2 — upsertArtifact + getArtifact
// ===========================================================================

describe('upsertArtifact and getArtifact', () => {
  it('stores and retrieves a single artifact by id', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    const artifact = makeArtifact('REQ-CRUX-001');
    const hash = sha256Of(JSON.stringify(artifact.raw));
    const mtime = Date.now();

    // Act
    cache.upsertArtifact(artifact, hash, mtime);
    const retrieved = cache.getArtifact('REQ-CRUX-001');

    // Assert
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('REQ-CRUX-001');
    expect(retrieved!.kind).toBe('REQ');
    expect(retrieved!.raw).toEqual(artifact.raw);

    cache.close();
  });

  it('returns null for an artifact id that was never upserted', async () => {
    const cache = await openCache(dbPath());

    expect(cache.getArtifact('REQ-NONEXISTENT')).toBeNull();

    cache.close();
  });

  it('overwrites existing row on re-upsert (upsert semantics)', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    const artifact = makeArtifact('REQ-CRUX-001');
    const hash1 = sha256Of('v1');
    const mtime1 = Date.now();
    cache.upsertArtifact(artifact, hash1, mtime1);

    // Act — upsert with updated raw
    const updated: Artifact = { ...artifact, raw: { id: 'REQ-CRUX-001', text: 'Updated text' } };
    const hash2 = sha256Of('v2');
    const mtime2 = mtime1 + 1000;
    cache.upsertArtifact(updated, hash2, mtime2);

    const retrieved = cache.getArtifact('REQ-CRUX-001');

    // Assert
    expect(retrieved!.raw['text']).toBe('Updated text');

    cache.close();
  });

  it('stores the artifact path field when present', async () => {
    const cache = await openCache(dbPath());
    const artifact = makeArtifact('REQ-CRUX-002');
    artifact; // path already set to /tmp/sdlc/REQ-CRUX-002.yaml in makeArtifact

    cache.upsertArtifact(artifact, sha256Of('x'), Date.now());
    const retrieved = cache.getArtifact('REQ-CRUX-002');

    expect(retrieved!.path).toBe('/tmp/sdlc/REQ-CRUX-002.yaml');

    cache.close();
  });
});

// ===========================================================================
// SECTION 3 — getHash
// ===========================================================================

describe('getHash', () => {
  it('returns sha256 and mtime for a known artifact', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    const artifact = makeArtifact('ADR-CRUX-001', { kind: 'ADR' });
    const expectedHash = sha256Of('content-adr-001');
    const expectedMtime = 1700000000000;

    cache.upsertArtifact(artifact, expectedHash, expectedMtime);

    // Act
    const result = cache.getHash('/tmp/sdlc/ADR-CRUX-001.yaml');

    // Assert — getHash is keyed by abs path
    expect(result).not.toBeNull();
    expect(result!.sha256).toBe(expectedHash);
    expect(result!.mtime).toBe(expectedMtime);

    cache.close();
  });

  it('returns null for a path that has never been indexed', async () => {
    const cache = await openCache(dbPath());

    expect(cache.getHash('/does/not/exist.yaml')).toBeNull();

    cache.close();
  });
});

// ===========================================================================
// SECTION 4 — upsertEdges + listEdges
// ===========================================================================

describe('upsertEdges and listEdges', () => {
  it('stores edges and listEdges returns all of them without filter', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    const edges: TraceEdge[] = [
      makeEdge('REQ-001', 'GRILL-001', 'derived_from'),
      makeEdge('REQ-001', 'GRILL-002', 'derived_from'),
      makeEdge('ADR-001', 'GRILL-001', 'resolves'),
    ];

    // Act
    cache.upsertEdges('REQ-001', [edges[0]!, edges[1]!]);
    cache.upsertEdges('ADR-001', [edges[2]!]);

    const all = cache.listEdges();

    // Assert
    expect(all).toHaveLength(3);
    expect(all.map((e) => e.from).sort()).toEqual(['ADR-001', 'REQ-001', 'REQ-001'].sort());

    cache.close();
  });

  it('listEdges with from filter returns only edges from that artifact', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    cache.upsertEdges('REQ-001', [makeEdge('REQ-001', 'GRILL-001')]);
    cache.upsertEdges('REQ-002', [makeEdge('REQ-002', 'GRILL-001')]);

    // Act
    const filtered = cache.listEdges('REQ-001');

    // Assert
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.from).toBe('REQ-001');

    cache.close();
  });

  it('upsertEdges replaces existing edges for a given from_id (idempotent)', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    cache.upsertEdges('REQ-001', [makeEdge('REQ-001', 'GRILL-001')]);

    // Act — re-upsert with a different target
    cache.upsertEdges('REQ-001', [makeEdge('REQ-001', 'GRILL-002')]);
    const edges = cache.listEdges('REQ-001');

    // Assert — only the new edge exists; old one is replaced
    expect(edges).toHaveLength(1);
    expect(edges[0]!.to).toBe('GRILL-002');

    cache.close();
  });

  it('edge fields include relation and source_field', async () => {
    const cache = await openCache(dbPath());
    const edge = makeEdge('MOD-001', 'REQ-001', 'satisfies');

    cache.upsertEdges('MOD-001', [edge]);
    const [result] = cache.listEdges('MOD-001');

    expect(result!.relation).toBe('satisfies');
    expect(result!.source_field).toBe('satisfies');

    cache.close();
  });
});

// ===========================================================================
// SECTION 5 — delete
// ===========================================================================

describe('delete', () => {
  it('removes the artifact row so getArtifact returns null afterwards', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    const artifact = makeArtifact('REQ-CRUX-DEL');
    cache.upsertArtifact(artifact, sha256Of('x'), Date.now());

    // Act
    cache.delete('REQ-CRUX-DEL');

    // Assert
    expect(cache.getArtifact('REQ-CRUX-DEL')).toBeNull();

    cache.close();
  });

  it('removes outgoing edges for the deleted artifact', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    const artifact = makeArtifact('REQ-DEL-EDGE');
    cache.upsertArtifact(artifact, sha256Of('x'), Date.now());
    cache.upsertEdges('REQ-DEL-EDGE', [makeEdge('REQ-DEL-EDGE', 'GRILL-001')]);

    expect(cache.listEdges('REQ-DEL-EDGE')).toHaveLength(1);

    // Act
    cache.delete('REQ-DEL-EDGE');

    // Assert
    expect(cache.listEdges('REQ-DEL-EDGE')).toHaveLength(0);

    cache.close();
  });

  it('is idempotent — deleting a non-existent id does not throw', async () => {
    const cache = await openCache(dbPath());

    expect(() => cache.delete('NONEXISTENT-ID')).not.toThrow();

    cache.close();
  });
});

// ===========================================================================
// SECTION 6 — listArtifacts
// ===========================================================================

describe('listArtifacts', () => {
  it('returns all upserted artifacts', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    const ids = ['REQ-001', 'ADR-001', 'MOD-001', 'GRILL-001', 'TASK-001'];

    for (const id of ids) {
      const kind = id.startsWith('ADR')
        ? 'ADR'
        : id.startsWith('MOD')
          ? 'MOD'
          : id.startsWith('GRILL')
            ? 'GRILL'
            : id.startsWith('TASK')
              ? 'TASK'
              : 'REQ';
      cache.upsertArtifact(makeArtifact(id, { kind }), sha256Of(id), Date.now());
    }

    // Act
    const all = cache.listArtifacts();

    // Assert
    expect(all.map((a) => a.id).sort()).toEqual(ids.sort());

    cache.close();
  });
});

// ===========================================================================
// SECTION 7 — flush (atomic write) + openCache reload
// ===========================================================================

describe('flush', () => {
  it('writes the DB to dbPath so the file exists after flush', async () => {
    // Arrange
    const p = dbPath();
    const cache = await openCache(p);
    cache.upsertArtifact(makeArtifact('REQ-FLUSH-001'), sha256Of('x'), Date.now());

    // Act
    await cache.flush();

    // Assert
    expect(fs.existsSync(p)).toBe(true);

    cache.close();
  });

  it('reloaded cache from flushed dbPath contains all previously upserted artifacts', async () => {
    // Arrange
    const p = dbPath();
    const cache1 = await openCache(p);
    const artifact = makeArtifact('REQ-RELOAD-001');
    cache1.upsertArtifact(artifact, sha256Of('reload'), Date.now());
    await cache1.flush();
    cache1.close();

    // Act — reopen from same path
    const cache2 = await openCache(p);
    const retrieved = cache2.getArtifact('REQ-RELOAD-001');

    // Assert
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('REQ-RELOAD-001');
    expect(retrieved!.raw).toEqual(artifact.raw);

    cache2.close();
  });

  it('reloaded cache preserves edges', async () => {
    // Arrange
    const p = dbPath();
    const cache1 = await openCache(p);
    const artifact = makeArtifact('REQ-EDGE-RELOAD');
    cache1.upsertArtifact(artifact, sha256Of('x'), Date.now());
    cache1.upsertEdges('REQ-EDGE-RELOAD', [makeEdge('REQ-EDGE-RELOAD', 'GRILL-001')]);
    await cache1.flush();
    cache1.close();

    // Act
    const cache2 = await openCache(p);
    const edges = cache2.listEdges('REQ-EDGE-RELOAD');

    // Assert
    expect(edges).toHaveLength(1);
    expect(edges[0]!.to).toBe('GRILL-001');

    cache2.close();
  });

  it('flush is atomic: a temp file is NOT left behind on success', async () => {
    // Arrange
    const p = dbPath();
    const cache = await openCache(p);
    cache.upsertArtifact(makeArtifact('REQ-ATOMIC-001'), sha256Of('x'), Date.now());

    // Act
    await cache.flush();

    // Assert — no .tmp.* file remains in tmpDir
    const files = fs.readdirSync(tmpDir);
    const tmpFiles = files.filter((f) => f.includes('.tmp.'));
    expect(tmpFiles).toHaveLength(0);

    cache.close();
  });

  it('multiple flushes are idempotent and the last written state is preserved', async () => {
    // Arrange
    const p = dbPath();
    const cache = await openCache(p);
    cache.upsertArtifact(makeArtifact('REQ-MULTI-FLUSH'), sha256Of('x'), Date.now());
    await cache.flush();

    cache.upsertArtifact(makeArtifact('REQ-MULTI-FLUSH-2'), sha256Of('y'), Date.now());
    await cache.flush();
    cache.close();

    // Act
    const cache2 = await openCache(p);
    const all = cache2.listArtifacts();

    // Assert
    expect(all.map((a) => a.id).sort()).toContain('REQ-MULTI-FLUSH');
    expect(all.map((a) => a.id).sort()).toContain('REQ-MULTI-FLUSH-2');

    cache2.close();
  });
});

it('flush rejects with the rename error and leaves no .tmp.* file behind on rename failure', async () => {
  // Arrange — open the cache at a path where the target does not yet exist.
  // After opening but before the first flush, replace the target path with a
  // directory. When flush() tries to rename(.tmp.* -> targetPath), renaming a
  // file onto a directory fails (EISDIR on POSIX, EPERM/EACCES on Windows).
  const targetPath = path.join(tmpDir, 'blocked.db');

  // Open the cache (in-memory, targetPath does not exist yet).
  const cache = await openCache(targetPath);
  cache.upsertArtifact(makeArtifact('REQ-RENAME-FAIL'), sha256Of('x'), Date.now());

  // Block the rename target by creating a directory there.
  await fsp.mkdir(targetPath);

  // Act + Assert (a): flush rejects because rename-onto-directory fails.
  await expect(cache.flush()).rejects.toThrow();

  // Assert (b): no .tmp.* file remains in tmpDir after cleanup.
  const files = fs.readdirSync(tmpDir);
  const tmpFiles = files.filter((f) => f.includes('.tmp.'));
  expect(tmpFiles).toHaveLength(0);

  cache.close();
});

// ===========================================================================
// SECTION 8 — close
// ===========================================================================

describe('close', () => {
  it('allows close to be called without throwing', async () => {
    const cache = await openCache(dbPath());

    expect(() => cache.close()).not.toThrow();
  });

  it('throws or rejects on any method call after close', async () => {
    // Arrange
    const cache = await openCache(dbPath());
    cache.close();

    // Assert — at least one method must throw after close
    expect(() => cache.listArtifacts()).toThrow();
  });
});

// ===========================================================================
// SECTION 9 — openCache reloads correctly (REQ-CRUX-003 rebuild lossless)
// ===========================================================================

describe('openCache — reloads existing dbPath without data loss (REQ-CRUX-003)', () => {
  it('five artifacts upserted, flushed, then reopened are all present', async () => {
    // Arrange
    const p = dbPath();
    const cache1 = await openCache(p);
    const artifacts = Array.from({ length: 5 }, (_, i) => makeArtifact(`REQ-REBUILD-00${i + 1}`));
    const mtime = Date.now();

    for (const artifact of artifacts) {
      cache1.upsertArtifact(artifact, sha256Of(artifact.id), mtime);
    }
    await cache1.flush();
    cache1.close();

    // Act
    const cache2 = await openCache(p);
    const all = cache2.listArtifacts();

    // Assert
    expect(all).toHaveLength(5);
    const ids = all.map((a) => a.id).sort();
    expect(ids).toEqual(artifacts.map((a) => a.id).sort());

    cache2.close();
  });
});
