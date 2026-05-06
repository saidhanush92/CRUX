/**
 * subagents.test.ts
 *
 * Tests for the Subagents concern group (ADR-CRUX-003 + ADR-CRUX-004):
 *   spawn_subagent, await_subagent
 *
 * Key contracts:
 *  - spawn_subagent writes a .request.json at <rootDir>/.crux/subagents/<handleId>.request.json
 *  - The request file MUST NOT contain any other subagent's prompt (isolation per ADR-004)
 *  - Handle format: "<sessionId>:<randomId>"
 *  - await_subagent polls for .response.json; throws SubagentTimeoutError after timeoutMs
 *  - await_subagent resolves void (result extraction is orchestrator responsibility at v1.0)
 *
 * All tests are RED until the coder creates:
 *   packages/adapter-claude-code/src/subagents.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { SessionId, SubagentHandle } from '../../core/src/adapter/types.js';
import { ADAPTER_INTERFACE_MANIFEST } from '../../core/src/adapter/interface.js';

import { session_start, session_end } from '../src/lifecycle.js';
import { spawn_subagent, await_subagent, SubagentTimeoutError } from '../src/subagents.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-test-subagents-'));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Extracts the handle ID portion from a SubagentHandle.
 * A handle is "<sessionId>:<handleId>" where sessionId is itself a UUID (with hyphens),
 * so we split on the LAST colon only.
 */
function handleId(handle: SubagentHandle): string {
  const str = handle as string;
  const lastColon = str.lastIndexOf(':');
  return lastColon >= 0 ? str.slice(lastColon + 1) : str;
}

/**
 * Returns the path to the request file for a given handle.
 */
function requestFilePath(rootDir: string, handle: SubagentHandle): string {
  const hId = handleId(handle);
  return path.join(rootDir, '.crux', 'subagents', `${hId}.request.json`);
}

/** Reads and parses the request file for a given handle. */
function readRequestFile(rootDir: string, handle: SubagentHandle): Record<string, unknown> {
  const raw = fs.readFileSync(requestFilePath(rootDir, handle), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Writes a simulated response file (mimics orchestrator completing the subagent task). */
function writeResponseFile(rootDir: string, handle: SubagentHandle, result: string): void {
  const hId = handleId(handle);
  const dir = path.join(rootDir, '.crux', 'subagents');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${hId}.response.json`), JSON.stringify({ result }), 'utf8');
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
// spawn_subagent
// ---------------------------------------------------------------------------

describe('spawn_subagent', () => {
  it('returns a SubagentHandle (non-empty string)', async () => {
    // Arrange + Act
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'test-writer',
      prompt: 'Write tests for X',
    });

    // Assert
    expect(typeof handle).toBe('string');
    expect((handle as string).length).toBeGreaterThan(0);
  });

  it('handle starts with the sessionId', async () => {
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'coder',
      prompt: 'Implement Y',
    });

    expect((handle as string).startsWith(sessionId as string)).toBe(true);
  });

  it('handle contains a colon separator', async () => {
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'reviewer',
      prompt: 'Review Z',
    });

    expect(handle as string).toContain(':');
  });

  it('writes a .request.json file inside <rootDir>/.crux/subagents/', async () => {
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'reviewer',
      prompt: 'Review this code',
    });

    expect(fs.existsSync(requestFilePath(tmpDir, handle))).toBe(true);
  });

  it('request file is valid JSON', async () => {
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'coder',
      prompt: 'Implement feature A',
    });

    expect(() => readRequestFile(tmpDir, handle)).not.toThrow();
  });

  it('request file contains the agentName', async () => {
    const agentName = 'test-writer';
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName,
      prompt: 'Write tests for feature Z',
    });
    const req = readRequestFile(tmpDir, handle);

    expect(req['agentName']).toBe(agentName);
  });

  it('request file contains the prompt', async () => {
    const prompt = 'Write tests for feature Z — unique-marker-12345';
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'test-writer',
      prompt,
    });
    const req = readRequestFile(tmpDir, handle);

    expect(req['prompt']).toBe(prompt);
  });

  it('request file contains the sessionId', async () => {
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'coder',
      prompt: 'Implement feature A',
    });
    const req = readRequestFile(tmpDir, handle);

    expect(req['sessionId']).toBe(sessionId as string);
  });

  it('two spawns in the same session produce distinct handles', async () => {
    const h1 = await spawn_subagent(tmpDir, { sessionId, agentName: 'test-writer', prompt: 'A' });
    const h2 = await spawn_subagent(tmpDir, { sessionId, agentName: 'coder', prompt: 'B' });

    expect(h1).not.toBe(h2);
  });

  it('isolation (ADR-CRUX-004): second request file does NOT include first agent prompt', async () => {
    // Arrange
    const secretPrompt = 'FIRST-AGENT-SECRET-PLAN-DO-NOT-LEAK';
    const h1 = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'test-writer',
      prompt: secretPrompt,
    });

    // Act
    const h2 = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'coder',
      prompt: 'Implement based on the task brief',
    });

    // Assert — second request file must NOT contain first agent's secret prompt
    const req2 = readRequestFile(tmpDir, h2);
    expect(JSON.stringify(req2)).not.toContain(secretPrompt);

    // And first request file exists independently (sanity)
    expect(fs.existsSync(requestFilePath(tmpDir, h1))).toBe(true);
  });

  it('isolation (ADR-CRUX-004): first request file does NOT include second agent prompt', async () => {
    // Arrange
    const h1 = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'test-writer',
      prompt: 'First agent task',
    });
    const secretPrompt2 = 'SECOND-AGENT-SECRET-PLAN-DO-NOT-LEAK';

    // Act
    await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'coder',
      prompt: secretPrompt2,
    });

    // Assert — first request file (already written) must NOT contain second agent's prompt
    const req1 = readRequestFile(tmpDir, h1);
    expect(JSON.stringify(req1)).not.toContain(secretPrompt2);
  });
});

// ---------------------------------------------------------------------------
// await_subagent
// ---------------------------------------------------------------------------

describe('await_subagent', () => {
  it('resolves void when the response file appears before the timeout', async () => {
    // Arrange
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'coder',
      prompt: 'Quick task',
    });
    writeResponseFile(tmpDir, handle, 'Done successfully');

    // Act + Assert
    await expect(await_subagent(tmpDir, handle, { timeoutMs: 5000 })).resolves.toBeUndefined();
  });

  it('throws SubagentTimeoutError when response file never appears within timeoutMs', async () => {
    // Arrange — deliberately do NOT write response
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'coder',
      prompt: 'Slow task that never finishes',
    });

    // Act + Assert
    await expect(await_subagent(tmpDir, handle, { timeoutMs: 60 })).rejects.toThrow(
      SubagentTimeoutError,
    );
  }, 5000);

  it('SubagentTimeoutError message contains the handle', async () => {
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'reviewer',
      prompt: 'Never finishes',
    });

    const err = await await_subagent(tmpDir, handle, { timeoutMs: 60 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SubagentTimeoutError);
    expect((err as Error).message).toContain(handle as string);
  }, 5000);

  it('SubagentTimeoutError is an instance of Error', async () => {
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'coder',
      prompt: 'Will timeout',
    });

    const err = await await_subagent(tmpDir, handle, { timeoutMs: 60 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
  }, 5000);

  it('return value is undefined — result extraction is orchestrator responsibility at v1.0', async () => {
    const handle = await spawn_subagent(tmpDir, {
      sessionId,
      agentName: 'test-writer',
      prompt: 'Write tests',
    });
    writeResponseFile(tmpDir, handle, 'tests written');

    const result = await await_subagent(tmpDir, handle, { timeoutMs: 5000 });

    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Manifest conformance — Subagents group
// ---------------------------------------------------------------------------

describe('subagents module manifest conformance', () => {
  it('exports all 2 Subagents functions declared in ADAPTER_INTERFACE_MANIFEST', async () => {
    const mod = await import('../src/subagents.js');
    const exported = Object.keys(mod);

    for (const fn of ADAPTER_INTERFACE_MANIFEST['Subagents']) {
      expect(exported, `subagents module must export "${fn}"`).toContain(fn);
    }
  });

  it('SubagentTimeoutError is exported from the subagents module', async () => {
    const mod = await import('../src/subagents.js');
    expect(mod['SubagentTimeoutError']).toBeDefined();
    expect(typeof mod['SubagentTimeoutError']).toBe('function');
  });
});
