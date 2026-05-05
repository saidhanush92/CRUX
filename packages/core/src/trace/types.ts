/**
 * types.ts
 *
 * Discriminated union and supporting types for the CRUX trace graph canonical layer.
 * REQ-CRUX-003 / ADR-CRUX-002.
 */

export type ArtifactKind =
  | 'REQ'
  | 'ADR'
  | 'MOD'
  | 'GRILL'
  | 'TASK'
  | 'INCIDENT'
  | 'CHG'
  | 'AMENDMENT';

/**
 * A single SDLC artifact parsed from a markdown/YAML file.
 * `raw` holds every top-level key from the YAML; typed accessors live
 * in markdown.ts via narrowing or destructuring.
 */
export interface Artifact {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly path?: string | undefined;
  readonly raw: Record<string, unknown>;
}

/**
 * A directed relationship between two artifact ids.
 */
export interface TraceEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly source_field: string;
}

/**
 * The in-memory trace graph produced by `buildGraph`.
 * - `nodes`    — all artifacts indexed by id
 * - `edges`    — directed edges whose `to` node is present in `nodes`
 * - `dangling` — directed edges whose `to` node is absent from `nodes`
 */
export interface TraceGraph {
  readonly nodes: Map<string, Artifact>;
  readonly edges: TraceEdge[];
  readonly dangling: TraceEdge[];
}
