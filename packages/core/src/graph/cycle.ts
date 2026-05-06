/**
 * cycle.ts
 *
 * Pure cycle-detection for module dependency graphs.
 * Uses iterative DFS with three-colour state to find all SCCs that are cycles,
 * then normalises each cycle to start with the lexicographically smallest node.
 *
 * REQ-CRUX-021
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ModuleNode {
  id: string;
  depends_on: string[];
}

export interface CycleReport {
  hasCycle: boolean;
  cycles?: string[][];
  unknownTargets?: { from: string; to: string }[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type Color = 'white' | 'gray' | 'black';

/**
 * Rotate an array so the smallest element comes first (for canonical form).
 */
function rotateToSmallest(arr: string[]): string[] {
  let minIdx = 0;
  for (let i = 1; i < arr.length; i++) {
    if ((arr[i] ?? '') < (arr[minIdx] ?? '')) {
      minIdx = i;
    }
  }
  return [...arr.slice(minIdx), ...arr.slice(0, minIdx)];
}

// ---------------------------------------------------------------------------
// detectCycles
// ---------------------------------------------------------------------------

/**
 * Detect all cycles in the module dependency graph.
 *
 * - Self-loops are detected as cycles of length 1 (reported as [id, id]).
 * - Edges pointing to non-existent modules are collected in unknownTargets,
 *   not treated as cycles.
 * - Output is deterministic: each cycle starts with its lexicographically
 *   smallest node; the cycles array is sorted by that first element.
 * - Input is never mutated.
 */
export function detectCycles(modules: readonly ModuleNode[]): CycleReport {
  const knownIds = new Set(modules.map((m) => m.id));

  // Collect unknown targets first (edges to non-existent nodes)
  const unknownTargets: { from: string; to: string }[] = [];
  for (const mod of modules) {
    for (const dep of mod.depends_on) {
      if (!knownIds.has(dep)) {
        unknownTargets.push({ from: mod.id, to: dep });
      }
    }
  }
  unknownTargets.sort((a, b) => {
    const cmp = a.from.localeCompare(b.from);
    return cmp !== 0 ? cmp : a.to.localeCompare(b.to);
  });

  // Build adjacency map (only known targets)
  const adj = new Map<string, string[]>();
  for (const mod of modules) {
    adj.set(
      mod.id,
      mod.depends_on.filter((dep) => knownIds.has(dep)),
    );
  }

  // DFS with three-colour cycle extraction
  const color = new Map<string, Color>();
  for (const id of knownIds) {
    color.set(id, 'white');
  }

  const rawCycles: string[][] = [];

  // Stack-based iterative DFS to avoid stack overflow on large graphs
  // For each white node, perform a DFS recording the path
  // When we reach a gray node, we've found a cycle

  function dfs(start: string): void {
    // Each stack frame: [nodeId, indexIntoNeighbors, pathSnapshot]
    type Frame = { id: string; neighborIdx: number; pathSet: Set<string>; path: string[] };
    const stack: Frame[] = [];

    if (color.get(start) !== 'white') return;

    stack.push({ id: start, neighborIdx: 0, pathSet: new Set([start]), path: [start] });
    color.set(start, 'gray');

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbors = adj.get(frame.id) ?? [];

      if (frame.neighborIdx >= neighbors.length) {
        // Done with this node
        color.set(frame.id, 'black');
        stack.pop();
        continue;
      }

      const neighbor = neighbors[frame.neighborIdx]!;
      frame.neighborIdx++;

      const neighborColor = color.get(neighbor);

      if (neighborColor === 'gray') {
        // Found a cycle — extract it from path
        const cycleStart = frame.path.indexOf(neighbor);
        const cycle = frame.path.slice(cycleStart);
        rawCycles.push([...cycle, neighbor]); // close the loop
      } else if (neighborColor === 'white') {
        color.set(neighbor, 'gray');
        const newPath = [...frame.path, neighbor];
        const newPathSet = new Set(frame.pathSet);
        newPathSet.add(neighbor);
        stack.push({ id: neighbor, neighborIdx: 0, pathSet: newPathSet, path: newPath });
      }
      // black → already fully processed, skip
    }
  }

  // Sort modules by id for deterministic traversal order
  const sortedIds = [...knownIds].sort();
  for (const id of sortedIds) {
    if (color.get(id) === 'white') {
      dfs(id);
    }
  }

  if (rawCycles.length === 0) {
    const report: CycleReport = { hasCycle: false };
    if (unknownTargets.length > 0) {
      report.unknownTargets = unknownTargets;
    }
    return report;
  }

  // Normalise: rotate each cycle so smallest id is first
  const normalisedCycles = rawCycles.map((cycle) => {
    // cycle is [...nodes, firstNodeRepeated]; strip the closing repeat before rotation
    const body = cycle.slice(0, -1);
    const rotated = rotateToSmallest(body);
    return [...rotated, rotated[0]!];
  });

  // Deduplicate cycles (same canonical form = same cycle)
  const seen = new Set<string>();
  const uniqueCycles: string[][] = [];
  for (const cycle of normalisedCycles) {
    const key = cycle.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCycles.push(cycle);
    }
  }

  // Sort cycles by their first (smallest) element
  uniqueCycles.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));

  const report: CycleReport = {
    hasCycle: true,
    cycles: uniqueCycles,
  };
  if (unknownTargets.length > 0) {
    report.unknownTargets = unknownTargets;
  }
  return report;
}
