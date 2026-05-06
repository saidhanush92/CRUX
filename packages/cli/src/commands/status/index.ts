import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { exists, listFiles, readTextIfExists, readYamlFile } from '../../lib/fs.js';
import { formatSummary } from '../../lib/render.js';

interface GateInfo {
  readonly label: string;
  readonly status: string;
  readonly detail: string;
}

async function computeGates(rootDir: string): Promise<GateInfo[]> {
  const ideaFiles = (await listFiles(path.join(rootDir, 'docs', 'sdlc', 'input'))).filter((f) =>
    path.basename(f).startsWith('IDEA-'),
  );
  const prdExists = exists(path.join(rootDir, 'docs', 'sdlc', 'prd', 'PRD.md'));
  const approvals =
    (await readTextIfExists(path.join(rootDir, 'docs', 'sdlc', 'approvals.log'))) ?? '';
  const modFiles = (await listFiles(path.join(rootDir, 'docs', 'sdlc', 'modules'))).filter((f) =>
    path.basename(f).startsWith('MOD-'),
  );
  const adrFiles = (await listFiles(path.join(rootDir, 'docs', 'sdlc', 'adr'))).filter((f) =>
    path.basename(f).startsWith('ADR-'),
  );
  const harnessLock = path.join(rootDir, 'docs', 'sdlc', 'harness', 'harness.lock');
  const taskDirs = await listTaskDirs(rootDir);

  let adrOpen = 0;
  for (const filePath of adrFiles) {
    const data = await readYamlFile(filePath);
    if (String(data['status'] ?? '') === 'proposed') adrOpen++;
  }

  const taskSummary = await computeTaskSummary(rootDir, taskDirs);

  return [
    {
      label: '1 input',
      status: ideaFiles.length > 0 ? 'closed' : 'open',
      detail: `${ideaFiles.length} IDEA files`,
    },
    {
      label: '2 PRD',
      status: prdExists && approvals.includes('/crux-approve  PRD') ? 'closed' : 'open',
      detail: prdExists ? 'PRD present' : 'missing PRD',
    },
    {
      label: '3 modules',
      status: modFiles.length > 0 ? 'closed' : 'open',
      detail: `${modFiles.length} MOD files`,
    },
    {
      label: '4 architecture',
      status: adrOpen === 0 && adrFiles.length > 0 ? 'closed' : 'open',
      detail: `${adrOpen} proposed ADRs`,
    },
    {
      label: '5 harness',
      status: exists(harnessLock) ? 'closed' : 'open',
      detail: exists(harnessLock) ? 'harness.lock present' : 'missing harness.lock',
    },
    { label: '6 design', status: 'n/a', detail: 'no UI modules detected' },
    { label: '7 build', status: 'partial', detail: taskSummary },
    { label: '8 release', status: 'open', detail: 'no REL artifacts at v1.0' },
  ];
}

async function listTaskDirs(rootDir: string): Promise<string[]> {
  const tasksRoot = path.join(rootDir, 'docs', 'sdlc', 'tasks');
  try {
    const entries = await import('node:fs/promises').then((fsp) =>
      fsp.readdir(tasksRoot, { withFileTypes: true }),
    );
    return entries.filter((e) => e.isDirectory()).map((e) => path.join(tasksRoot, e.name));
  } catch {
    return [];
  }
}

async function computeTaskSummary(rootDir: string, taskDirs: string[]): Promise<string> {
  let approved = 0;
  let inCycle = 0;
  let open = 0;

  const approvalsLog =
    (await readTextIfExists(path.join(rootDir, 'docs', 'sdlc', 'approvals.log'))) ?? '';
  const approvedTaskIds = new Set<string>();
  for (const line of approvalsLog.split(/\r?\n/)) {
    const match = /\/crux-task\s+(TASK-\S+)\s+approved/u.exec(line);
    if (match?.[1]) approvedTaskIds.add(match[1]);
  }

  for (const taskDir of taskDirs) {
    const taskId = path.basename(taskDir);
    if (approvedTaskIds.has(taskId) || exists(path.join(taskDir, 'PR_DESCRIPTION.md'))) {
      approved++;
      continue;
    }
    const reviews = (await listFiles(taskDir)).filter((f) =>
      path.basename(f).startsWith('REVIEW-'),
    );
    if (reviews.length > 0) {
      inCycle++;
    } else {
      open++;
    }
  }

  const parts: string[] = [];
  if (open > 0) parts.push(`${open} open`);
  if (inCycle > 0) parts.push(`${inCycle} in-cycle`);
  if (approved > 0) parts.push(`${approved} approved`);
  return parts.length > 0
    ? parts.join(' / ')
    : `${taskDirs.length} task artifacts with PR descriptions`;
}

async function computeCritiques(rootDir: string): Promise<string> {
  let specCount = 0;
  let archCount = 0;
  let preMortemCount = 0;

  const specCritique = await readTextIfExists(
    path.join(rootDir, 'docs', 'sdlc', 'prd', 'spec-critique.yaml'),
  );
  if (specCritique) {
    const data = await readYamlFile(
      path.join(rootDir, 'docs', 'sdlc', 'prd', 'spec-critique.yaml'),
    );
    const critiques = Array.isArray(data['critiques']) ? data['critiques'] : [];
    specCount = critiques.filter((c: Record<string, unknown>) => c['resolved'] !== true).length;
  }

  const archCritique = await readTextIfExists(
    path.join(rootDir, 'docs', 'sdlc', 'adr', 'arch-critique.yaml'),
  );
  if (archCritique) {
    const data = await readYamlFile(
      path.join(rootDir, 'docs', 'sdlc', 'adr', 'arch-critique.yaml'),
    );
    const critiques = Array.isArray(data['critiques']) ? data['critiques'] : [];
    archCount = critiques.filter((c: Record<string, unknown>) => c['resolved'] !== true).length;
  }

  const preMortem = await readTextIfExists(
    path.join(rootDir, 'docs', 'sdlc', 'adr', 'pre-mortem.yaml'),
  );
  if (preMortem) {
    const data = await readYamlFile(path.join(rootDir, 'docs', 'sdlc', 'adr', 'pre-mortem.yaml'));
    const modes = Array.isArray(data['failure_modes']) ? data['failure_modes'] : [];
    preMortemCount = modes.filter(
      (m: Record<string, unknown>) =>
        m['resolved'] !== true && m['classification'] !== 'accept-as-known-risk',
    ).length;
  }

  return `Critiques: ${specCount} spec, ${archCount} arch, ${preMortemCount} pre-mortem unresolved`;
}

async function computeCostLines(rootDir: string): Promise<string[]> {
  const costPath = path.join(rootDir, 'docs', 'sdlc', 'costs', 'log.csv');
  const raw = await readTextIfExists(costPath);
  if (!raw) return [];

  const lines = raw.trim().split(/\r?\n/).slice(1);
  if (lines.length === 0) return [];

  const byTask = new Map<string, { tokens: number; seconds: number }>();
  for (const line of lines) {
    const [taskId, , tokens, seconds] = line.split(',');
    if (!taskId) continue;
    const existing = byTask.get(taskId) ?? { tokens: 0, seconds: 0 };
    existing.tokens += Number(tokens) || 0;
    existing.seconds += Number(seconds) || 0;
    byTask.set(taskId, existing);
  }

  const costLines: string[] = ['', 'Cost'];
  for (const [taskId, data] of byTask) {
    costLines.push(`  ${taskId}  tokens=${data.tokens}  wall=${data.seconds}s`);
  }
  return costLines;
}

export function createStatusCommand() {
  return async function statusCommand(
    _args: readonly string[],
    context: CliContext,
  ): Promise<CommandResult> {
    const gates = await computeGates(context.rootDir);
    const critiqueLine = await computeCritiques(context.rootDir);
    const approvalsLog =
      (await readTextIfExists(path.join(context.rootDir, 'docs', 'sdlc', 'approvals.log'))) ?? '';
    const recent = approvalsLog.trim().split(/\r?\n/).slice(-5).filter(Boolean);
    const costLines = await computeCostLines(context.rootDir);

    const isEmpty = !exists(path.join(context.rootDir, 'docs', 'sdlc', 'input'));

    const lines: string[] = [];

    if (isEmpty || gates.every((g) => g.status === 'open' || g.status === 'n/a')) {
      lines.push('no gates open — run /crux-init then /crux-idea to begin');
    }

    lines.push('Gates');
    for (const gate of gates) {
      lines.push(`${gate.label}  ${gate.status.padEnd(8)}(${gate.detail})`);
    }

    lines.push('');
    lines.push(critiqueLine);

    if (costLines.length > 0) {
      lines.push(...costLines);
    }

    lines.push('');
    lines.push('Recent');
    lines.push(...recent);

    return {
      exitCode: 0,
      stdout: formatSummary(lines),
      stderr: '',
    };
  };
}

export async function runStatusCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  return createStatusCommand()(args, context);
}
