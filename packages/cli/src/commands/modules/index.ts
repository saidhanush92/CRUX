import fs from 'node:fs';
import path from 'node:path';
import { detectCycles } from '../../../../core/src/graph/cycle.js';
import { writeArtifact, type Artifact } from '../../../../core/src/trace/markdown.js';
import { parseYaml } from '../../../../core/src/trace/markdown.js';
import type { CommandHandler, CommandResult } from '../../types.js';

interface ReqRecord {
  readonly id: string;
  readonly raw: Record<string, unknown>;
}

interface ModulePlan {
  readonly key: string;
  readonly reqIds: string[];
  readonly surface: 'ui' | 'headless' | 'none';
  readonly responsibility: string;
  readonly dependsOnKeys: string[];
}

function ok(stdout: string): CommandResult {
  return { exitCode: 0, stdout, stderr: '' };
}

function fail(stderr: string, stdout = ''): CommandResult {
  return { exitCode: 1, stdout, stderr };
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function padId(n: number): string {
  return String(n).padStart(3, '0');
}

function listReqs(rootDir: string): ReqRecord[] {
  const prdDir = path.join(rootDir, 'docs', 'sdlc', 'prd');
  if (!fs.existsSync(prdDir)) {
    return [];
  }

  return fs
    .readdirSync(prdDir)
    .filter((entry) => /^REQ-\d+\.yaml$/u.test(entry))
    .sort()
    .map((entry) => ({
      id: entry.replace(/\.yaml$/u, ''),
      raw: parseYaml(fs.readFileSync(path.join(prdDir, entry), 'utf8')),
    }));
}

function kebabCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function inferModuleKey(record: ReqRecord): string {
  const hint = record.raw.module_hint;
  if (typeof hint === 'string' && hint.trim() !== '') {
    return kebabCase(hint);
  }

  const text = String(record.raw.text ?? '').toLowerCase();
  if (/\b(ui|frontend|visual|screen|explorer)\b/u.test(text)) return 'ui-shell';
  if (/\b(trace|graph|cache|storage|ledger)\b/u.test(text)) return 'trace-store';
  if (/\b(test|review|lint|quality|verification)\b/u.test(text)) return 'quality-gates';
  return 'cli-runtime';
}

function inferSurface(record: ReqRecord, key: string): 'ui' | 'headless' | 'none' {
  const hint = record.raw.surface_hint;
  if (hint === 'ui' || hint === 'headless' || hint === 'none') {
    return hint;
  }

  const text = String(record.raw.text ?? '').toLowerCase();
  if (key.includes('ui') || /\b(ui|frontend|visual|screen)\b/u.test(text)) return 'ui';
  if (/\b(policy|docs|approval)\b/u.test(text)) return 'none';
  return 'headless';
}

function inferResponsibility(key: string, reqIds: readonly string[]): string {
  if (key === 'trace-store') {
    return `Owns trace storage and graph concerns motivated by ${reqIds.join(', ')}.`;
  }
  if (key === 'ui-shell') {
    return `Owns interactive UI surface and presentation concerns motivated by ${reqIds.join(', ')}.`;
  }
  if (key === 'quality-gates') {
    return `Owns verification, review, and quality automation motivated by ${reqIds.join(', ')}.`;
  }
  return `Owns command orchestration and headless workflow coordination motivated by ${reqIds.join(', ')}.`;
}

function listDependsOnKeys(record: ReqRecord): string[] {
  const value = record.raw.depends_on_modules;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map(kebabCase);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return [kebabCase(value)];
  }
  return [];
}

function planModules(reqs: readonly ReqRecord[]): ModulePlan[] {
  const grouped = new Map<
    string,
    {
      reqIds: string[];
      surface: 'ui' | 'headless' | 'none';
      dependsOnKeys: Set<string>;
    }
  >();

  for (const req of reqs) {
    const key = inferModuleKey(req);
    const existing = grouped.get(key) ?? {
      reqIds: [],
      surface: inferSurface(req, key),
      dependsOnKeys: new Set<string>(),
    };
    existing.reqIds.push(req.id);
    const surface = inferSurface(req, key);
    if (surface === 'ui') {
      existing.surface = 'ui';
    } else if (existing.surface !== 'ui' && surface === 'headless') {
      existing.surface = 'headless';
    }

    for (const dependsOnKey of listDependsOnKeys(req)) {
      if (dependsOnKey !== key) {
        existing.dependsOnKeys.add(dependsOnKey);
      }
    }

    grouped.set(key, existing);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      key,
      reqIds: value.reqIds.sort(),
      surface: value.surface,
      dependsOnKeys: [...value.dependsOnKeys].sort(),
      responsibility: inferResponsibility(key, value.reqIds),
    }));
}

export const modulesCommand: CommandHandler = async (args, context) => {
  const reqs = listReqs(context.rootDir);
  if (reqs.length === 0) {
    return fail('No REQ files found under docs/sdlc/prd/.');
  }

  const planned = planModules(reqs);
  const modulesDir = path.join(context.rootDir, 'docs', 'sdlc', 'modules');
  ensureDir(modulesDir);

  const keyToId = new Map<string, string>();
  planned.forEach((plan, index) => {
    keyToId.set(plan.key, `MOD-${padId(index + 1)}`);
  });

  const artifacts: Artifact[] = planned.map((plan) => {
    const artifactId = keyToId.get(plan.key)!;
    const dependsOnIds = plan.dependsOnKeys
      .map((key) => keyToId.get(key))
      .filter((value): value is string => Boolean(value));
    return {
      id: artifactId,
      kind: 'MOD',
      path: path.join(modulesDir, `${artifactId}.yaml`),
      raw: {
        id: artifactId,
        name: plan.key,
        responsibility: plan.responsibility,
        surface: plan.surface,
        depends_on: dependsOnIds,
        derived_from: plan.reqIds,
      },
    };
  });

  artifacts.forEach((artifact) => writeArtifact(artifact.path, artifact));

  const cycleReport = detectCycles(
    artifacts.map((artifact) => ({
      id: artifact.id,
      depends_on: Array.isArray(artifact.raw.depends_on)
        ? artifact.raw.depends_on.filter((value): value is string => typeof value === 'string')
        : [],
    })),
  );

  const stdoutLines = artifacts.map((artifact) => {
    const dependsOn = Array.isArray(artifact.raw.depends_on) ? artifact.raw.depends_on.length : 0;
    const reqCount = Array.isArray(artifact.raw.derived_from)
      ? artifact.raw.derived_from.length
      : 0;
    return `${artifact.id}\t${artifact.raw.name}\t${artifact.raw.surface}\treqs=${reqCount}\tdepends_on=${dependsOn}`;
  });
  stdoutLines.push(
    'Run `/crux-architect` next to produce ADRs that constrain how these modules are built.',
  );

  if (cycleReport.hasCycle) {
    const idToName = new Map(artifacts.map((artifact) => [artifact.id, String(artifact.raw.name)]));
    const renderedCycles = (cycleReport.cycles ?? []).map((cycle) =>
      cycle.map((id) => idToName.get(id) ?? id).join(' -> '),
    );

    return fail(
      `CRITICAL: dependency cycle detected: ${renderedCycles.join('; ')}`,
      stdoutLines.join('\n'),
    );
  }

  return ok(stdoutLines.join('\n'));
};

export const runModulesCommand = modulesCommand;
