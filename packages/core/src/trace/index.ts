/**
 * index.ts — barrel for the trace canonical layer
 */

export type { Artifact, ArtifactKind, TraceEdge, TraceGraph } from './types.js';
export {
  readArtifact,
  scanArtifacts,
  writeArtifact,
  extractEdges,
  buildGraph,
  computeArtifactHash,
} from './markdown.js';
