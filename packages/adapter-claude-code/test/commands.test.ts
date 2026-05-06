import { describe, it, expect } from 'vitest';
import { ADAPTER_INTERFACE_MANIFEST } from '../../core/src/adapter/interface.js';

import { run_command, UnknownCommandError } from '../src/commands.js';

describe('run_command', () => {
  it('dispatches a known command and returns a string response', async () => {
    const result = await run_command('/crux-help');

    expect(typeof result).toBe('string');
    expect(result).toContain('/crux-help');
  });

  it('normalizes a missing leading slash before dispatching', async () => {
    const result = await run_command('crux-help');

    expect(result).toContain('/crux-help');
  });

  it('includes args in the returned response for a known command', async () => {
    const result = await run_command('/crux-help', ['status', 'trace']);

    expect(result).toContain('status trace');
  });

  it('throws UnknownCommandError for an unsupported command', async () => {
    await expect(run_command('/crux-ghost')).rejects.toThrow(UnknownCommandError);
  });

  it('UnknownCommandError message contains the normalized command name', async () => {
    const err = await run_command('crux-ghost').catch((error: unknown) => error);

    expect(err).toBeInstanceOf(UnknownCommandError);
    expect((err as Error).message).toContain('/crux-ghost');
  });
});

describe('commands module manifest conformance', () => {
  it('exports the SlashCommands function declared in ADAPTER_INTERFACE_MANIFEST', async () => {
    const mod = await import('../src/commands.js');
    const exported = Object.keys(mod);

    for (const fn of ADAPTER_INTERFACE_MANIFEST['SlashCommands']) {
      expect(exported, `commands module must export "${fn}"`).toContain(fn);
    }
  });

  it('UnknownCommandError is exported from the commands module', async () => {
    const mod = await import('../src/commands.js');

    expect(mod['UnknownCommandError']).toBeDefined();
    expect(typeof mod['UnknownCommandError']).toBe('function');
  });
});
