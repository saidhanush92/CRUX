/**
 * hooks.test.ts
 *
 * Tests for the Hooks concern group (ADR-CRUX-003):
 *   install_hook, list_hooks
 *
 * Key contracts:
 *  - install_hook appends entries to <rootDir>/.claude/settings.json under hooks.<event>[]
 *  - Atomic write (temp + rename) is the coder's responsibility; tests verify final settled state
 *  - install_hook throws HookCollisionError on exact duplicate (same event + same handler)
 *  - install_hook allows same event with different handler (NOT a collision at the adapter level)
 *  - install_hook preserves unrelated keys already present in settings.json
 *  - list_hooks returns all installed hooks as a flat HookSpec[] (readonly)
 *
 * ADR-CRUX-008 full collision detection (e.g. same matcher different command) is
 * consumer-side responsibility; the adapter errors only on exact duplicates.
 *
 * All tests are RED until the coder creates:
 *   packages/adapter-claude-code/src/hooks.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { SessionId, HookSpec } from '../../core/src/adapter/types.js';
import { ADAPTER_INTERFACE_MANIFEST } from '../../core/src/adapter/interface.js';

import { session_start, session_end } from '../src/lifecycle.js';
import { install_hook, list_hooks, HookCollisionError } from '../src/hooks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-test-hooks-'));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function settingsPath(rootDir: string): string {
  return path.join(rootDir, '.claude', 'settings.json');
}

function readSettings(rootDir: string): Record<string, unknown> {
  const raw = fs.readFileSync(settingsPath(rootDir), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function makeHook(overrides: Partial<HookSpec> = {}): HookSpec {
  return {
    event: overrides.event ?? 'PostToolUse',
    handler: overrides.handler ?? 'pnpm prettier --write "$FILE_PATH"',
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let sessionId: SessionId;

beforeEach(async () => {
  tmpDir = makeTempDir();
  sessionId = await session_start({ metadata: { rootDir: tmpDir } });
});

afterEach(async () => {
  await session_end(sessionId).catch(() => {});
  removeTempDir(tmpDir);
});

// ---------------------------------------------------------------------------
// install_hook — file creation
// ---------------------------------------------------------------------------

describe('install_hook — settings.json creation', () => {
  it('creates <rootDir>/.claude/settings.json when it does not exist', async () => {
    const hook = makeHook();
    expect(fs.existsSync(settingsPath(tmpDir))).toBe(false);

    await install_hook(tmpDir, { sessionId, hook });

    expect(fs.existsSync(settingsPath(tmpDir))).toBe(true);
  });

  it('creates the .claude/ directory when it does not exist', async () => {
    const claudeDir = path.join(tmpDir, '.claude');
    expect(fs.existsSync(claudeDir)).toBe(false);

    await install_hook(tmpDir, { sessionId, hook: makeHook() });

    expect(fs.existsSync(claudeDir)).toBe(true);
  });

  it('resolves (void/undefined) after a successful write', async () => {
    await expect(install_hook(tmpDir, { sessionId, hook: makeHook() })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// install_hook — content validation
// ---------------------------------------------------------------------------

describe('install_hook — settings.json content', () => {
  it('resulting settings.json is valid JSON', async () => {
    await install_hook(tmpDir, { sessionId, hook: makeHook() });

    expect(() => readSettings(tmpDir)).not.toThrow();
  });

  it('settings.json has a top-level "hooks" key after install', async () => {
    await install_hook(tmpDir, { sessionId, hook: makeHook() });

    const settings = readSettings(tmpDir);
    expect(settings['hooks']).toBeDefined();
  });

  it('hook is placed under hooks.<event> as an array element', async () => {
    const hook: HookSpec = { event: 'PostToolUse', handler: 'pnpm lint "$FILE_PATH"' };
    await install_hook(tmpDir, { sessionId, hook });

    const settings = readSettings(tmpDir);
    const hooksSection = settings['hooks'] as Record<string, unknown>;
    const eventArr = hooksSection['PostToolUse'] as unknown[];

    expect(Array.isArray(eventArr)).toBe(true);
    expect(eventArr.length).toBeGreaterThanOrEqual(1);
  });

  it('hook entry stores the event and handler values', async () => {
    const hook: HookSpec = { event: 'PreToolUse', handler: 'node guard.js' };
    await install_hook(tmpDir, { sessionId, hook });

    const settings = readSettings(tmpDir);
    const hooksSection = settings['hooks'] as Record<string, unknown>;
    const eventArr = hooksSection['PreToolUse'] as Array<Record<string, unknown>>;

    const match = eventArr.find((h) => h['event'] === hook.event && h['handler'] === hook.handler);
    expect(match).toBeDefined();
  });

  it('two hooks for different events both appear in settings.json', async () => {
    const h1: HookSpec = { event: 'PostToolUse', handler: 'pnpm format' };
    const h2: HookSpec = { event: 'Stop', handler: 'pnpm build' };
    await install_hook(tmpDir, { sessionId, hook: h1 });
    await install_hook(tmpDir, { sessionId, hook: h2 });

    const settings = readSettings(tmpDir);
    const hooksSection = settings['hooks'] as Record<string, unknown>;

    expect(Array.isArray(hooksSection['PostToolUse'])).toBe(true);
    expect(Array.isArray(hooksSection['Stop'])).toBe(true);
  });

  it('two different hooks for the same event both appear in the event array', async () => {
    const h1: HookSpec = { event: 'PostToolUse', handler: 'pnpm format' };
    const h2: HookSpec = { event: 'PostToolUse', handler: 'pnpm lint' };
    await install_hook(tmpDir, { sessionId, hook: h1 });
    await install_hook(tmpDir, { sessionId, hook: h2 });

    const settings = readSettings(tmpDir);
    const hooksSection = settings['hooks'] as Record<string, unknown>;
    const eventArr = hooksSection['PostToolUse'] as unknown[];

    expect(eventArr.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves pre-existing unrelated keys in settings.json', async () => {
    // Pre-populate with an unrelated key
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      settingsPath(tmpDir),
      JSON.stringify({ model: 'claude-opus', hooks: {} }),
      'utf8',
    );

    await install_hook(tmpDir, {
      sessionId,
      hook: { event: 'Stop', handler: 'pnpm verify' },
    });

    const settings = readSettings(tmpDir);
    // Unrelated key must survive the atomic rewrite
    expect(settings['model']).toBe('claude-opus');
  });
});

// ---------------------------------------------------------------------------
// install_hook — collision detection
// ---------------------------------------------------------------------------

describe('install_hook — collision detection', () => {
  it('throws HookCollisionError on exact duplicate (same event AND same handler)', async () => {
    const hook: HookSpec = { event: 'PostToolUse', handler: 'pnpm format' };
    await install_hook(tmpDir, { sessionId, hook });

    await expect(install_hook(tmpDir, { sessionId, hook })).rejects.toThrow(HookCollisionError);
  });

  it('HookCollisionError is an instance of Error', async () => {
    const hook: HookSpec = { event: 'Stop', handler: 'pnpm build' };
    await install_hook(tmpDir, { sessionId, hook });

    const err = await install_hook(tmpDir, { sessionId, hook }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
  });

  it('HookCollisionError message contains the event name', async () => {
    const hook: HookSpec = { event: 'Stop', handler: 'pnpm build' };
    await install_hook(tmpDir, { sessionId, hook });

    const err = await install_hook(tmpDir, { sessionId, hook }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HookCollisionError);
    expect((err as Error).message).toContain('Stop');
  });

  it('does NOT throw when same handler is used for a different event', async () => {
    const handler = 'pnpm lint "$FILE_PATH"';
    await install_hook(tmpDir, { sessionId, hook: { event: 'PostToolUse', handler } });

    // Same handler, different event — must NOT throw
    await expect(
      install_hook(tmpDir, { sessionId, hook: { event: 'PreToolUse', handler } }),
    ).resolves.toBeUndefined();
  });

  it('does NOT throw when same event is used with a different handler', async () => {
    await install_hook(tmpDir, {
      sessionId,
      hook: { event: 'PostToolUse', handler: 'pnpm format' },
    });

    // Same event, different handler — must NOT throw
    await expect(
      install_hook(tmpDir, {
        sessionId,
        hook: { event: 'PostToolUse', handler: 'pnpm lint' },
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// list_hooks
// ---------------------------------------------------------------------------

describe('list_hooks', () => {
  it('returns an empty array when no hooks are installed', async () => {
    const hooks = await list_hooks(tmpDir, sessionId);

    expect(Array.isArray(hooks)).toBe(true);
    expect(hooks).toHaveLength(0);
  });

  it('returns an empty array when settings.json does not exist', async () => {
    expect(fs.existsSync(settingsPath(tmpDir))).toBe(false);

    const hooks = await list_hooks(tmpDir, sessionId);

    expect(hooks).toHaveLength(0);
  });

  it('returns an empty array when settings.json has no hooks key', async () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(settingsPath(tmpDir), JSON.stringify({ model: 'claude-opus' }), 'utf8');

    const hooks = await list_hooks(tmpDir, sessionId);

    expect(hooks).toHaveLength(0);
  });

  it('returns one HookSpec after installing one hook', async () => {
    await install_hook(tmpDir, {
      sessionId,
      hook: { event: 'PostToolUse', handler: 'pnpm format' },
    });

    const hooks = await list_hooks(tmpDir, sessionId);

    expect(hooks).toHaveLength(1);
  });

  it('returned HookSpec has event and handler matching the installed spec', async () => {
    const spec: HookSpec = { event: 'Stop', handler: 'pnpm build' };
    await install_hook(tmpDir, { sessionId, hook: spec });

    const [returned] = await list_hooks(tmpDir, sessionId);

    expect(returned!.event).toBe(spec.event);
    expect(returned!.handler).toBe(spec.handler);
  });

  it('returns a flat array containing all installed hooks (multiple events)', async () => {
    const specs: HookSpec[] = [
      { event: 'PostToolUse', handler: 'pnpm format' },
      { event: 'PostToolUse', handler: 'pnpm lint' },
      { event: 'Stop', handler: 'pnpm build' },
    ];
    for (const s of specs) {
      await install_hook(tmpDir, { sessionId, hook: s });
    }

    const hooks = await list_hooks(tmpDir, sessionId);

    expect(hooks).toHaveLength(3);
  });

  it('flattened list contains every installed handler string', async () => {
    const handlers = ['pnpm format', 'pnpm lint', 'pnpm build'];
    for (const handler of handlers) {
      await install_hook(tmpDir, {
        sessionId,
        hook: { event: 'PostToolUse', handler },
      });
    }

    const hooks = await list_hooks(tmpDir, sessionId);
    const returnedHandlers = hooks.map((h) => h.handler).sort();

    expect(returnedHandlers).toEqual([...handlers].sort());
  });

  it('result is a readonly array (does not require mutation)', async () => {
    await install_hook(tmpDir, { sessionId, hook: { event: 'Stop', handler: 'pnpm build' } });

    const hooks = await list_hooks(tmpDir, sessionId);

    // Structural check — the type is readonly; verify it is iterable and has length
    expect(typeof hooks.length).toBe('number');
    expect(typeof hooks[Symbol.iterator]).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Manifest conformance — Hooks group
// ---------------------------------------------------------------------------

describe('hooks module manifest conformance', () => {
  it('exports all 2 Hooks functions declared in ADAPTER_INTERFACE_MANIFEST', async () => {
    const mod = await import('../src/hooks.js');
    const exported = Object.keys(mod);

    for (const fn of ADAPTER_INTERFACE_MANIFEST['Hooks']) {
      expect(exported, `hooks module must export "${fn}"`).toContain(fn);
    }
  });

  it('HookCollisionError is exported from the hooks module', async () => {
    const mod = await import('../src/hooks.js');
    expect(mod['HookCollisionError']).toBeDefined();
    expect(typeof mod['HookCollisionError']).toBe('function');
  });
});
