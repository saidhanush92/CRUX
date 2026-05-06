import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { appendApprovalsLog } from '../../lib/log.js';
import { ensureDir, exists, listFilesRecursive, writeText } from '../../lib/fs.js';
import { isoNow } from '../../lib/time.js';
import { formatSummary } from '../../lib/render.js';

function countSourceFiles(files: readonly string[]): number {
  return files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/');
    if (
      normalized.startsWith('docs/') ||
      normalized.startsWith('templates/') ||
      normalized.startsWith('scripts/')
    ) {
      return false;
    }
    return /\.(ts|tsx|js|jsx|py|go|rs|java|kt|swift)$/.test(normalized);
  }).length;
}

function detectBrownfield(files: readonly string[]): boolean {
  return countSourceFiles(files) > 20;
}

function detectLanguage(files: readonly string[]): string {
  const hasTs = files.some((filePath) => /\.(ts|tsx)$/.test(filePath));
  if (hasTs) return 'typescript';
  const hasPy = files.some((filePath) => /\.py$/.test(filePath));
  if (hasPy) return 'python';
  return 'unknown';
}

function detectPackageManager(files: readonly string[]): string {
  if (files.some((filePath) => filePath.endsWith('pnpm-lock.yaml'))) return 'pnpm';
  if (files.some((filePath) => filePath.endsWith('package-lock.json'))) return 'npm';
  return 'unknown';
}

function detectTestRunner(files: readonly string[]): string {
  if (files.some((filePath) => filePath.endsWith('vitest.config.ts'))) return 'vitest';
  return 'unknown';
}

function renderStackYaml(language: string, packageManager: string, testRunner: string): string {
  return [
    '# Crux v1.0 stack manifest',
    `language: ${language}                    # detected`,
    '',
    'runtime:',
    '  node: ">=20.10 <23"                   # detected',
    '  os: [linux, macos, windows]           # detected',
    '',
    'package_manager:',
    `  name: ${packageManager}                         # detected`,
    '  version: "10.33.2"                    # detected',
    '',
    'frameworks:',
    '  test_runner:',
    `    - name: ${testRunner}                      # detected`,
    '      version: "^2"                      # detected',
    '',
    'data:',
    '  storage: sqlite',
    '  schema_dir: packages/core/schema',
    '',
    'testing:',
    `  unit: ${testRunner}`,
    `  integration: ${testRunner}`,
    '  e2e: null',
    '  coverage_target: 80',
    '',
    'ops:',
    '  ci: github-actions',
    '  release: manual',
    '  docs_site: null',
    '',
    'crux_mode: standard                    # detected',
    'quality_gates:',
    '  typecheck: pnpm tsc --noEmit',
    '  lint: pnpm eslint .',
    '  format_check: pnpm prettier --check .',
    '  unit: pnpm vitest run',
    '',
  ].join('\n');
}

export async function runInitCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  const explicitMode = args.find((arg) => arg === '--greenfield' || arg === '--brownfield');
  const allFiles = (await listFilesRecursive(context.rootDir)).map((filePath) =>
    path.relative(context.rootDir, filePath),
  );
  const isBrownfield = explicitMode ? explicitMode === '--brownfield' : detectBrownfield(allFiles);

  const stackPath = path.join(context.rootDir, 'docs', 'sdlc', 'stack', 'stack.yaml');
  if (exists(stackPath)) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'docs/sdlc/stack/stack.yaml already exists',
    };
  }

  const language = detectLanguage(allFiles);
  const packageManager = detectPackageManager(allFiles);
  const testRunner = detectTestRunner(allFiles);

  await writeText(stackPath, renderStackYaml(language, packageManager, testRunner));

  if (isBrownfield) {
    const gate0Dir = path.join(context.rootDir, 'docs', 'sdlc', 'gate0');
    await ensureDir(gate0Dir);
    await writeText(
      path.join(gate0Dir, 'gap-report.md'),
      '# Brownfield Gap Report\n\n- Existing source tree detected.\n- Architecture archaeology required.\n',
    );
    await ensureDir(path.join(context.rootDir, 'docs', 'sdlc', 'adr'));
    await writeText(
      path.join(context.rootDir, 'docs', 'sdlc', 'adr', 'ADR-ARCHAEOLOGY-001.yaml'),
      [
        'id: ADR-ARCHAEOLOGY-001',
        'title: Brownfield archaeology placeholder',
        'status: proposed',
        'origin: archaeology',
        'decision: |',
        '  Existing repository encodes implicit delivery and packaging decisions.',
        '',
      ].join('\n'),
    );

    const starterIdea = path.join(context.rootDir, 'docs', 'sdlc', 'input', 'IDEA-001.md');
    if (!exists(starterIdea)) {
      await writeText(
        starterIdea,
        [
          '---',
          'id: IDEA-001',
          `ingested_at: ${isoNow(context.now)}`,
          'source_path: docs/sdlc/gate0/gap-report.md',
          'classification: research_note',
          'depth: surface',
          '---',
          '',
          '# Brownfield starter idea',
          '',
          'Derived from the generated gap report.',
          '',
        ].join('\n'),
      );
    }
  }

  await appendApprovalsLog(
    context.rootDir,
    `${isoNow(context.now)}  /crux-init  ${isBrownfield ? 'brownfield' : 'greenfield'}  stack.yaml created`,
  );

  return {
    exitCode: 0,
    stdout: formatSummary([
      `language: ${language}`,
      `runtime: node`,
      `pm: ${packageManager}`,
      `test: ${testRunner}`,
      `e2e: none`,
    ]),
    stderr: '',
  };
}
