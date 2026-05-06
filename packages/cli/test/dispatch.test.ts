import { describe, it, expect } from 'vitest';
import {
  dispatchCommand,
  listRegisteredCommands,
  registerCommand,
  UnknownCliCommandError,
} from '../src/dispatch.js';

describe('dispatchCommand', () => {
  it('returns usage output when no command is provided', async () => {
    const result = await dispatchCommand([], { rootDir: process.cwd() });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: crux');
  });

  it('dispatches a registered command', async () => {
    registerCommand('unit-test-command', async (args) => ({
      exitCode: 0,
      stdout: `args=${args.join(',')}`,
      stderr: '',
    }));

    const result = await dispatchCommand(['unit-test-command', 'a', 'b'], {
      rootDir: process.cwd(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('args=a,b');
  });

  it('throws UnknownCliCommandError for a missing command', async () => {
    await expect(dispatchCommand(['does-not-exist'], { rootDir: process.cwd() })).rejects.toThrow(
      UnknownCliCommandError,
    );
  });
});

describe('listRegisteredCommands', () => {
  it('includes the core command names expected by the v1 surface', () => {
    const commands = listRegisteredCommands();

    expect(commands).toEqual(
      expect.arrayContaining([
        'init',
        'idea',
        'grill',
        'prd',
        'modules',
        'approve',
        'architect',
        'task',
        'status',
        'trace',
        'incident',
        'release-check',
        'harness',
      ]),
    );
  });
});
