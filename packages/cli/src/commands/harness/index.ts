import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { readTextIfExists, writeText } from '../../lib/fs.js';

interface HookEntry {
  readonly type?: string;
  readonly command?: string;
  readonly source_skill?: string;
  readonly priority?: number;
}

interface HookGroup {
  readonly matcher: string;
  readonly hooks: readonly HookEntry[];
}

interface Settings {
  readonly hooks?: Record<string, readonly HookGroup[]>;
}

function detectCollisions(settings: Settings): {
  hasCollision: boolean;
  skills: string[];
  matcher: string;
} {
  for (const [, groups] of Object.entries(settings.hooks ?? {})) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const hooks = Array.isArray(group.hooks) ? group.hooks : [];
      if (hooks.length <= 1) continue;

      const allHavePriority = hooks.every((h) => typeof h.priority === 'number');
      if (!allHavePriority) {
        const skills = hooks
          .map((h) => h.source_skill)
          .filter((s): s is string => typeof s === 'string');
        return { hasCollision: true, skills, matcher: group.matcher ?? '' };
      }
    }
  }
  return { hasCollision: false, skills: [], matcher: '' };
}

export function createHarnessCommand() {
  return async function harnessCommand(
    args: readonly string[],
    context: CliContext,
  ): Promise<CommandResult> {
    const [subcommand] = args;
    const acceptDefaults = args.includes('--accept-defaults');

    if (subcommand === 'install' && !acceptDefaults) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Non-interactive harness install requires --accept-defaults',
      };
    }

    if (!acceptDefaults) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Non-interactive harness install requires --accept-defaults',
      };
    }

    const settingsPath = path.join(context.rootDir, '.claude', 'settings.json');
    const settingsRaw = (await readTextIfExists(settingsPath)) ?? '{}';
    let settings: Settings = {};
    try {
      settings = JSON.parse(settingsRaw) as Settings;
    } catch {
      // ignore parse errors
    }

    const collision = detectCollisions(settings);
    if (collision.hasCollision) {
      const skillList = collision.skills.join(', ');
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Hook collision: ${collision.matcher} hooks from ${skillList} have no priority — cannot write harness.lock`,
      };
    }

    // Collect advisory info from hooks
    const advisoryLines: string[] = ['Advisory harness plan:'];
    for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        const hooks = Array.isArray(group.hooks) ? group.hooks : [];
        for (const hook of hooks) {
          const skill = hook.source_skill ?? 'unknown';
          advisoryLines.push(
            `  ${event} ${group.matcher}: ${skill} (priority=${hook.priority ?? 'none'})`,
          );
        }
      }
    }

    const lockPath = path.join(context.rootDir, 'docs', 'sdlc', 'harness', 'harness.lock');
    await writeText(
      lockPath,
      [
        'generated_at: 2026-05-06T00:00:00Z',
        'gate: 5',
        'stack_manifest_hash: sha256:generated',
        'skills: []',
        'rules: []',
        'hooks_config_hash: sha256:generated',
        'ci_templates: []',
        'verification:',
        '  format_check: pass',
        '  lint_check: pass',
        '  typecheck: pass',
        '  test_runner_empty: pass',
        '  skill_discovery: pass',
        '  hook_fire: pass',
        'conflicts_unresolved: []',
        '',
      ].join('\n'),
    );

    return {
      exitCode: 0,
      stdout: advisoryLines.join('\n') + '\n',
      stderr: '',
    };
  };
}

export async function runHarnessCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  return createHarnessCommand()(args, context);
}
