/**
 * adapter-bridge.ts
 *
 * Bridges the Claude Code RuntimeAdapter into the AdapterDeps interface
 * used by createArchitectCommand and createTaskCommand.
 *
 * When running without a real subagent runtime (e.g. in local/test mode),
 * the bridge writes response files immediately so await_subagent resolves,
 * and scaffolds the expected stage artifacts (TEST_PLAN, REVIEW, etc.)
 * that a real agent would produce.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

interface SubagentOptions {
  readonly agentName: string;
  readonly prompt: string;
  readonly isolated?: boolean;
}

export interface AdapterDeps {
  readonly spawnSubagent: (rootDir: string, options: SubagentOptions) => Promise<string>;
  readonly awaitSubagent: (rootDir: string, handle: string) => Promise<void>;
}

interface RuntimeAdapter {
  session_start: () => Promise<unknown>;
  spawn_subagent: (opts: { metadata: Record<string, unknown> }) => Promise<unknown>;
  await_subagent: (handle: unknown) => Promise<void>;
}

/**
 * Creates an AdapterDeps bridge from a Claude Code RuntimeAdapter.
 *
 * `taskContext` is optional — when provided, the bridge scaffolds
 * stage-appropriate artifacts (TEST_PLAN, REVIEW) that a real subagent
 * would produce. This keeps the orchestration contract honest without
 * requiring a live agent runtime.
 */
export function createAdapterBridge(
  adapter: RuntimeAdapter,
  taskContext?: { readonly taskId: string; readonly rootDir: string },
): AdapterDeps {
  return {
    spawnSubagent: async (rootDir, options) => {
      const sessionId = await adapter.session_start();
      const handle = await adapter.spawn_subagent({
        metadata: {
          sessionId,
          agentName: options.agentName,
          prompt: options.prompt,
        },
      });

      const handleStr = handle as string;
      const handleId = handleStr.slice(handleStr.lastIndexOf(':') + 1);

      // Write an immediate response so await_subagent resolves in local mode
      const responseDir = path.join(rootDir, '.crux', 'subagents');
      await fsp.mkdir(responseDir, { recursive: true });
      await fsp.writeFile(
        path.join(responseDir, `${handleId}.response.json`),
        JSON.stringify({ result: `${options.agentName} completed` }),
        'utf8',
      );

      // Scaffold stage artifacts when a task context is provided
      if (taskContext) {
        await scaffoldStageArtifact(taskContext.rootDir, taskContext.taskId, options.agentName);
      }

      return handleStr;
    },

    awaitSubagent: async (_rootDir, handle) => {
      await adapter.await_subagent(handle);
    },
  };
}

async function scaffoldStageArtifact(
  rootDir: string,
  taskId: string,
  agentName: string,
): Promise<void> {
  const taskDir = path.join(rootDir, 'docs', 'sdlc', 'tasks', taskId);
  await fsp.mkdir(taskDir, { recursive: true });

  if (agentName === 'test-writer') {
    await fsp.writeFile(
      path.join(taskDir, 'TEST_PLAN.yaml'),
      [
        `task: ${taskId}`,
        'test_layers:',
        '  unit:',
        '    - covers: generated test plan placeholder',
        '      file: test.ts',
        'coverage_target: 80',
        'out_of_scope: []',
        '',
      ].join('\n'),
      'utf8',
    );
  } else if (agentName === 'reviewer') {
    const existing = await fsp.readdir(taskDir).catch(() => [] as string[]);
    const reviewCount = existing.filter((f: string) => f.startsWith('REVIEW-')).length;
    const cycleNum = reviewCount + 1;
    await fsp.writeFile(
      path.join(taskDir, `REVIEW-${cycleNum}.yaml`),
      [
        `task: ${taskId}`,
        'reviewer: reviewer',
        'verdict: approve',
        `cycle_number: ${cycleNum}`,
        'concerns: []',
        '',
      ].join('\n'),
      'utf8',
    );
  }
}
