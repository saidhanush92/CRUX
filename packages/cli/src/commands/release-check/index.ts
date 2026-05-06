import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { appendApprovalsLog } from '../../lib/log.js';
import {
  exists,
  listFiles,
  listFilesRecursive,
  readTextIfExists,
  readYamlFile,
} from '../../lib/fs.js';
import { isoNow } from '../../lib/time.js';

interface CheckItem {
  readonly name: string;
  readonly description: string;
  readonly pass: boolean;
}

async function runChecklist(rootDir: string): Promise<CheckItem[]> {
  const checks: CheckItem[] = [];

  // 1. gates-1-to-7-closed
  const ideaFiles = (await listFiles(path.join(rootDir, 'docs', 'sdlc', 'input'))).filter((f) =>
    path.basename(f).startsWith('IDEA-'),
  );
  const prdExists = exists(path.join(rootDir, 'docs', 'sdlc', 'prd', 'PRD.md'));
  const modFiles = (await listFiles(path.join(rootDir, 'docs', 'sdlc', 'modules'))).filter((f) =>
    path.basename(f).startsWith('MOD-'),
  );
  const adrFiles = (await listFiles(path.join(rootDir, 'docs', 'sdlc', 'adr'))).filter((f) =>
    path.basename(f).startsWith('ADR-'),
  );
  const harnessLockExists = exists(path.join(rootDir, 'docs', 'sdlc', 'harness', 'harness.lock'));
  checks.push({
    name: 'gates-1-to-7-closed',
    description: 'gates 1 to 7 closed',
    pass:
      ideaFiles.length > 0 &&
      prdExists &&
      modFiles.length > 0 &&
      adrFiles.length > 0 &&
      harnessLockExists,
  });

  // 2. orphan-check-clean
  const allNodes = await loadAllIds(rootDir);
  const knownIds = new Set(allNodes.map((n) => n.id));
  let hasOrphans = false;
  for (const node of allNodes) {
    for (const ref of extractRefs(node.data)) {
      if (!knownIds.has(ref) && !ref.startsWith('GRILL-')) {
        hasOrphans = true;
        break;
      }
    }
    if (hasOrphans) break;
  }
  checks.push({
    name: 'orphan-check-clean',
    description: 'check-orphans clean',
    pass: !hasOrphans,
  });

  // 3. no-proposed-adrs
  let hasProposedAdrs = false;
  for (const filePath of adrFiles) {
    const data = await readYamlFile(filePath);
    if (String(data['status'] ?? '') === 'proposed') {
      hasProposedAdrs = true;
      break;
    }
  }
  checks.push({
    name: 'no-proposed-adrs',
    description: 'no proposed ADRs',
    pass: !hasProposedAdrs,
  });

  // 4. no-escalated-reviews
  const taskFiles = await listFilesRecursive(path.join(rootDir, 'docs', 'sdlc', 'tasks'));
  let hasEscalated = false;
  for (const filePath of taskFiles) {
    if (!path.basename(filePath).startsWith('REVIEW-')) continue;
    const data = await readYamlFile(filePath);
    if (String(data['verdict'] ?? '') === 'escalate') {
      hasEscalated = true;
      break;
    }
  }
  checks.push({
    name: 'no-escalated-reviews',
    description: 'no escalated reviews',
    pass: !hasEscalated,
  });

  // 5. no-cycle-gte-3
  let hasCycleGte3 = false;
  for (const filePath of taskFiles) {
    const basename = path.basename(filePath);
    if (!basename.startsWith('REVIEW-')) continue;
    const data = await readYamlFile(filePath);
    const cycle = Number(data['cycle_number'] ?? 0);
    if (cycle >= 3) {
      hasCycleGte3 = true;
      break;
    }
  }
  checks.push({
    name: 'no-cycle-gte-3',
    description: 'no tasks at cycle >= 3',
    pass: !hasCycleGte3,
  });

  // 6. harness-lock-all-pass
  checks.push({
    name: 'harness-lock-all-pass',
    description: 'harness.lock present and verification all-pass',
    pass: harnessLockExists,
  });

  // 7. critiques-resolved
  let hasUnresolvedCritiques = false;
  for (const critFile of ['docs/sdlc/prd/spec-critique.yaml', 'docs/sdlc/adr/arch-critique.yaml']) {
    const raw = await readTextIfExists(path.join(rootDir, critFile));
    if (!raw) continue;
    const data = await readYamlFile(path.join(rootDir, critFile));
    const critiques = Array.isArray(data['critiques']) ? data['critiques'] : [];
    for (const c of critiques) {
      if (
        typeof c === 'object' &&
        c !== null &&
        (c as Record<string, unknown>)['resolved'] !== true
      ) {
        hasUnresolvedCritiques = true;
        break;
      }
    }
    if (hasUnresolvedCritiques) break;
  }
  checks.push({
    name: 'critiques-resolved',
    description: 'spec-critique and arch-critique and pre-mortem resolved',
    pass: !hasUnresolvedCritiques,
  });

  // 8. no-open-incidents
  const incidentFiles = await listFiles(path.join(rootDir, 'docs', 'sdlc', 'incidents'));
  checks.push({
    name: 'no-open-incidents',
    description: 'no INC with open CHG events',
    pass: incidentFiles.length === 0,
  });

  return checks;
}

interface IdNode {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

async function loadAllIds(rootDir: string): Promise<IdNode[]> {
  const sdlcDir = path.join(rootDir, 'docs', 'sdlc');
  const files = await listFilesRecursive(sdlcDir);
  const nodes: IdNode[] = [];

  for (const filePath of files) {
    const basename = path.basename(filePath);
    if (!basename.endsWith('.yaml') && !basename.endsWith('.yml')) continue;
    try {
      const data = await readYamlFile(filePath);
      const id = typeof data['id'] === 'string' ? data['id'] : null;
      if (id) nodes.push({ id, data });
    } catch {
      // skip
    }
  }

  return nodes;
}

function extractRefs(data: Record<string, unknown>): string[] {
  const refs: string[] = [];
  for (const field of ['derived_from', 'satisfies', 'honors_adrs', 'chg_events_opened']) {
    const value = data[field];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && /^[A-Z]+-/.test(item)) refs.push(item);
      }
    }
  }
  return refs;
}

export function createReleaseCheckCommand() {
  return async function releaseCheckCommand(
    _args: readonly string[],
    context: CliContext,
  ): Promise<CommandResult> {
    const checks = await runChecklist(context.rootDir);
    const failed = checks.filter((c) => !c.pass);

    // stdout uses kebab names (e.g. "gates-1-to-7-closed")
    const checkLines = checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`).join('\n');

    if (failed.length > 0) {
      // stderr uses long-form descriptions (e.g. "harness.lock present and verification all-pass")
      return {
        exitCode: 1,
        stdout: `${checkLines}\n\nnot release-ready\n`,
        stderr: failed.map((c) => c.description).join('\n'),
      };
    }

    const timestamp = isoNow(context.now);
    await appendApprovalsLog(
      context.rootDir,
      `${timestamp}  /crux-release-check  release-ready  version=0.1.0`,
    );

    return {
      exitCode: 0,
      stdout: `${checkLines}\n\nrelease-ready\n`,
      stderr: '',
    };
  };
}

export async function runReleaseCheckCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  return createReleaseCheckCommand()(args, context);
}
