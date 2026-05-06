/**
 * commands.ts
 *
 * Slash-command concern group for the Claude Code adapter.
 * Implements: run_command
 *
 * This slice keeps command handling intentionally thin: normalize the command
 * name, verify it exists in the adapter-local registry, and return a compact
 * dispatch acknowledgement. Product command bodies live elsewhere.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UnknownCommandError extends Error {
  constructor(command: string) {
    super(`Unknown CRUX command: ${command}`);
    this.name = 'UnknownCommandError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandHandler = (args: readonly string[]) => string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeCommandName(command: string): string {
  const trimmed = command.trim();
  if (trimmed === '') {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

const COMMAND_REGISTRY: Readonly<Record<string, CommandHandler>> = {
  '/crux-help': (args) => {
    const suffix = args.length > 0 ? ` args=${args.join(' ')}` : '';
    return `CRUX adapter command registry: /crux-help${suffix}`.trim();
  },
};

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function run_command(command: string, args: readonly string[] = []): Promise<string> {
  const normalized = normalizeCommandName(command);
  const handler = COMMAND_REGISTRY[normalized];

  if (!handler) {
    throw new UnknownCommandError(normalized);
  }

  return handler(args);
}
