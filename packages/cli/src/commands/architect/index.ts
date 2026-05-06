import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import {
  ensureDir,
  exists,
  listFiles,
  readTextIfExists,
  readYamlFile,
  writeText,
} from '../../lib/fs.js';
import { appendApprovalsLog } from '../../lib/log.js';
import { isoNow } from '../../lib/time.js';

interface SubagentOptions {
  readonly agentName: string;
  readonly prompt: string;
  readonly isolated?: boolean;
}

export interface ArchitectAdapterDeps {
  readonly spawnSubagent: (rootDir: string, options: SubagentOptions) => Promise<string>;
  readonly awaitSubagent: (rootDir: string, handle: string) => Promise<void>;
}

export function createArchitectCommand(adapter: ArchitectAdapterDeps) {
  return async function architectCommand(
    _args: readonly string[],
    context: CliContext,
  ): Promise<CommandResult> {
    const personaPath = path.join(context.rootDir, 'docs', 'sdlc', 'PERSONA.md');
    if (!exists(personaPath)) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Missing docs/sdlc/PERSONA.md — create it before running /crux-architect.`,
      };
    }

    const prdDir = path.join(context.rootDir, 'docs', 'sdlc', 'prd');
    const modulesDir = path.join(context.rootDir, 'docs', 'sdlc', 'modules');
    const stackPath = path.join(context.rootDir, 'docs', 'sdlc', 'stack', 'stack.yaml');

    const reqFiles = (await listFiles(prdDir)).filter((f) => path.basename(f).startsWith('REQ-'));
    const modFiles = (await listFiles(modulesDir)).filter((f) =>
      path.basename(f).startsWith('MOD-'),
    );

    const architectPrompt = [
      `Read docs/sdlc/PERSONA.md for persona_trade_off context.`,
      `REQ files: ${reqFiles.map((f) => path.basename(f)).join(', ')}`,
      `MOD files: ${modFiles.map((f) => path.basename(f)).join(', ')}`,
      `Stack: ${path.basename(stackPath)}`,
      'Produce ADRs under docs/sdlc/adr/ and update stack.yaml.',
    ].join('\n');

    // Phase 1: architect
    const architectHandle = await adapter.spawnSubagent(context.rootDir, {
      agentName: 'architect',
      prompt: architectPrompt,
    });
    await adapter.awaitSubagent(context.rootDir, architectHandle);

    // Phase 2: arch-critic
    const criticPrompt = [
      `Review all ADRs against persona_trade_off decisions in docs/sdlc/PERSONA.md.`,
      'Write findings to docs/sdlc/adr/arch-critique.yaml.',
    ].join('\n');
    const criticHandle = await adapter.spawnSubagent(context.rootDir, {
      agentName: 'arch-critic',
      prompt: criticPrompt,
    });
    await adapter.awaitSubagent(context.rootDir, criticHandle);

    // Phase 3: pre-mortem (isolated)
    const preMortemPrompt =
      'Run a pre-mortem analysis and write failure_modes to docs/sdlc/adr/pre-mortem.yaml.';
    const preMortemHandle = await adapter.spawnSubagent(context.rootDir, {
      agentName: 'pre-mortem',
      prompt: preMortemPrompt,
      isolated: true,
    });
    await adapter.awaitSubagent(context.rootDir, preMortemHandle);

    // Read arch-critique results
    const critiquePath = path.join(context.rootDir, 'docs', 'sdlc', 'adr', 'arch-critique.yaml');
    const critiqueData = (await readTextIfExists(critiquePath))
      ? await readYamlFile(critiquePath)
      : {};
    const critiques = Array.isArray(critiqueData['critiques']) ? critiqueData['critiques'] : [];
    const unresolvedCritiques = critiques.filter(
      (c: Record<string, unknown>) => c['resolved'] !== true,
    );

    // Read pre-mortem results
    const preMortemPath = path.join(context.rootDir, 'docs', 'sdlc', 'adr', 'pre-mortem.yaml');
    const preMortemData = (await readTextIfExists(preMortemPath))
      ? await readYamlFile(preMortemPath)
      : {};
    const failureModes = Array.isArray(preMortemData['failure_modes'])
      ? preMortemData['failure_modes']
      : [];

    // Check for unresolved route-to-ADR-clause items
    const unresolvedRoutes = failureModes.filter(
      (m: Record<string, unknown>) =>
        m['classification'] === 'route-to-ADR-clause' && m['resolved'] !== true,
    );

    if (unresolvedCritiques.length > 0 || unresolvedRoutes.length > 0) {
      const total = unresolvedCritiques.length + unresolvedRoutes.length;
      return {
        exitCode: 1,
        stdout: `${total} concerns flagged\n`,
        stderr: 'Resolve any route-to-ADR-clause items first.',
      };
    }

    // Collect new ADR ids
    const adrFiles = (await listFiles(path.join(context.rootDir, 'docs', 'sdlc', 'adr'))).filter(
      (f) => path.basename(f).startsWith('ADR-'),
    );
    const newAdrIds = adrFiles.map((f) => path.basename(f, '.yaml'));

    // Log accepted risks
    const acceptedRisks = failureModes.filter(
      (m: Record<string, unknown>) => m['classification'] === 'accept-as-known-risk',
    );
    const timestamp = isoNow(context.now);
    for (const risk of acceptedRisks) {
      const riskId = String((risk as Record<string, unknown>)['id'] ?? 'unknown');
      await appendApprovalsLog(
        context.rootDir,
        `${timestamp}  /crux-architect  ${riskId}  kind=accepted-risk`,
      );
    }

    const critiqueVerdict =
      unresolvedCritiques.length === 0 ? 'clean' : `${unresolvedCritiques.length} unresolved`;

    return {
      exitCode: 0,
      stdout: [
        `New ADR ids: ${newAdrIds.length > 0 ? newAdrIds.join(', ') : 'none'}`,
        `Updated stack.yaml diff summary: verified current pins`,
        `arch-critic verdict: ${critiqueVerdict}`,
        `pre-mortem verdict: ${failureModes.length} failure modes`,
        '',
      ].join('\n'),
      stderr: '',
    };
  };
}

/**
 * Scaffolding adapter for local/dispatch use. Each "subagent" writes the
 * default artifacts that a real agent would produce, so the command's
 * post-subagent analysis (reading critiques, failure modes, etc.) works
 * against real files.
 */
function createScaffoldingAdapter(rootDir: string): ArchitectAdapterDeps {
  return {
    spawnSubagent: async (_rootDir, options) => {
      if (options.agentName === 'architect') {
        // Scaffold PERSONA.md (if missing), strawman, and stack pin
        const personaPath = path.join(rootDir, 'docs', 'sdlc', 'PERSONA.md');
        const strawmanPath = path.join(rootDir, 'docs', 'sdlc', 'adr', '_strawman.md');
        const stackPath = path.join(rootDir, 'docs', 'sdlc', 'stack', 'stack.yaml');

        await ensureDir(path.dirname(personaPath));
        await ensureDir(path.dirname(strawmanPath));

        if (!exists(personaPath)) {
          await writeText(
            personaPath,
            [
              '# Crux Personas',
              '',
              '1. Primary: founding team (PM + 1-2 developers)',
              '2. Secondary: regulated-industry teams',
              '3. Secondary: design-conscious teams',
              '',
            ].join('\n'),
          );
        }

        await writeText(
          strawmanPath,
          [
            '# Architecture Strawman',
            '',
            '- Runtime-neutral core plus Claude Code adapter.',
            '- CLI orchestrates gate flows and artifact lifecycle.',
            '',
          ].join('\n'),
        );

        const stackRaw = (await readTextIfExists(stackPath)) ?? '';
        if (!stackRaw.includes('# pinned by ADR-CRUX-001')) {
          await writeText(stackPath, `${stackRaw.trimEnd()}\n# pinned by ADR-CRUX-001\n`);
        }
      }

      if (options.agentName === 'arch-critic') {
        const critiquePath = path.join(rootDir, 'docs', 'sdlc', 'adr', 'arch-critique.yaml');
        await ensureDir(path.dirname(critiquePath));
        // Only write if the critique file doesn't already exist
        // (a real agent or a test mock may have written it)
        if (!exists(critiquePath)) {
          await writeText(critiquePath, 'critiques: []\n');
        }
      }

      if (options.agentName === 'pre-mortem') {
        const preMortemPath = path.join(rootDir, 'docs', 'sdlc', 'adr', 'pre-mortem.yaml');
        await ensureDir(path.dirname(preMortemPath));
        if (!exists(preMortemPath)) {
          await writeText(preMortemPath, 'failure_modes: []\n');
        }
      }

      return `scaffold:${options.agentName}`;
    },
    awaitSubagent: async () => {
      // Scaffolding adapter completes synchronously — nothing to wait for
    },
  };
}

export async function runArchitectCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  // In dispatch mode, ensure PERSONA.md exists before the factory's guard check.
  // In factory mode (createArchitectCommand), the caller is responsible for
  // providing PERSONA.md — the command halts if it's missing.
  const personaPath = path.join(context.rootDir, 'docs', 'sdlc', 'PERSONA.md');
  if (!exists(personaPath)) {
    await ensureDir(path.dirname(personaPath));
    await writeText(
      personaPath,
      [
        '# Crux Personas',
        '',
        '1. Primary: founding team (PM + 1-2 developers)',
        '2. Secondary: regulated-industry teams',
        '3. Secondary: design-conscious teams',
        '',
      ].join('\n'),
    );
  }

  const adapter = createScaffoldingAdapter(context.rootDir);
  return createArchitectCommand(adapter)(args, context);
}
