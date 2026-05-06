import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { listFilesRecursive, readTextIfExists, readYamlFile } from '../../lib/fs.js';

const PREFIX_MAP: Readonly<Record<string, string>> = {
  IDEA: 'docs/sdlc/input',
  GRILL: 'docs/sdlc/grill',
  REQ: 'docs/sdlc/prd',
  MOD: 'docs/sdlc/modules',
  ADR: 'docs/sdlc/adr',
  TASK: 'docs/sdlc/tasks',
  CHG: 'docs/sdlc/chg',
  INC: 'docs/sdlc/incidents',
  AMD: 'docs/sdlc/amendments',
};

interface ArtifactNode {
  readonly id: string;
  readonly filePath: string;
  readonly data: Record<string, unknown>;
}

async function loadAllArtifacts(rootDir: string): Promise<ArtifactNode[]> {
  const sdlcDir = path.join(rootDir, 'docs', 'sdlc');
  const files = await listFilesRecursive(sdlcDir);
  const nodes: ArtifactNode[] = [];

  for (const filePath of files) {
    const basename = path.basename(filePath);
    if (basename.endsWith('.yaml') || basename.endsWith('.yml')) {
      try {
        const data = await readYamlFile(filePath);
        const id = typeof data['id'] === 'string' ? data['id'] : null;
        if (id) {
          nodes.push({ id, filePath, data });
        }
        // Also index critique files that have a `critiques` array
        if (!id && Array.isArray(data['critiques'])) {
          for (const critique of data['critiques']) {
            if (typeof critique === 'object' && critique !== null) {
              const critiqueRec = critique as Record<string, unknown>;
              const critiqueId = typeof critiqueRec['id'] === 'string' ? critiqueRec['id'] : null;
              if (critiqueId) {
                nodes.push({ id: critiqueId, filePath, data: critiqueRec });
              }
            }
          }
        }
      } catch {
        // skip unparseable files
      }
    } else if (basename.endsWith('.md') && basename.startsWith('IDEA-')) {
      const raw = (await readTextIfExists(filePath)) ?? '';
      const idMatch = /^id:\s*(.+)$/mu.exec(raw);
      if (idMatch?.[1]) {
        nodes.push({ id: idMatch[1].trim(), filePath, data: {} });
      }
    }
  }

  return nodes;
}

function extractReferencedIds(data: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const fields = [
    'derived_from',
    'satisfies',
    'honors_adrs',
    'target',
    'idea',
    'chg_events_opened',
    'prevention_tasks',
    'amendment_ids',
  ];

  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string') {
      // Handle flow sequences like "[REQ-001, REQ-002]"
      if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1);
        for (const part of inner.split(',')) {
          const trimmed = part.trim();
          if (/^[A-Z]+-/.test(trimmed)) {
            ids.push(trimmed);
          }
        }
      } else if (/^[A-Z]+-/.test(value)) {
        ids.push(value);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && /^[A-Z]+-/.test(item)) {
          ids.push(item);
        }
      }
    }
  }

  return ids;
}

function extractTouchesFiles(data: Record<string, unknown>): string[] {
  const value = data['touches_files'];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function findUpstream(targetId: string, allNodes: ArtifactNode[]): ArtifactNode[] {
  const targetNode = allNodes.find((n) => n.id === targetId);
  if (!targetNode) return [];

  const refs = extractReferencedIds(targetNode.data);
  const upstream: ArtifactNode[] = [];

  for (const refId of refs) {
    const node = allNodes.find((n) => n.id === refId);
    if (node) {
      upstream.push(node, ...findUpstream(node.id, allNodes));
    }
  }

  return upstream;
}

function findDownstream(targetId: string, allNodes: ArtifactNode[]): ArtifactNode[] {
  const downstream: ArtifactNode[] = [];

  for (const node of allNodes) {
    const refs = extractReferencedIds(node.data);
    if (refs.includes(targetId)) {
      downstream.push(node);
    }
  }

  return downstream;
}

function findCritiques(targetId: string, allNodes: ArtifactNode[]): ArtifactNode[] {
  const critiques: ArtifactNode[] = [];

  for (const node of allNodes) {
    const critiquesArr = node.data['critiques'];
    if (!Array.isArray(critiquesArr)) continue;

    for (const critique of critiquesArr) {
      if (typeof critique !== 'object' || critique === null) continue;
      const target = (critique as Record<string, unknown>)['target'];
      const critiqueId = (critique as Record<string, unknown>)['id'];
      if (Array.isArray(target) && target.includes(targetId) && typeof critiqueId === 'string') {
        critiques.push({
          id: critiqueId,
          filePath: node.filePath,
          data: critique as Record<string, unknown>,
        });
      }
    }
  }

  return critiques;
}

function findOrphans(allNodes: ArtifactNode[], knownIds: Set<string>): string[] {
  const orphans = new Set<string>();

  for (const node of allNodes) {
    const refs = extractReferencedIds(node.data);
    for (const refId of refs) {
      if (!knownIds.has(refId)) {
        orphans.add(refId);
      }
    }
  }

  return [...orphans].sort();
}

function renderPrefixMap(): string {
  return Object.entries(PREFIX_MAP)
    .map(([prefix, dir]) => `  ${prefix} -> ${dir}`)
    .join('\n');
}

export function createTraceCommand() {
  return async function traceCommand(
    args: readonly string[],
    context: CliContext,
  ): Promise<CommandResult> {
    const [artifactId] = args;
    if (!artifactId) {
      return { exitCode: 1, stdout: '', stderr: 'Pass an artifact id to /crux-trace.' };
    }

    const allNodes = await loadAllArtifacts(context.rootDir);
    const knownIds = new Set(allNodes.map((n) => n.id));

    const targetNode = allNodes.find((n) => n.id === artifactId);
    if (!targetNode) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Artifact not found: ${artifactId}\n\nPrefix map:\n${renderPrefixMap()}`,
      };
    }

    const upstream = findUpstream(artifactId, allNodes);
    const downstream = findDownstream(artifactId, allNodes);
    const critiques = findCritiques(artifactId, allNodes);
    const touchesFiles = [
      ...extractTouchesFiles(targetNode.data),
      ...downstream.flatMap((n) => extractTouchesFiles(n.data)),
    ];

    // Collect all IDs involved in the trace
    const involvedNodes = [targetNode, ...upstream, ...downstream];
    const involvedOrphans = findOrphans(involvedNodes, knownIds);

    const lines: string[] = [];

    lines.push('UPSTREAM');
    const seenUp = new Set<string>();
    for (const node of [...upstream].reverse()) {
      if (seenUp.has(node.id)) continue;
      seenUp.add(node.id);
      lines.push(`└── ${node.id}`);
    }
    lines.push(`└── ${artifactId}  (target)`);

    if (critiques.length > 0) {
      lines.push('');
      lines.push('Critiques');
      for (const c of critiques) {
        lines.push(`  ${c.id}  ${String(c.data['finding'] ?? '').trim()}`);
      }
    }

    lines.push('');
    lines.push('DOWNSTREAM');
    lines.push(`└── ${artifactId}`);
    const seenDown = new Set<string>();
    for (const node of downstream) {
      if (seenDown.has(node.id)) continue;
      seenDown.add(node.id);
      lines.push(`    └── ${node.id}  ${path.basename(node.filePath)}`);
    }

    if (touchesFiles.length > 0) {
      lines.push('');
      lines.push('Touches');
      for (const file of touchesFiles) {
        lines.push(`  ${file}`);
      }
    }

    if (involvedOrphans.length > 0) {
      lines.push('');
      lines.push('Orphan markers');
      for (const orphanId of involvedOrphans) {
        lines.push(`  ${orphanId}  (referenced but not found)`);
      }
    }

    lines.push('');
    lines.push(`Total nodes visited: ${1 + seenUp.size + seenDown.size}`);

    return {
      exitCode: 0,
      stdout: lines.join('\n') + '\n',
      stderr: '',
    };
  };
}

export async function runTraceCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  return createTraceCommand()(args, context);
}
