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

export type { TraceCache } from './cache.js';
export { openCache, CacheClosedError } from './cache.js';

export type { Indexer, IndexerOptions } from './indexer.js';
export { createIndexer } from './indexer.js';
