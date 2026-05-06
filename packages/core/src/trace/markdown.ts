/**
 * markdown.ts
 *
 * Canonical layer: read / write / scan SDLC artifact YAML files and build
 * the in-memory trace graph.  No SQLite.  No watchers.
 *
 * REQ-CRUX-003 / ADR-CRUX-002
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { Artifact, ArtifactKind, TraceEdge, TraceGraph } from './types.js';
import { stripDoubledDrivePrefix } from './path-utils.js';

// ---------------------------------------------------------------------------
// Internal: minimal YAML parser
// ---------------------------------------------------------------------------
// Handles the subset of YAML used by CRUX artifact templates:
//   - top-level key: scalar value
//   - top-level key: block scalar (|)
//   - top-level key: list of scalar items (  - item)
//   - top-level key: list of mapping items (  - subkey: value)
//   - nested mappings up to 2 levels deep under a top-level key
// Does NOT attempt to handle anchors, tags, multi-document, flow sequences
// beyond the above, or full YAML spec compliance.

type YamlScalar = string | number | boolean | null;
type YamlValue = YamlScalar | YamlValue[] | Record<string, YamlValue>;

function parseScalar(raw: string): YamlScalar {
  const trimmed = raw.trim();
  if (trimmed === 'null' || trimmed === '~') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  // Quoted string
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  // Integer
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  // Float
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  return trimmed;
}

function indentOf(line: string): number {
  let i = 0;
  while (i < line.length && line[i] === ' ') i++;
  return i;
}

/**
 * Minimal hand-rolled YAML parser sufficient for CRUX artifact files.
 * Returns a Record<string, unknown> representing the top-level mapping.
 */
export function parseYaml(text: string): Record<string, unknown> {
  const lines = text.split('\n');
  const result: Record<string, unknown> = {};

  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Skip blank lines and comments
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }

    // Top-level key (indent 0)
    if (indentOf(line) === 0) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) {
        i++;
        continue;
      }
      const key = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trimStart();

      // Block scalar: key: |
      if (rest === '|') {
        i++;
        const blockLines: string[] = [];
        while (i < lines.length) {
          const bline = lines[i] ?? '';
          if (bline.trim() === '' || indentOf(bline) > 0) {
            blockLines.push(bline.trimStart());
            i++;
          } else {
            break;
          }
        }
        result[key] = blockLines.join('\n').trimEnd() + '\n';
        continue;
      }

      // Empty value — look ahead for list items or nested mapping
      if (rest === '') {
        i++;
        const items: YamlValue[] = [];
        const nested: Record<string, YamlValue> = {};
        let isNested = false;

        while (i < lines.length) {
          const subLine = lines[i] ?? '';
          if (subLine.trim() === '' || subLine.trimStart().startsWith('#')) {
            i++;
            continue;
          }
          const subIndent = indentOf(subLine);
          if (subIndent === 0) break; // back to top level

          const subTrimmed = subLine.trimStart();

          // List item
          if (subTrimmed.startsWith('- ') || subTrimmed === '-') {
            const itemText = subTrimmed.slice(2).trimStart();
            // Check if list item is a mapping (e.g. "- key: value")
            const subColonIdx = itemText.indexOf(':');
            if (subColonIdx > 0 && !itemText.startsWith('"') && !itemText.startsWith("'")) {
              // Mapping item — collect sub-keys
              const mappingItem: Record<string, YamlValue> = {};
              const firstSubKey = itemText.slice(0, subColonIdx).trim();
              const firstSubVal = itemText.slice(subColonIdx + 1).trimStart();
              mappingItem[firstSubKey] = parseScalar(firstSubVal);
              i++;
              // Collect continuation keys at deeper indent
              while (i < lines.length) {
                const contLine = lines[i] ?? '';
                if (contLine.trim() === '' || contLine.trimStart().startsWith('#')) {
                  i++;
                  continue;
                }
                const contIndent = indentOf(contLine);
                if (contIndent <= subIndent) break;
                const contTrimmed = contLine.trimStart();
                if (contTrimmed.startsWith('- ')) break;
                const contColon = contTrimmed.indexOf(':');
                if (contColon > 0) {
                  const ck = contTrimmed.slice(0, contColon).trim();
                  const cv = contTrimmed.slice(contColon + 1).trimStart();
                  if (cv === '|') {
                    // block scalar inside mapping item
                    i++;
                    const bLines: string[] = [];
                    while (i < lines.length) {
                      const bl = lines[i] ?? '';
                      if (bl.trim() === '' || indentOf(bl) > contIndent) {
                        bLines.push(bl.trimStart());
                        i++;
                      } else {
                        break;
                      }
                    }
                    mappingItem[ck] = bLines.join('\n').trimEnd() + '\n';
                  } else {
                    mappingItem[ck] = parseScalar(cv);
                    i++;
                  }
                } else {
                  i++;
                }
              }
              items.push(mappingItem);
            } else {
              // Scalar list item
              items.push(parseScalar(itemText));
              i++;
            }
          } else {
            // Nested mapping key
            isNested = true;
            const nestedColon = subTrimmed.indexOf(':');
            if (nestedColon === -1) {
              i++;
              continue;
            }
            const nk = subTrimmed.slice(0, nestedColon).trim();
            const nv = subTrimmed.slice(nestedColon + 1).trimStart();
            if (nv === '|') {
              i++;
              const bLines: string[] = [];
              while (i < lines.length) {
                const bl = lines[i] ?? '';
                if (bl.trim() === '' || indentOf(bl) > subIndent) {
                  bLines.push(bl.trimStart());
                  i++;
                } else {
                  break;
                }
              }
              nested[nk] = bLines.join('\n').trimEnd() + '\n';
            } else if (nv === '') {
              // Sub-list or deeper nested
              i++;
              const subItems: YamlValue[] = [];
              while (i < lines.length) {
                const sl = lines[i] ?? '';
                if (sl.trim() === '' || sl.trimStart().startsWith('#')) {
                  i++;
                  continue;
                }
                if (indentOf(sl) <= subIndent) break;
                const slTrimmed = sl.trimStart();
                if (slTrimmed.startsWith('- ') || slTrimmed === '-') {
                  subItems.push(parseScalar(slTrimmed.slice(2).trimStart()));
                  i++;
                } else {
                  break;
                }
              }
              nested[nk] = subItems;
            } else {
              nested[nk] = parseScalar(nv);
              i++;
            }
          }
        }

        if (isNested) {
          result[key] = nested;
        } else {
          result[key] = items;
        }
        continue;
      }

      // Inline scalar value
      result[key] = parseScalar(rest);
      i++;
      continue;
    }

    // Non-zero indent at top scan — skip (continuation of block scalar etc.)
    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal: Windows path normalisation
// ---------------------------------------------------------------------------
// On Windows, path.resolve(new URL(import.meta.url).pathname, ...) can produce
// doubled-drive paths like "C:\C:\Dev\CRUX\...". Normalise those before any
// filesystem access.

function normaliseFilePath(filePath: string): string {
  return stripDoubledDrivePrefix(filePath);
}

// ---------------------------------------------------------------------------
// Internal: kind inference
// ---------------------------------------------------------------------------

const PREFIX_TO_KIND: ReadonlyMap<string, ArtifactKind> = new Map([
  ['REQ-', 'REQ'],
  ['ADR-', 'ADR'],
  ['MOD-', 'MOD'],
  ['GRILL-', 'GRILL'],
  ['TASK', 'TASK'], // covers both TASK.yaml and TASK-CRUX-NNN.yaml stems
  ['INC-', 'INCIDENT'],
  ['CHG-', 'CHG'],
  ['AMD-', 'AMENDMENT'],
]);

function inferKind(filename: string): ArtifactKind {
  const stem = filename.endsWith('.yaml') ? filename.slice(0, -5) : filename;
  // TASK.yaml (exact stem match) → TASK kind before any prefix loop
  if (stem === 'TASK') return 'TASK';
  for (const [prefix, kind] of PREFIX_TO_KIND) {
    if (stem.startsWith(prefix)) {
      return kind;
    }
  }
  throw new Error(
    `Cannot infer artifact kind from filename: "${filename}". ` +
      `Expected prefix: REQ-, ADR-, MOD-, GRILL-, TASK, INC-, CHG-, AMD-`,
  );
}

// ---------------------------------------------------------------------------
// readArtifact
// ---------------------------------------------------------------------------

/**
 * Parse a single SDLC artifact file and return a typed Artifact object.
 * Throws a descriptive error if the file is missing or the prefix is unknown.
 */
export function readArtifact(filePath: string): Artifact {
  const normPath = normaliseFilePath(filePath);
  let content: string;
  try {
    content = fs.readFileSync(normPath, 'utf8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`readArtifact: cannot read "${filePath}": ${msg}`);
  }

  const filename = path.basename(normPath);
  const stem = filename.endsWith('.yaml') ? filename.slice(0, -5) : filename;

  const kind = inferKind(filename);

  // For TASK.yaml, the id comes from the parent directory name.
  // For all other files, the id is the filename stem.
  let id: string;
  if (stem === 'TASK') {
    id = path.basename(path.dirname(normPath));
  } else {
    id = stem;
  }

  const raw = parseYaml(content);

  return { id, kind, path: normPath, raw };
}

// ---------------------------------------------------------------------------
// scanArtifacts
// ---------------------------------------------------------------------------

/**
 * On Windows, `path.resolve(new URL(import.meta.url).pathname, ...)` can
 * produce a doubled-drive path like `C:\C:\Dev\CRUX`.  This function detects
 * and normalises that pattern so scans work correctly.
 */
function normaliseRepoRoot(repoRoot: string): string {
  return stripDoubledDrivePrefix(repoRoot);
}

/**
 * Recursively walk the sdlc artifact tree under the given repo root and return
 * all parseable artifact files.  Looks for `docs/sdlc/` first; falls back to
 * `sdlc/` for synthetic test trees.  Returns an empty array if neither exists.
 */
export function scanArtifacts(repoRoot: string): Artifact[] {
  const normRoot = normaliseRepoRoot(repoRoot);
  const docsSdlcRoot = path.join(normRoot, 'docs', 'sdlc');
  const plainSdlcRoot = path.join(normRoot, 'sdlc');

  let sdlcRoot: string;
  if (fs.existsSync(docsSdlcRoot)) {
    sdlcRoot = docsSdlcRoot;
  } else if (fs.existsSync(plainSdlcRoot)) {
    sdlcRoot = plainSdlcRoot;
  } else {
    return [];
  }

  const artifacts: Artifact[] = [];
  const seen = new Set<string>();

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err: unknown) {
      // ENOENT is fine — directory simply does not exist yet (partial repo)
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`scanArtifacts: cannot read directory "${dir}": ${msg}`);
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        // Skip non-artifact yaml files (e.g. spec-critique.yaml, arch-critique.yaml)
        const stem = entry.name.slice(0, -5);
        let kind: ArtifactKind | null = null;
        try {
          kind = inferKind(entry.name);
        } catch {
          // Not an artifact file — skip silently
          continue;
        }

        // Determine id
        let id: string;
        if (stem === 'TASK') {
          id = path.basename(dir);
        } else {
          id = stem;
        }

        if (seen.has(id)) continue;
        seen.add(id);

        let artifact: Artifact;
        try {
          artifact = readArtifact(fullPath);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`scanArtifacts: malformed artifact at "${fullPath}": ${msg}`);
        }

        // Only include if kind matches (guard against inferKind being lenient)
        if (artifact.kind === kind) {
          artifacts.push(artifact);
        }
      }
    }
  }

  walk(sdlcRoot);
  return artifacts;
}

// ---------------------------------------------------------------------------
// Internal: YAML serialiser
// ---------------------------------------------------------------------------

function serializeYamlValue(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]\n';
    return (
      '\n' +
      value
        .map((item: unknown) => {
          if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            const entries = Object.entries(item as Record<string, unknown>);
            const first = entries[0];
            if (!first) return `${indent}- \n`;
            const [fk, fv] = first;
            const rest = entries.slice(1);
            const firstLine = `${indent}- ${fk}: ${serializeScalar(fv)}`;
            const restLines = rest
              .map(([k, v]) => `${indent}  ${k}: ${serializeScalar(v)}`)
              .join('\n');
            return restLines ? firstLine + '\n' + restLines : firstLine;
          }
          return `${indent}- ${serializeScalar(item)}`;
        })
        .join('\n') +
      '\n'
    );
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}\n';
    return '\n' + entries.map(([k, v]) => `${indent}${k}: ${serializeScalar(v)}`).join('\n') + '\n';
  }

  return serializeScalar(value) + '\n';
}

function serializeScalar(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    // Multi-line: use block scalar
    if (value.includes('\n')) {
      const lines = value.split('\n');
      const indented = lines.map((l) => (l === '' ? '' : `  ${l}`)).join('\n');
      return `|\n${indented}`;
    }
    // Strings that look like they need quoting (contain colons + spaces, or start with special chars)
    if (
      value.startsWith('"') ||
      value.startsWith("'") ||
      value.startsWith('{') ||
      value.startsWith('[') ||
      value.startsWith('*') ||
      value.startsWith('&') ||
      value.startsWith('!') ||
      /^[0-9]/.test(value) ||
      value.includes(': ') ||
      value === 'true' ||
      value === 'false' ||
      value === 'null'
    ) {
      return `'${value.replace(/'/g, "''")}'`;
    }
    return value;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Canonical key orderings per kind
// ---------------------------------------------------------------------------

const CANONICAL_KEY_ORDER: Readonly<Record<ArtifactKind, readonly string[]>> = {
  REQ: ['id', 'text', 'derived_from', 'acceptance_criteria', 'priority'],
  ADR: ['id', 'title', 'status', 'decision'],
  MOD: ['id', 'name', 'responsibility', 'surface', 'depends_on', 'derived_from'],
  GRILL: ['id', 'idea', 'gate', 'question', 'answer', 'confidence'],
  TASK: ['id', 'title', 'module', 'satisfies', 'honors_adrs', 'touches_files'],
  INCIDENT: ['id', 'title', 'severity', 'status', 'description'],
  CHG: ['id', 'title', 'status', 'summary'],
  AMENDMENT: ['id', 'title', 'status', 'change'],
};

function orderKeys(raw: Record<string, unknown>, kind: ArtifactKind): string[] {
  const canonical = CANONICAL_KEY_ORDER[kind];
  const canonicalSet = new Set(canonical);
  const extra = Object.keys(raw)
    .filter((k) => !canonicalSet.has(k))
    .sort();
  return [...canonical.filter((k) => k in raw), ...extra];
}

// ---------------------------------------------------------------------------
// writeArtifact (atomic)
// ---------------------------------------------------------------------------

/**
 * Serialise an Artifact back to YAML and write it atomically to `filePath`.
 * Uses write-to-temp → fsync → rename to avoid partial state.
 */
export function writeArtifact(filePath: string, artifact: Artifact): void {
  const keys = orderKeys(artifact.raw, artifact.kind);
  const lines: string[] = [];

  for (const key of keys) {
    const value = artifact.raw[key];
    if (Array.isArray(value)) {
      lines.push(`${key}:${serializeYamlValue(value, '  ')}`);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${key}:${serializeYamlValue(value, '  ')}`);
    } else {
      lines.push(`${key}: ${serializeScalar(value)}`);
    }
  }

  const content = lines.join('\n') + '\n';

  // Atomic write: temp file → fsync → rename
  const rand = crypto.randomBytes(6).toString('hex');
  const tmpPath = `${filePath}.tmp.${rand}`;

  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, content, 0, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  try {
    fs.renameSync(tmpPath, filePath);
  } catch (renameErr: unknown) {
    // Best-effort cleanup of the temp file; ignore secondary failure
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
    throw renameErr;
  }
}

// ---------------------------------------------------------------------------
// Artifact-id pattern for validated_by / triggered_by gating
// ---------------------------------------------------------------------------

const ARTIFACT_ID_PATTERN = /^(REQ|ADR|MOD|GRILL|TASK|INC|CHG|AMD)-[A-Z0-9-]+$/;

function isArtifactId(s: string): boolean {
  return ARTIFACT_ID_PATTERN.test(s);
}

// ---------------------------------------------------------------------------
// extractEdges
// ---------------------------------------------------------------------------

/**
 * Fields that produce edges by iterating a list (or treating a scalar as a
 * single-item list).  Each item becomes one TraceEdge.
 */
const LIST_EDGE_FIELDS: readonly string[] = [
  'derived_from',
  'satisfies',
  'honors_adrs',
  'resolves',
  'constrains',
  'superseded_artifacts',
  'supersedes',
];

/**
 * Extract all TraceEdges from a single Artifact's `raw` fields.
 */
export function extractEdges(artifact: Artifact): TraceEdge[] {
  const edges: TraceEdge[] = [];

  // Standard list-edge fields
  for (const field of LIST_EDGE_FIELDS) {
    const value = artifact.raw[field];
    if (value === undefined || value === null) continue;

    const targets: string[] = [];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') targets.push(item);
      }
    } else if (typeof value === 'string') {
      targets.push(value);
    }

    for (const to of targets) {
      edges.push({ from: artifact.id, to, relation: field, source_field: field });
    }
  }

  // validated_by — only emit edges for entries that match artifact-id pattern
  const validatedBy = artifact.raw['validated_by'];
  if (validatedBy !== undefined && validatedBy !== null) {
    const candidates: string[] = [];
    if (Array.isArray(validatedBy)) {
      for (const item of validatedBy) {
        if (typeof item === 'string') candidates.push(item);
      }
    } else if (typeof validatedBy === 'string') {
      candidates.push(validatedBy);
    }
    for (const candidate of candidates) {
      if (isArtifactId(candidate)) {
        edges.push({
          from: artifact.id,
          to: candidate,
          relation: 'validated_by',
          source_field: 'validated_by',
        });
      }
    }
  }

  // triggered_by / triggered_by_critique — only emit if value is an artifact id
  const triggeredBy = artifact.raw['triggered_by'];
  if (triggeredBy !== undefined && triggeredBy !== null) {
    const candidates: string[] = [];
    if (Array.isArray(triggeredBy)) {
      for (const item of triggeredBy) {
        if (typeof item === 'string') candidates.push(item);
      }
    } else if (typeof triggeredBy === 'string') {
      candidates.push(triggeredBy);
    }
    for (const candidate of candidates) {
      if (isArtifactId(candidate)) {
        edges.push({
          from: artifact.id,
          to: candidate,
          relation: 'triggered_by_critique',
          source_field: 'triggered_by',
        });
      }
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// buildGraph
// ---------------------------------------------------------------------------

/**
 * Build an in-memory TraceGraph from a list of artifacts.
 * - All artifacts become nodes.
 * - Edges are classified as `edges` (both endpoints present) or `dangling`
 *   (target absent from nodes).
 * Does not mutate the input array.
 */
export function buildGraph(artifacts: Readonly<Artifact[]>): TraceGraph {
  const nodes = new Map<string, Artifact>();
  for (const artifact of artifacts) {
    nodes.set(artifact.id, artifact);
  }

  const edges: TraceEdge[] = [];
  const dangling: TraceEdge[] = [];

  for (const artifact of artifacts) {
    const artifactEdges = extractEdges(artifact);
    for (const edge of artifactEdges) {
      if (nodes.has(edge.to)) {
        edges.push(edge);
      } else {
        dangling.push(edge);
      }
    }
  }

  return { nodes, edges, dangling };
}

// ---------------------------------------------------------------------------
// computeArtifactHash
// ---------------------------------------------------------------------------

/**
 * Compute the sha256 hash of a file's contents and return its mtime in ms.
 * Uses synchronous fs operations (acceptable for the canonical-layer use case).
 * Throws if the file does not exist or cannot be read.
 */
export function computeArtifactHash(filePath: string): { sha256: string; mtime: number } {
  const normPath = normaliseFilePath(filePath);
  let content: Buffer;
  let stat: fs.Stats;

  try {
    content = fs.readFileSync(normPath);
    stat = fs.statSync(normPath);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`computeArtifactHash: cannot access "${filePath}": ${msg}`);
  }

  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const mtime = Math.round(stat.mtimeMs);

  return { sha256, mtime };
}

// Re-export types for consumers that import from this module directly
export type { Artifact, ArtifactKind, TraceEdge, TraceGraph } from './types.js';
