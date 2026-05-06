/**
 * subagents.ts
 *
 * Subagents concern group for the Claude Code adapter.
 * Implements: spawn_subagent, await_subagent
 *
 * ADR-CRUX-004: Each request file contains ONLY this subagent's prompt —
 * no shared context across subagent request files.
 */

import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SessionId, SubagentHandle } from '../../core/src/adapter/types.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SubagentTimeoutError extends Error {
  constructor(handle: SubagentHandle) {
    super(`Subagent timed out waiting for response: ${handle as string}`);
    this.name = 'SubagentTimeoutError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnSubagentOptions {
  readonly sessionId: SessionId;
  readonly agentName: string;
  readonly prompt: string;
  readonly isolated?: boolean;
}

export interface AwaitSubagentOptions {
  readonly timeoutMs: number;
  readonly pollMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function subagentsDir(rootDir: string): string {
  return path.join(rootDir, '.crux', 'subagents');
}

function requestFilePath(rootDir: string, handleId: string): string {
  return path.join(subagentsDir(rootDir), `${handleId}.request.json`);
}

function responseFilePath(rootDir: string, handleId: string): string {
  return path.join(subagentsDir(rootDir), `${handleId}.response.json`);
}

function extractHandleId(handle: SubagentHandle): string {
  const str = handle as string;
  const lastColon = str.lastIndexOf(':');
  return lastColon >= 0 ? str.slice(lastColon + 1) : str;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function spawn_subagent(
  rootDir: string,
  options: SpawnSubagentOptions,
): Promise<SubagentHandle> {
  const { sessionId, agentName, prompt, isolated = true } = options;
  const handleId = randomUUID();
  const handle = `${sessionId as string}:${handleId}` as SubagentHandle;

  const dir = subagentsDir(rootDir);
  await fsPromises.mkdir(dir, { recursive: true });

  const requestData = {
    sessionId: sessionId as string,
    agentName,
    prompt,
    isolated,
    ts: Date.now(),
  };

  await fsPromises.writeFile(
    requestFilePath(rootDir, handleId),
    JSON.stringify(requestData),
    'utf8',
  );

  return handle;
}

export async function await_subagent(
  rootDir: string,
  handle: SubagentHandle,
  options: AwaitSubagentOptions,
): Promise<void> {
  const { timeoutMs, pollMs = 10 } = options;
  const handleId = extractHandleId(handle);
  const responsePath = responseFilePath(rootDir, handleId);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const exists = await fsPromises.access(responsePath).then(
      () => true,
      () => false,
    );
    if (exists) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
  }

  throw new SubagentTimeoutError(handle);
}
