/**
 * markdown.test.ts
 *
 * Locks the markdown/YAML canonical layer contract described in TASK-CRUX-002.
 * Tests cover: readArtifact, scanArtifacts, writeArtifact, extractEdges,
 * buildGraph, and computeArtifactHash.
 *
 * These tests are intentionally RED until the coder creates:
 *   packages/core/src/trace/markdown.ts
 *   packages/core/src/trace/types.ts
 *
 * Sources:
 *   - TASK-CRUX-002 (touches_files: packages/core/src/trace/*)
 *   - REQ-CRUX-003 (markdown/YAML is canonical source of truth)
 *   - ADR-CRUX-002 (markdown-canonical clauses; atomic write; sha256+mtime invalidation)
 *
 * Scope guard: NO SQLite. NO indexer / debounce / mutex.
 * Real artifact files under docs/sdlc/ serve as test fixtures where practical.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

import type { Artifact, TraceEdge, TraceGraph } from '../../src/trace/types.js';
import {
  readArtifact,
  scanArtifacts,
  writeArtifact,
  extractEdges,
  buildGraph,
  computeArtifactHash,
} from '../../src/trace/markdown.js';

// ---------------------------------------------------------------------------
// Repo root — used to resolve real fixture files without hardcoding Windows paths
// ---------------------------------------------------------------------------

// packages/core/test/trace  →  up 4 levels to repo root
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

const SDLC_ROOT = path.join(REPO_ROOT, 'docs', 'sdlc');

// ---------------------------------------------------------------------------
// Helper: create a temporary directory and clean it up after each test
// ---------------------------------------------------------------------------

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-trace-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: write a minimal artifact YAML string to a tmp file
// ---------------------------------------------------------------------------

function writeTmp(filename: string, content: string): string {
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// ===========================================================================
// SECTION 1 — Type exports
// ===========================================================================

describe('Artifact type', () => {
  it('has at minimum id, kind, and raw fields', () => {
    // If the type is wrong the assignment fails at compile-time.
    const minimal: Artifact = { id: 'REQ-CRUX-001', kind: 'REQ', raw: {} };
    expect(minimal.id).toBe('REQ-CRUX-001');
    expect(minimal.kind).toBe('REQ');
  });

  it('accepts all eight discriminated kind values', () => {
    const kinds: Artifact['kind'][] = [
      'REQ',
      'ADR',
      'MOD',
      'GRILL',
      'TASK',
      'INCIDENT',
      'CHG',
      'AMENDMENT',
    ];
    expect(kinds).toHaveLength(8);
  });
});

describe('TraceEdge type', () => {
  it('has from, to, relation, and source_field', () => {
    const edge: TraceEdge = {
      from: 'ADR-CRUX-002',
      to: 'GRILL-CRUX-003',
      relation: 'resolves',
      source_field: 'resolves',
    };
    expect(edge.from).toBe('ADR-CRUX-002');
    expect(edge.to).toBe('GRILL-CRUX-003');
    expect(edge.relation).toBe('resolves');
    expect(edge.source_field).toBe('resolves');
  });
});

describe('TraceGraph type', () => {
  it('has nodes (Map), edges (array), and dangling (array) fields', () => {
    const graph: TraceGraph = {
      nodes: new Map(),
      edges: [],
      dangling: [],
    };
    expect(graph.nodes).toBeInstanceOf(Map);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(Array.isArray(graph.dangling)).toBe(true);
  });
});

// ===========================================================================
// SECTION 2 — readArtifact
// ===========================================================================

describe('readArtifact — kind inference from filename prefix', () => {
  const cases: Array<{ prefix: string; filename: string; expectedKind: Artifact['kind'] }> = [
    { prefix: 'REQ', filename: 'REQ-CRUX-001.yaml', expectedKind: 'REQ' },
    { prefix: 'ADR', filename: 'ADR-CRUX-001.yaml', expectedKind: 'ADR' },
    { prefix: 'MOD', filename: 'MOD-CRUX-001.yaml', expectedKind: 'MOD' },
    { prefix: 'GRILL', filename: 'GRILL-CRUX-001.yaml', expectedKind: 'GRILL' },
    { prefix: 'TASK', filename: 'TASK.yaml', expectedKind: 'TASK' },
    { prefix: 'INC', filename: 'INC-CRUX-001.yaml', expectedKind: 'INCIDENT' },
    { prefix: 'CHG', filename: 'CHG-CRUX-001.yaml', expectedKind: 'CHG' },
    { prefix: 'AMD', filename: 'AMD-CRUX-001.yaml', expectedKind: 'AMENDMENT' },
  ];

  for (const { filename, expectedKind } of cases) {
    it(`infers kind '${expectedKind}' from filename '${filename}'`, () => {
      const content = `id: ${filename.replace('.yaml', '')}\ntitle: test\n`;
      const filePath = writeTmp(filename, content);
      const artifact = readArtifact(filePath);
      expect(artifact.kind).toBe(expectedKind);
    });
  }
});

describe('readArtifact — id extraction', () => {
  it('sets artifact.id to the filename stem (no extension)', () => {
    const filePath = writeTmp('REQ-CRUX-005.yaml', 'id: REQ-CRUX-005\ntext: test\n');
    const artifact = readArtifact(filePath);
    expect(artifact.id).toBe('REQ-CRUX-005');
  });

  it('TASK.yaml inside a task directory uses the directory name as id', () => {
    // e.g. docs/sdlc/tasks/TASK-CRUX-002/TASK.yaml  → id TASK-CRUX-002
    const taskDir = path.join(tmpDir, 'TASK-CRUX-002');
    fs.mkdirSync(taskDir);
    fs.writeFileSync(path.join(taskDir, 'TASK.yaml'), 'id: TASK-CRUX-002\ntitle: test\n', 'utf8');
    const artifact = readArtifact(path.join(taskDir, 'TASK.yaml'));
    expect(artifact.id).toBe('TASK-CRUX-002');
  });
});

describe('readArtifact — raw field population', () => {
  it('raw contains all top-level keys from the YAML file', () => {
    const content = [
      'id: REQ-TEST-001',
      'text: some requirement',
      'priority: must',
      'gate: 2',
    ].join('\n');
    const filePath = writeTmp('REQ-TEST-001.yaml', content);
    const artifact = readArtifact(filePath);
    expect(artifact.raw['id']).toBe('REQ-TEST-001');
    expect(artifact.raw['text']).toBe('some requirement');
    expect(artifact.raw['priority']).toBe('must');
  });

  it('raw contains list values as arrays', () => {
    const content = ['id: ADR-TEST-001', 'resolves:', '  - GRILL-001', '  - GRILL-002'].join('\n');
    const filePath = writeTmp('ADR-TEST-001.yaml', content);
    const artifact = readArtifact(filePath);
    expect(Array.isArray(artifact.raw['resolves'])).toBe(true);
    expect(artifact.raw['resolves']).toContain('GRILL-001');
    expect(artifact.raw['resolves']).toContain('GRILL-002');
  });
});

describe('readArtifact — real fixture files', () => {
  it('reads real REQ-CRUX-003.yaml and returns kind REQ with correct id', () => {
    const filePath = path.join(SDLC_ROOT, 'prd', 'REQ-CRUX-003.yaml');
    const artifact = readArtifact(filePath);
    expect(artifact.kind).toBe('REQ');
    expect(artifact.id).toBe('REQ-CRUX-003');
  });

  it('reads real ADR-CRUX-002.yaml and returns kind ADR with correct id', () => {
    const filePath = path.join(SDLC_ROOT, 'adr', 'ADR-CRUX-002.yaml');
    const artifact = readArtifact(filePath);
    expect(artifact.kind).toBe('ADR');
    expect(artifact.id).toBe('ADR-CRUX-002');
  });

  it('reads real MOD-CRUX-001.yaml and returns kind MOD', () => {
    const filePath = path.join(SDLC_ROOT, 'modules', 'MOD-CRUX-001.yaml');
    const artifact = readArtifact(filePath);
    expect(artifact.kind).toBe('MOD');
    expect(artifact.id).toBe('MOD-CRUX-001');
  });

  it('reads real GRILL-CRUX-003.yaml and returns kind GRILL', () => {
    const filePath = path.join(SDLC_ROOT, 'grill', 'GRILL-CRUX-003.yaml');
    const artifact = readArtifact(filePath);
    expect(artifact.kind).toBe('GRILL');
    expect(artifact.id).toBe('GRILL-CRUX-003');
  });

  it('reads real TASK-CRUX-002/TASK.yaml and returns kind TASK with id TASK-CRUX-002', () => {
    const filePath = path.join(SDLC_ROOT, 'tasks', 'TASK-CRUX-002', 'TASK.yaml');
    const artifact = readArtifact(filePath);
    expect(artifact.kind).toBe('TASK');
    expect(artifact.id).toBe('TASK-CRUX-002');
  });
});

describe('readArtifact — error handling', () => {
  it('throws a descriptive error when file does not exist', () => {
    const missing = path.join(tmpDir, 'REQ-MISSING.yaml');
    expect(() => readArtifact(missing)).toThrow(/REQ-MISSING/);
  });

  it('throws a descriptive error when file has unrecognized name prefix', () => {
    const filePath = writeTmp('UNKNOWN-001.yaml', 'id: UNKNOWN-001\n');
    expect(() => readArtifact(filePath)).toThrow();
  });
});

// ===========================================================================
// SECTION 3 — scanArtifacts
// ===========================================================================

describe('scanArtifacts', () => {
  it('returns an array', () => {
    const results = scanArtifacts(REPO_ROOT);
    expect(Array.isArray(results)).toBe(true);
  });

  it('returns at least one REQ artifact from the real sdlc tree', () => {
    const results = scanArtifacts(REPO_ROOT);
    const reqs = results.filter((a) => a.kind === 'REQ');
    expect(reqs.length).toBeGreaterThan(0);
  });

  it('returns at least one ADR artifact from the real sdlc tree', () => {
    const results = scanArtifacts(REPO_ROOT);
    const adrs = results.filter((a) => a.kind === 'ADR');
    expect(adrs.length).toBeGreaterThan(0);
  });

  it('returns at least one GRILL artifact from the real sdlc tree', () => {
    const results = scanArtifacts(REPO_ROOT);
    const grills = results.filter((a) => a.kind === 'GRILL');
    expect(grills.length).toBeGreaterThan(0);
  });

  it('returns at least one TASK artifact from the real sdlc tree', () => {
    const results = scanArtifacts(REPO_ROOT);
    const tasks = results.filter((a) => a.kind === 'TASK');
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('does not return duplicate ids', () => {
    const results = scanArtifacts(REPO_ROOT);
    const ids = results.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('finds REQ-CRUX-003 in the real sdlc tree', () => {
    const results = scanArtifacts(REPO_ROOT);
    const found = results.find((a) => a.id === 'REQ-CRUX-003');
    expect(found).toBeDefined();
    expect(found?.kind).toBe('REQ');
  });

  it('finds TASK-CRUX-002 in the real sdlc tree', () => {
    const results = scanArtifacts(REPO_ROOT);
    const found = results.find((a) => a.id === 'TASK-CRUX-002');
    expect(found).toBeDefined();
    expect(found?.kind).toBe('TASK');
  });

  it('returns empty array when root directory does not contain an sdlc subtree', () => {
    const emptyRoot = path.join(tmpDir, 'empty-repo');
    fs.mkdirSync(emptyRoot);
    const results = scanArtifacts(emptyRoot);
    expect(results).toEqual([]);
  });

  it('scans a synthetically created sdlc structure correctly', () => {
    // Build minimal fake sdlc tree
    const prdDir = path.join(tmpDir, 'sdlc', 'prd');
    fs.mkdirSync(prdDir, { recursive: true });
    fs.writeFileSync(path.join(prdDir, 'REQ-T-001.yaml'), 'id: REQ-T-001\ntext: test\n');
    fs.writeFileSync(path.join(prdDir, 'REQ-T-002.yaml'), 'id: REQ-T-002\ntext: test\n');

    const results = scanArtifacts(tmpDir);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('REQ-T-001');
    expect(ids).toContain('REQ-T-002');
  });
});

// ===========================================================================
// SECTION 4 — writeArtifact
// ===========================================================================

describe('writeArtifact — basic round-trip', () => {
  it('writes an artifact and the file exists afterwards', () => {
    const artifact: Artifact = {
      id: 'REQ-TEST-001',
      kind: 'REQ',
      raw: { id: 'REQ-TEST-001', text: 'hello', priority: 'must' },
    };
    const dest = path.join(tmpDir, 'REQ-TEST-001.yaml');
    writeArtifact(dest, artifact);
    expect(fs.existsSync(dest)).toBe(true);
  });

  it('written file can be read back by readArtifact with matching id and kind', () => {
    const artifact: Artifact = {
      id: 'REQ-TEST-002',
      kind: 'REQ',
      raw: { id: 'REQ-TEST-002', text: 'round-trip test', priority: 'should' },
    };
    const dest = path.join(tmpDir, 'REQ-TEST-002.yaml');
    writeArtifact(dest, artifact);
    const recovered = readArtifact(dest);
    expect(recovered.id).toBe('REQ-TEST-002');
    expect(recovered.kind).toBe('REQ');
  });

  it('round-trips all scalar raw values losslessly', () => {
    const raw = {
      id: 'ADR-TEST-001',
      title: 'Some decision',
      status: 'accepted',
    };
    const artifact: Artifact = { id: 'ADR-TEST-001', kind: 'ADR', raw };
    const dest = path.join(tmpDir, 'ADR-TEST-001.yaml');
    writeArtifact(dest, artifact);
    const recovered = readArtifact(dest);
    expect(recovered.raw['title']).toBe('Some decision');
    expect(recovered.raw['status']).toBe('accepted');
  });

  it('round-trips list values losslessly', () => {
    const raw = {
      id: 'ADR-TEST-002',
      resolves: ['GRILL-001', 'GRILL-002'],
      satisfies: ['REQ-001'],
    };
    const artifact: Artifact = { id: 'ADR-TEST-002', kind: 'ADR', raw };
    const dest = path.join(tmpDir, 'ADR-TEST-002.yaml');
    writeArtifact(dest, artifact);
    const recovered = readArtifact(dest);
    expect(recovered.raw['resolves']).toContain('GRILL-001');
    expect(recovered.raw['resolves']).toContain('GRILL-002');
    expect(recovered.raw['satisfies']).toContain('REQ-001');
  });
});

describe('writeArtifact — atomic write semantics (ADR-CRUX-002)', () => {
  it('does not leave a .tmp file behind after a successful write', () => {
    const artifact: Artifact = {
      id: 'REQ-ATOMIC-001',
      kind: 'REQ',
      raw: { id: 'REQ-ATOMIC-001', text: 'atomic test' },
    };
    const dest = path.join(tmpDir, 'REQ-ATOMIC-001.yaml');
    writeArtifact(dest, artifact);
    const tmpFile = dest + '.tmp';
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it('produces a final file at the exact target path, not a .tmp path', () => {
    const artifact: Artifact = {
      id: 'REQ-ATOMIC-002',
      kind: 'REQ',
      raw: { id: 'REQ-ATOMIC-002', text: 'atomic path test' },
    };
    const dest = path.join(tmpDir, 'REQ-ATOMIC-002.yaml');
    writeArtifact(dest, artifact);
    expect(fs.existsSync(dest)).toBe(true);
  });

  it('overwrites an existing file atomically (no partial state visible)', () => {
    const initial: Artifact = {
      id: 'REQ-OVERWRITE-001',
      kind: 'REQ',
      raw: { id: 'REQ-OVERWRITE-001', text: 'initial' },
    };
    const dest = path.join(tmpDir, 'REQ-OVERWRITE-001.yaml');
    writeArtifact(dest, initial);

    const updated: Artifact = {
      id: 'REQ-OVERWRITE-001',
      kind: 'REQ',
      raw: { id: 'REQ-OVERWRITE-001', text: 'updated' },
    };
    writeArtifact(dest, updated);
    const recovered = readArtifact(dest);
    expect(recovered.raw['text']).toBe('updated');
  });
});

describe('writeArtifact — canonical key ordering per kind', () => {
  it('emits REQ keys in id → text → derived_from → acceptance_criteria → priority order', () => {
    const raw = {
      priority: 'must',
      text: 'some req',
      id: 'REQ-ORDER-001',
      derived_from: ['GRILL-001'],
      acceptance_criteria: ['AC one'],
    };
    const artifact: Artifact = { id: 'REQ-ORDER-001', kind: 'REQ', raw };
    const dest = path.join(tmpDir, 'REQ-ORDER-001.yaml');
    writeArtifact(dest, artifact);
    const content = fs.readFileSync(dest, 'utf8');
    const idPos = content.indexOf('id:');
    const textPos = content.indexOf('text:');
    const priorityPos = content.indexOf('priority:');
    // id must appear before text; text before priority
    expect(idPos).toBeLessThan(textPos);
    expect(textPos).toBeLessThan(priorityPos);
  });

  it('emits ADR keys in id → title → status → decision order', () => {
    const raw = {
      status: 'accepted',
      decision: 'some decision',
      id: 'ADR-ORDER-001',
      title: 'A decision',
    };
    const artifact: Artifact = { id: 'ADR-ORDER-001', kind: 'ADR', raw };
    const dest = path.join(tmpDir, 'ADR-ORDER-001.yaml');
    writeArtifact(dest, artifact);
    const content = fs.readFileSync(dest, 'utf8');
    const idPos = content.indexOf('id:');
    const titlePos = content.indexOf('title:');
    const statusPos = content.indexOf('status:');
    expect(idPos).toBeLessThan(titlePos);
    expect(titlePos).toBeLessThan(statusPos);
  });

  it('appends unknown extra fields after canonical keys, in alphabetical order', () => {
    const raw = {
      id: 'REQ-EXTRA-001',
      text: 'some req',
      zzz_custom: 'last',
      aaa_custom: 'extra field',
    };
    const artifact: Artifact = { id: 'REQ-EXTRA-001', kind: 'REQ', raw };
    const dest = path.join(tmpDir, 'REQ-EXTRA-001.yaml');
    writeArtifact(dest, artifact);
    const content = fs.readFileSync(dest, 'utf8');
    const idPos = content.indexOf('id:');
    const aaaPos = content.indexOf('aaa_custom:');
    const zzzPos = content.indexOf('zzz_custom:');
    // Canonical 'id' appears first; extra fields come after; aaa before zzz
    expect(idPos).toBeLessThan(aaaPos);
    expect(aaaPos).toBeLessThan(zzzPos);
  });
});

// ===========================================================================
// SECTION 5 — extractEdges
// ===========================================================================

describe('extractEdges — derived_from edges (artifact → grill)', () => {
  it('produces derived_from edges for a REQ with derived_from list', () => {
    const artifact: Artifact = {
      id: 'REQ-CRUX-003',
      kind: 'REQ',
      raw: { id: 'REQ-CRUX-003', derived_from: ['GRILL-CRUX-003'] },
    };
    const edges = extractEdges(artifact);
    const edge = edges.find((e) => e.relation === 'derived_from');
    expect(edge).toBeDefined();
    expect(edge?.from).toBe('REQ-CRUX-003');
    expect(edge?.to).toBe('GRILL-CRUX-003');
    expect(edge?.source_field).toBe('derived_from');
  });

  it('produces one derived_from edge per item in derived_from list', () => {
    const artifact: Artifact = {
      id: 'MOD-TEST-001',
      kind: 'MOD',
      raw: { id: 'MOD-TEST-001', derived_from: ['REQ-001', 'REQ-002', 'REQ-003'] },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'derived_from');
    expect(edges).toHaveLength(3);
    const tos = edges.map((e) => e.to);
    expect(tos).toContain('REQ-001');
    expect(tos).toContain('REQ-002');
    expect(tos).toContain('REQ-003');
  });
});

describe('extractEdges — satisfies edges (artifact → req)', () => {
  it('produces satisfies edges for an ADR with satisfies list', () => {
    const artifact: Artifact = {
      id: 'ADR-CRUX-002',
      kind: 'ADR',
      raw: { id: 'ADR-CRUX-002', satisfies: ['REQ-CRUX-003', 'REQ-CRUX-004'] },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'satisfies');
    expect(edges).toHaveLength(2);
    expect(edges[0]?.from).toBe('ADR-CRUX-002');
  });
});

describe('extractEdges — resolves edges', () => {
  it('produces resolves edges for an ADR with resolves list', () => {
    const artifact: Artifact = {
      id: 'ADR-CRUX-002',
      kind: 'ADR',
      raw: { id: 'ADR-CRUX-002', resolves: ['GRILL-CRUX-003'] },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'resolves');
    expect(edges).toHaveLength(1);
    expect(edges[0]?.to).toBe('GRILL-CRUX-003');
  });
});

describe('extractEdges — constrains edges', () => {
  it('produces constrains edges for an ADR with constrains list', () => {
    const artifact: Artifact = {
      id: 'ADR-CRUX-002',
      kind: 'ADR',
      raw: { id: 'ADR-CRUX-002', constrains: ['MOD-CRUX-001'] },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'constrains');
    expect(edges).toHaveLength(1);
    expect(edges[0]?.to).toBe('MOD-CRUX-001');
    expect(edges[0]?.source_field).toBe('constrains');
  });
});

describe('extractEdges — honors_adrs edges (TASK artifact)', () => {
  it('produces honors_adrs edges for a TASK with honors_adrs list', () => {
    const artifact: Artifact = {
      id: 'TASK-CRUX-002',
      kind: 'TASK',
      raw: { id: 'TASK-CRUX-002', honors_adrs: ['ADR-CRUX-002'] },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'honors_adrs');
    expect(edges).toHaveLength(1);
    expect(edges[0]?.from).toBe('TASK-CRUX-002');
    expect(edges[0]?.to).toBe('ADR-CRUX-002');
  });
});

describe('extractEdges — superseded_artifacts / supersedes edges', () => {
  it('produces superseded_artifacts edges for CHG with superseded_artifacts list', () => {
    const artifact: Artifact = {
      id: 'CHG-TEST-001',
      kind: 'CHG',
      raw: { id: 'CHG-TEST-001', superseded_artifacts: ['REQ-OLD-001', 'ADR-OLD-001'] },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'superseded_artifacts');
    expect(edges).toHaveLength(2);
  });

  it('produces supersedes edge when supersedes field is set on a GRILL', () => {
    const artifact: Artifact = {
      id: 'GRILL-TEST-002',
      kind: 'GRILL',
      raw: { id: 'GRILL-TEST-002', supersedes: 'GRILL-TEST-001' },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'supersedes');
    expect(edges).toHaveLength(1);
    expect(edges[0]?.to).toBe('GRILL-TEST-001');
  });
});

describe('extractEdges — triggered_by_critique edges (AMENDMENT)', () => {
  it('produces triggered_by_critique edge when triggered_by field names an artifact id', () => {
    const artifact: Artifact = {
      id: 'AMD-TEST-001',
      kind: 'AMENDMENT',
      raw: { id: 'AMD-TEST-001', triggered_by: 'incident', target_skill: 'tdd-workflow' },
    };
    // 'incident' is a keyword, not an artifact id → no edge expected
    const edges = extractEdges(artifact).filter((e) => e.relation === 'triggered_by_critique');
    expect(edges).toHaveLength(0);
  });
});

describe('extractEdges — validated_by edges (free string, artifact-id gating)', () => {
  it('produces validated_by edge when validated_by entry matches artifact id pattern', () => {
    const artifact: Artifact = {
      id: 'ADR-CRUX-002',
      kind: 'ADR',
      raw: {
        id: 'ADR-CRUX-002',
        validated_by: ['TASK-CRUX-009', 'some free-form CI check string'],
      },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'validated_by');
    // Only 'TASK-CRUX-009' matches the artifact id pattern; the free-form string is skipped
    expect(edges).toHaveLength(1);
    expect(edges[0]?.to).toBe('TASK-CRUX-009');
    expect(edges[0]?.source_field).toBe('validated_by');
  });

  it('skips non-artifact-id validated_by entries without error', () => {
    const artifact: Artifact = {
      id: 'ADR-TEST-003',
      kind: 'ADR',
      raw: {
        id: 'ADR-TEST-003',
        validated_by: ['pnpm -r build succeeds in CI', 'arch-critic concern-group expansion check'],
      },
    };
    expect(() => extractEdges(artifact)).not.toThrow();
    const edges = extractEdges(artifact).filter((e) => e.relation === 'validated_by');
    expect(edges).toHaveLength(0);
  });

  it('handles validated_by as a scalar string that matches an artifact id pattern', () => {
    const artifact: Artifact = {
      id: 'ADR-TEST-004',
      kind: 'ADR',
      raw: { id: 'ADR-TEST-004', validated_by: 'TASK-CRUX-007' },
    };
    const edges = extractEdges(artifact).filter((e) => e.relation === 'validated_by');
    expect(edges).toHaveLength(1);
    expect(edges[0]?.to).toBe('TASK-CRUX-007');
  });
});

describe('extractEdges — real ADR-CRUX-002 fixture', () => {
  it('extracts at least resolves, satisfies, constrains edges from ADR-CRUX-002', () => {
    const filePath = path.join(SDLC_ROOT, 'adr', 'ADR-CRUX-002.yaml');
    const artifact = readArtifact(filePath);
    const edges = extractEdges(artifact);

    const relations = new Set(edges.map((e) => e.relation));
    expect(relations.has('resolves')).toBe(true);
    expect(relations.has('satisfies')).toBe(true);
    expect(relations.has('constrains')).toBe(true);
  });

  it('resolves edge from ADR-CRUX-002 points to GRILL-CRUX-003', () => {
    const filePath = path.join(SDLC_ROOT, 'adr', 'ADR-CRUX-002.yaml');
    const artifact = readArtifact(filePath);
    const edges = extractEdges(artifact);
    const resolvesEdge = edges.find((e) => e.relation === 'resolves' && e.to === 'GRILL-CRUX-003');
    expect(resolvesEdge).toBeDefined();
  });
});

describe('extractEdges — real REQ-CRUX-003 fixture', () => {
  it('extracts derived_from edge pointing to GRILL-CRUX-003', () => {
    const filePath = path.join(SDLC_ROOT, 'prd', 'REQ-CRUX-003.yaml');
    const artifact = readArtifact(filePath);
    const edges = extractEdges(artifact);
    const edge = edges.find((e) => e.relation === 'derived_from' && e.to === 'GRILL-CRUX-003');
    expect(edge).toBeDefined();
    expect(edge?.from).toBe('REQ-CRUX-003');
  });
});

describe('extractEdges — empty / minimal artifact', () => {
  it('returns empty array for artifact with no relational fields', () => {
    const artifact: Artifact = {
      id: 'REQ-BARE-001',
      kind: 'REQ',
      raw: { id: 'REQ-BARE-001', text: 'just a req' },
    };
    const edges = extractEdges(artifact);
    expect(edges).toEqual([]);
  });

  it('does not throw when all relational fields are absent', () => {
    const artifact: Artifact = { id: 'GRILL-BARE-001', kind: 'GRILL', raw: {} };
    expect(() => extractEdges(artifact)).not.toThrow();
  });
});

// ===========================================================================
// SECTION 6 — buildGraph
// ===========================================================================

describe('buildGraph — basic construction', () => {
  it('returns a TraceGraph with nodes, edges, and dangling properties', () => {
    const graph = buildGraph([]);
    expect(graph.nodes).toBeInstanceOf(Map);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(Array.isArray(graph.dangling)).toBe(true);
  });

  it('nodes map contains all supplied artifact ids', () => {
    const artifacts: Artifact[] = [
      { id: 'REQ-T-001', kind: 'REQ', raw: { id: 'REQ-T-001', derived_from: ['GRILL-T-001'] } },
      { id: 'GRILL-T-001', kind: 'GRILL', raw: { id: 'GRILL-T-001' } },
    ];
    const graph = buildGraph(artifacts);
    expect(graph.nodes.has('REQ-T-001')).toBe(true);
    expect(graph.nodes.has('GRILL-T-001')).toBe(true);
  });

  it('nodes map values are the original artifact objects', () => {
    const artifact: Artifact = {
      id: 'REQ-T-002',
      kind: 'REQ',
      raw: { id: 'REQ-T-002' },
    };
    const graph = buildGraph([artifact]);
    expect(graph.nodes.get('REQ-T-002')).toBe(artifact);
  });

  it('edges include directed edges from all artifacts', () => {
    const artifacts: Artifact[] = [
      { id: 'REQ-T-003', kind: 'REQ', raw: { id: 'REQ-T-003', derived_from: ['GRILL-T-003'] } },
      { id: 'GRILL-T-003', kind: 'GRILL', raw: { id: 'GRILL-T-003' } },
    ];
    const graph = buildGraph(artifacts);
    const edge = graph.edges.find(
      (e) => e.from === 'REQ-T-003' && e.to === 'GRILL-T-003' && e.relation === 'derived_from',
    );
    expect(edge).toBeDefined();
  });
});

describe('buildGraph — dangling edges (edge targets missing from nodes)', () => {
  it('places edges whose target is absent in the dangling array', () => {
    const artifacts: Artifact[] = [
      { id: 'REQ-T-004', kind: 'REQ', raw: { id: 'REQ-T-004', derived_from: ['GRILL-MISSING'] } },
    ];
    const graph = buildGraph(artifacts);
    const dangling = graph.dangling.find((e) => e.from === 'REQ-T-004' && e.to === 'GRILL-MISSING');
    expect(dangling).toBeDefined();
  });

  it('does not put dangling edges into the primary edges array', () => {
    const artifacts: Artifact[] = [
      { id: 'ADR-T-001', kind: 'ADR', raw: { id: 'ADR-T-001', resolves: ['GRILL-ABSENT'] } },
    ];
    const graph = buildGraph(artifacts);
    const inEdges = graph.edges.find((e) => e.to === 'GRILL-ABSENT');
    expect(inEdges).toBeUndefined();
  });

  it('edges between present nodes are NOT placed in dangling', () => {
    const artifacts: Artifact[] = [
      { id: 'REQ-T-005', kind: 'REQ', raw: { id: 'REQ-T-005', derived_from: ['GRILL-T-005'] } },
      { id: 'GRILL-T-005', kind: 'GRILL', raw: { id: 'GRILL-T-005' } },
    ];
    const graph = buildGraph(artifacts);
    const dangling = graph.dangling.find((e) => e.to === 'GRILL-T-005');
    expect(dangling).toBeUndefined();
  });
});

describe('buildGraph — idempotency', () => {
  it('calling buildGraph twice with the same input produces equivalent graphs', () => {
    const artifacts: Artifact[] = [
      { id: 'REQ-T-006', kind: 'REQ', raw: { id: 'REQ-T-006', derived_from: ['GRILL-T-006'] } },
      { id: 'GRILL-T-006', kind: 'GRILL', raw: { id: 'GRILL-T-006' } },
    ];
    const graph1 = buildGraph(artifacts);
    const graph2 = buildGraph(artifacts);

    expect(graph1.nodes.size).toBe(graph2.nodes.size);
    expect(graph1.edges.length).toBe(graph2.edges.length);
    expect(graph1.dangling.length).toBe(graph2.dangling.length);
  });

  it('does not mutate the input artifact array', () => {
    const artifacts: Artifact[] = [{ id: 'REQ-T-007', kind: 'REQ', raw: { id: 'REQ-T-007' } }];
    const originalLength = artifacts.length;
    buildGraph(artifacts);
    expect(artifacts.length).toBe(originalLength);
  });
});

describe('buildGraph — real sdlc corpus', () => {
  it('builds a graph from all real artifacts without throwing', () => {
    const artifacts = scanArtifacts(REPO_ROOT);
    expect(() => buildGraph(artifacts)).not.toThrow();
  });

  it('graph from real sdlc corpus has at least one resolves edge', () => {
    const artifacts = scanArtifacts(REPO_ROOT);
    const graph = buildGraph(artifacts);
    const resolvesEdge = graph.edges.find((e) => e.relation === 'resolves');
    expect(resolvesEdge).toBeDefined();
  });

  it('graph from real sdlc corpus has GRILL-CRUX-003 as a node', () => {
    const artifacts = scanArtifacts(REPO_ROOT);
    const graph = buildGraph(artifacts);
    expect(graph.nodes.has('GRILL-CRUX-003')).toBe(true);
  });
});

// ===========================================================================
// SECTION 7 — computeArtifactHash
// ===========================================================================

describe('computeArtifactHash', () => {
  it('returns an object with sha256 (string) and mtime (number)', () => {
    const filePath = path.join(SDLC_ROOT, 'prd', 'REQ-CRUX-003.yaml');
    const result = computeArtifactHash(filePath);
    expect(typeof result.sha256).toBe('string');
    expect(typeof result.mtime).toBe('number');
  });

  it('sha256 is a 64-character lowercase hex string', () => {
    const filePath = path.join(SDLC_ROOT, 'adr', 'ADR-CRUX-002.yaml');
    const { sha256 } = computeArtifactHash(filePath);
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('mtime is a positive integer (milliseconds since epoch)', () => {
    const filePath = path.join(SDLC_ROOT, 'prd', 'REQ-CRUX-003.yaml');
    const { mtime } = computeArtifactHash(filePath);
    expect(mtime).toBeGreaterThan(0);
    expect(Number.isInteger(mtime)).toBe(true);
  });

  it('returns the same sha256 when called twice on an unchanged file', () => {
    const filePath = path.join(SDLC_ROOT, 'modules', 'MOD-CRUX-001.yaml');
    const first = computeArtifactHash(filePath);
    const second = computeArtifactHash(filePath);
    expect(first.sha256).toBe(second.sha256);
  });

  it('sha256 changes when file content changes', () => {
    const filePath = writeTmp('REQ-HASH-TEST.yaml', 'id: REQ-HASH-TEST\ntext: version 1\n');
    const before = computeArtifactHash(filePath);

    // Overwrite with different content
    fs.writeFileSync(filePath, 'id: REQ-HASH-TEST\ntext: version 2\n', 'utf8');
    const after = computeArtifactHash(filePath);

    expect(before.sha256).not.toBe(after.sha256);
  });

  it('two different files with different content have different sha256 hashes', () => {
    const f1 = writeTmp('REQ-DIFF-001.yaml', 'id: REQ-DIFF-001\ntext: aaa\n');
    const f2 = writeTmp('REQ-DIFF-002.yaml', 'id: REQ-DIFF-002\ntext: bbb\n');
    const h1 = computeArtifactHash(f1);
    const h2 = computeArtifactHash(f2);
    expect(h1.sha256).not.toBe(h2.sha256);
  });

  it('throws a descriptive error when file does not exist', () => {
    const missing = path.join(tmpDir, 'REQ-NONEXISTENT.yaml');
    expect(() => computeArtifactHash(missing)).toThrow();
  });
});

// ===========================================================================
// SECTION 8 — REQ-CRUX-003 canonical storage contract
// ===========================================================================

describe('REQ-CRUX-003 contract — every trace edge is recoverable from markdown', () => {
  it('every edge in the real sdlc graph can be attributed to a source artifact file', () => {
    const artifacts = scanArtifacts(REPO_ROOT);
    const graph = buildGraph(artifacts);

    for (const edge of graph.edges) {
      // The from node must exist — proves the edge comes from a parsed file
      expect(graph.nodes.has(edge.from)).toBe(true);
    }
  });

  it('no artifact data exists only in memory — every node comes from a scannable file', () => {
    const artifacts = scanArtifacts(REPO_ROOT);
    // All ids must be discoverable through the standard scan
    const scannedIds = new Set(artifacts.map((a) => a.id));
    const graph = buildGraph(artifacts);
    for (const [id] of graph.nodes) {
      expect(scannedIds.has(id)).toBe(true);
    }
  });
});
