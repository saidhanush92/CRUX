export interface CliContext {
  readonly rootDir: string;
  readonly now?: () => Date;
}

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type CommandHandler = (
  args: readonly string[],
  context: CliContext,
) => Promise<CommandResult>;
