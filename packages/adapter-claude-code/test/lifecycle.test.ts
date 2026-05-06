/**
 * lifecycle.test.ts
 *
 * Tests for the Lifecycle concern group (ADR-CRUX-003):
 *   session_start, session_end, capabilities_supported
 *
 * Also locks the manifest-conformance contract for the 10 functions
 * delivered by TASK-CRUX-008 (Lifecycle + Subagents + Skills + Hooks).
 *
 * All tests are RED until the coder creates:
 *   packages/adapter-claude-code/src/lifecycle.ts
 *   packages/adapter-claude-code/package.json
 *   packages/adapter-claude-code/tsconfig.json
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Types imported directly from core source (monorepo internal, no build needed)
import type { SessionId, SessionOptions, CapabilityMap } from '../../core/src/adapter/types.js';
import { ADAPTER_INTERFACE_MANIFEST } from '../../core/src/adapter/interface.js';

// ---------------------------------------------------------------------------
// Subject under test — the coder MUST export these named symbols from lifecycle.ts
// ---------------------------------------------------------------------------

import {
  session_start,
  session_end,
  capabilities_supported,
  UnknownSessionError,
} from '../src/lifecycle.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fresh SessionId by calling session_start with no args. */
async function startSession(opts?: SessionOptions): Promise<SessionId> {
  return session_start(opts);
}

// ---------------------------------------------------------------------------
// session_start
// ---------------------------------------------------------------------------

describe('session_start', () => {
  it('returns a non-empty string (SessionId brand)', async () => {
    // Arrange — no preconditions needed

    // Act
    const id = await startSession();

    // Assert
    expect(typeof id).toBe('string');
    expect((id as string).length).toBeGreaterThan(0);
  });

  it('returns a UUID-shaped string (v4)', async () => {
    // UUID v4 pattern: 8-4-4-4-12 hex chars, version nibble = 4
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const id = await startSession();

    expect(id as string).toMatch(uuidPattern);
  });

  it('two consecutive calls produce distinct session IDs', async () => {
    const id1 = await startSession();
    const id2 = await startSession();

    expect(id1).not.toBe(id2);
  });

  it('accepts a SessionOptions argument without throwing', async () => {
    // Arrange
    const opts: SessionOptions = { metadata: { mode: 'test' } };

    // Act + Assert (must not throw)
    await expect(session_start(opts)).resolves.toBeDefined();
  });

  it('honours a caller-supplied sessionId when provided in options', async () => {
    // Arrange
    const supplied = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as SessionId;

    // Act
    const returned = await session_start({ sessionId: supplied });

    // Assert — the adapter must track the supplied ID and return it
    expect(returned).toBe(supplied);
  });
});

// ---------------------------------------------------------------------------
// session_end
// ---------------------------------------------------------------------------

describe('session_end', () => {
  let knownSessionId: SessionId;

  beforeEach(async () => {
    knownSessionId = await startSession();
  });

  it('resolves (returns void/undefined) for a known session', async () => {
    await expect(session_end(knownSessionId)).resolves.toBeUndefined();
  });

  it('throws UnknownSessionError for a session ID that was never started', async () => {
    const ghost = 'deadbeef-dead-4bef-8eef-deadbeefcafe' as SessionId;

    await expect(session_end(ghost)).rejects.toThrow(UnknownSessionError);
  });

  it('throws UnknownSessionError when ending a session that has already been ended', async () => {
    // First end — must succeed
    await session_end(knownSessionId);

    // Second end of same session — must throw (sessions are removed from the map)
    await expect(session_end(knownSessionId)).rejects.toThrow(UnknownSessionError);
  });

  it('UnknownSessionError message contains the offending session ID', async () => {
    const ghost = 'deadbeef-dead-4bef-8eef-deadbeefcafe' as SessionId;

    const err = await session_end(ghost).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnknownSessionError);
    expect((err as Error).message).toContain(ghost);
  });

  it('UnknownSessionError is an instance of Error', async () => {
    const ghost = 'feedface-feed-4ace-8ace-feedfacecafe' as SessionId;

    const err = await session_end(ghost).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// capabilities_supported
// ---------------------------------------------------------------------------

describe('capabilities_supported', () => {
  it('resolves to a CapabilityMap with a "supported" array', async () => {
    const map: CapabilityMap = await capabilities_supported();

    expect(map).toBeDefined();
    expect(typeof map).toBe('object');
    expect(Array.isArray(map.supported)).toBe(true);
  });

  it('"supported" array is non-empty', async () => {
    const { supported } = await capabilities_supported();

    expect(supported.length).toBeGreaterThan(0);
  });

  it('includes "process.run-shell" capability', async () => {
    const { supported } = await capabilities_supported();

    expect(supported).toContain('process.run-shell');
  });

  it('includes "quality.coverage-floor" capability', async () => {
    const { supported } = await capabilities_supported();

    expect(supported).toContain('quality.coverage-floor');
  });

  it('includes "testing.tdd-loop" capability (registered in capabilities/registry.v1.yaml)', async () => {
    const { supported } = await capabilities_supported();

    expect(supported).toContain('testing.tdd-loop');
  });

  it('all returned capability IDs are non-empty strings', async () => {
    const { supported } = await capabilities_supported();

    for (const id of supported) {
      expect(typeof id).toBe('string');
      expect((id as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Manifest conformance — 10-function subset (TASK-CRUX-008 concern groups)
// ---------------------------------------------------------------------------

const TASK_008_GROUPS = ['Lifecycle', 'Subagents', 'Skills', 'Hooks'] as const;
const TASK_008_FNS = TASK_008_GROUPS.flatMap((g) => [...ADAPTER_INTERFACE_MANIFEST[g]]);

describe('adapter manifest conformance for TASK-CRUX-008 groups', () => {
  it('ADAPTER_INTERFACE_MANIFEST exposes all 4 concern groups covered by this task', () => {
    for (const group of TASK_008_GROUPS) {
      expect(
        ADAPTER_INTERFACE_MANIFEST[group],
        `manifest must contain group "${group}"`,
      ).toBeDefined();
    }
  });

  it('TASK-CRUX-008 covers exactly 10 functions across Lifecycle + Subagents + Skills + Hooks', () => {
    expect(TASK_008_FNS).toHaveLength(10);
  });

  it('lifecycle module exports all 3 Lifecycle functions as named exports', async () => {
    const mod = await import('../src/lifecycle.js');
    const exported = Object.keys(mod);

    for (const fn of ADAPTER_INTERFACE_MANIFEST['Lifecycle']) {
      expect(exported, `lifecycle module must export "${fn}"`).toContain(fn);
    }
  });

  it('UnknownSessionError is exported from the lifecycle module', async () => {
    const mod = await import('../src/lifecycle.js');
    expect(mod['UnknownSessionError']).toBeDefined();
    expect(typeof mod['UnknownSessionError']).toBe('function');
  });
});
