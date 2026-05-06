/**
 * trace.ts
 *
 * TraceCapability concern group for the Claude Code adapter.
 * Implements: emit_event, resolve_capability, invoke_skill
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Event, CapabilityId, SkillId } from '../../core/src/adapter/types.js';
import { loadRegistry, hasCapability } from '../../core/src/capabilities/registry.js';
import { resolveAmendmentsForSkill } from '../../core/src/amendments/resolve.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TraceEventWriteError extends Error {
  constructor(filePath: string, options?: ErrorOptions) {
    super(`Unable to persist trace event at ${filePath}`, options);
    this.name = 'TraceEventWriteError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eventLogPath(rootDir: string): string {
  return path.join(rootDir, '.crux', 'trace', 'events.jsonl');
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function emit_event(rootDir: string, event: Event): Promise<void> {
  const filePath = eventLogPath(rootDir);
  const record = {
    ...event,
    timestamp: event.timestamp ?? Date.now(),
  };

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
  } catch (error) {
    throw new TraceEventWriteError(filePath, { cause: error });
  }
}

export async function resolve_capability(rootDir: string, id: CapabilityId): Promise<boolean> {
  const registry = loadRegistry(rootDir);
  return hasCapability(registry, id as string);
}

export async function invoke_skill(
  rootDir: string,
  id: SkillId,
  _input: unknown,
): Promise<unknown> {
  return resolveAmendmentsForSkill(id as string, rootDir);
}
