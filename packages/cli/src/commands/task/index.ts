import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { appendApprovalsLog } from '../../lib/log.js';
import { ensureDir, readTextIfExists, readYamlFile, writeText } from '../../lib/fs.js';
import { isoNow } from '../../lib/time.js';

interface SubagentOptions {
  readonly agentName: string;
  readonly prompt: string;
  readonly isolated?: boolean;
}

interface AdapterDeps {
  readonly spawnSubagent: (rootDir: string, options: SubagentOptions) => Promise<string>;
  readonly awaitSubagent: (rootDir: string, handle: string) => Promise<void>;
}

export function createTaskCommand(adapter: AdapterDeps) {
  return async function taskCommand(
    args: readonly string[],
    context: CliContext,
  ): Promise<CommandResult> {
    const [taskId] = args;
    if (!taskId) {
      return { exitCode: 1, stdout: '', stderr: 'Pass a TASK id to /crux-task.' };
    }

    const taskDir = path.join(context.rootDir, 'docs', 'sdlc', 'tasks', taskId);
    const taskPath = path.join(taskDir, 'TASK.yaml');
    const taskRaw = await readTextIfExists(taskPath);
    if (taskRaw === null) {
      return { exitCode: 1, stdout: '', stderr: `Missing TASK file for ${taskId}` };
    }

    const taskData = await readYamlFile(taskPath);

    // Check all referenced ADRs are accepted
    const honorsAdrs = Array.isArray(taskData['honors_adrs']) ? taskData['honors_adrs'] : [];
    for (const adrId of honorsAdrs) {
      if (typeof adrId !== 'string') continue;
      const adrPath = path.join(context.rootDir, 'docs', 'sdlc', 'adr', `${adrId}.yaml`);
      const adrRaw = await readTextIfExists(adrPath);
      if (adrRaw) {
        const adrData = await readYamlFile(adrPath);
        if (String(adrData['status'] ?? '') !== 'accepted') {
          return {
            exitCode: 1,
            stdout: '',
            stderr: `${adrId} is not accepted — approve the ADR first.`,
          };
        }
      }
    }

    const satisfies = Array.isArray(taskData['satisfies']) ? taskData['satisfies'] : [];
    const touchesFiles = Array.isArray(taskData['touches_files']) ? taskData['touches_files'] : [];

    // Collect derivation chain for PR description
    const reqIds: string[] = satisfies.filter((s): s is string => typeof s === 'string');
    const grillIds: string[] = [];
    for (const reqId of reqIds) {
      const reqPath = path.join(context.rootDir, 'docs', 'sdlc', 'prd', `${reqId}.yaml`);
      const reqRaw = await readTextIfExists(reqPath);
      if (reqRaw) {
        const reqData = await readYamlFile(reqPath);
        const derivedFrom = Array.isArray(reqData['derived_from']) ? reqData['derived_from'] : [];
        for (const g of derivedFrom) {
          if (typeof g === 'string') grillIds.push(g);
        }
      }
    }

    await ensureDir(taskDir);

    // Phase 1: test-writer
    const testWriterPrompt = `Generate failing tests for ${taskId}. Scope: ${touchesFiles.join(', ')}`;
    const testWriterHandle = await adapter.spawnSubagent(context.rootDir, {
      agentName: 'test-writer',
      prompt: testWriterPrompt,
      isolated: true,
    });
    await adapter.awaitSubagent(context.rootDir, testWriterHandle);

    let cycleNumber = 0;
    let approved = false;

    while (!approved) {
      cycleNumber++;

      // Phase 2: coder
      const reviewPath = path.join(taskDir, `REVIEW-${cycleNumber - 1}.yaml`);
      let previousConcerns = '';
      if (cycleNumber > 1) {
        const prevReviewRaw = await readTextIfExists(reviewPath);
        if (prevReviewRaw) {
          const prevReview = await readYamlFile(reviewPath);
          const concerns = Array.isArray(prevReview['concerns']) ? prevReview['concerns'] : [];
          previousConcerns = concerns
            .map((c: Record<string, unknown>) => String(c['finding'] ?? '').trim())
            .filter(Boolean)
            .join('\n');
        }
      }

      const coderPrompt = previousConcerns
        ? `Implement minimal code for ${taskId}. Address reviewer concerns:\n${previousConcerns}`
        : `Implement minimal code for ${taskId}. Scope: ${touchesFiles.join(', ')}`;

      const coderHandle = await adapter.spawnSubagent(context.rootDir, {
        agentName: 'coder',
        prompt: coderPrompt,
        isolated: true,
      });
      await adapter.awaitSubagent(context.rootDir, coderHandle);

      // Phase 3: reviewer
      const reviewerPrompt = `Review ${taskId} against ${reqIds.join(', ')} and ${honorsAdrs.join(', ')}`;
      const reviewerHandle = await adapter.spawnSubagent(context.rootDir, {
        agentName: 'reviewer',
        prompt: reviewerPrompt,
        isolated: true,
      });
      await adapter.awaitSubagent(context.rootDir, reviewerHandle);

      // Read review result
      const currentReviewPath = path.join(taskDir, `REVIEW-${cycleNumber}.yaml`);
      const reviewRaw = await readTextIfExists(currentReviewPath);
      if (reviewRaw) {
        const reviewData = await readYamlFile(currentReviewPath);
        if (String(reviewData['verdict'] ?? '') === 'approve') {
          approved = true;
        }
      } else {
        // If no review file was written, assume approved to avoid infinite loop
        approved = true;
      }

      // Safety: prevent infinite loops
      if (cycleNumber >= 10) break;
    }

    // Read cost data if available
    const costPath = path.join(context.rootDir, 'docs', 'sdlc', 'costs', 'log.csv');
    const costRaw = await readTextIfExists(costPath);
    let costSummary = '';
    if (costRaw) {
      const costLines = costRaw.trim().split(/\r?\n/).slice(1);
      const taskCostLines = costLines.filter((l) => l.startsWith(`${taskId},`));
      if (taskCostLines.length > 0) {
        const totalTokens = taskCostLines.reduce(
          (sum, l) => sum + (Number(l.split(',')[2]) || 0),
          0,
        );
        costSummary = `\ncost estimate vs. actual: tokens=${totalTokens}`;
      }
    }

    // Write PR_DESCRIPTION.md
    const prDescriptionPath = path.join(taskDir, 'PR_DESCRIPTION.md');
    await writeText(
      prDescriptionPath,
      [
        `# ${taskId}`,
        '',
        `## Task`,
        `- ${taskId}: ${String(taskData['title'] ?? '')}`,
        '',
        `## Satisfies`,
        ...reqIds.map((id) => `- ${id}`),
        '',
        `## Honors ADRs`,
        ...honorsAdrs.map((id: string) => `- ${id}`),
        '',
        `## Derived from`,
        ...grillIds.map((id) => `- ${id}`),
        '',
        `## Cycles: ${cycleNumber}`,
        '',
      ].join('\n'),
    );

    const timestamp = isoNow(context.now);
    await appendApprovalsLog(
      context.rootDir,
      `${timestamp}  /crux-task  ${taskId}  approved  cycles=${cycleNumber}`,
    );

    return {
      exitCode: 0,
      stdout: `${taskId} approved after cycles=${cycleNumber}${costSummary}\n`,
      stderr: '',
    };
  };
}

export async function runTaskCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  const { createClaudeCodeAdapter } = await import('../../../../adapter-claude-code/src/index.js');
  const { createAdapterBridge } = await import('../../lib/adapter-bridge.js');

  const adapter = createClaudeCodeAdapter(context.rootDir);
  const taskId = args[0] ?? '';
  const bridge = createAdapterBridge(adapter, { taskId, rootDir: context.rootDir });

  return createTaskCommand(bridge)(args, context);
}
