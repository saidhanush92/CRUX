import type { CliContext, CommandHandler, CommandResult } from './types.js';
import { runInitCommand } from './commands/init/index.js';
import { runIdeaCommand } from './commands/idea/index.js';
import { runGrillCommand } from './commands/grill/index.js';
import { runPrdCommand } from './commands/prd/index.js';
import { runModulesCommand } from './commands/modules/index.js';
import { runApproveCommand } from './commands/approve/index.js';
import { runArchitectCommand } from './commands/architect/index.js';
import { runTaskCommand } from './commands/task/index.js';
import { runStatusCommand } from './commands/status/index.js';
import { runTraceCommand } from './commands/trace/index.js';
import { runIncidentCommand } from './commands/incident/index.js';
import { runReleaseCheckCommand } from './commands/release-check/index.js';
import { runHarnessCommand } from './commands/harness/index.js';

export class UnknownCliCommandError extends Error {
  constructor(commandName: string) {
    super(`Unknown CLI command: ${commandName}`);
    this.name = 'UnknownCliCommandError';
  }
}

const registry = new Map<string, CommandHandler>([
  ['init', runInitCommand],
  ['idea', runIdeaCommand],
  ['grill', runGrillCommand],
  ['prd', runPrdCommand],
  ['modules', runModulesCommand],
  ['approve', runApproveCommand],
  ['architect', runArchitectCommand],
  ['task', runTaskCommand],
  ['status', runStatusCommand],
  ['trace', runTraceCommand],
  ['incident', runIncidentCommand],
  ['release-check', runReleaseCheckCommand],
  ['harness', runHarnessCommand],
]);

export function registerCommand(name: string, handler: CommandHandler): void {
  registry.set(name, handler);
}

export async function dispatchCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  const [commandName, ...args] = argv;

  if (!commandName) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'Usage: crux <command> [args]',
    };
  }

  const handler = registry.get(commandName);
  if (!handler) {
    throw new UnknownCliCommandError(commandName);
  }

  return handler(args, context);
}

export function listRegisteredCommands(): string[] {
  return [...registry.keys()].sort();
}
