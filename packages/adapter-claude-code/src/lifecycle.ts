/**
 * lifecycle.ts
 *
 * Lifecycle concern group for the Claude Code adapter.
 * Implements: session_start, session_end, capabilities_supported
 */

import { randomUUID } from 'node:crypto';
import type {
  SessionId,
  SessionOptions,
  CapabilityMap,
  CapabilityId,
} from '../../core/src/adapter/types.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UnknownSessionError extends Error {
  constructor(sessionId: SessionId) {
    super(`Unknown session: ${sessionId}`);
    this.name = 'UnknownSessionError';
  }
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

interface SessionState {
  readonly sessionId: SessionId;
  readonly startedAt: number;
  readonly metadata: Record<string, unknown>;
}

const sessions = new Map<SessionId, SessionState>();

// ---------------------------------------------------------------------------
// Hardcoded fallback capability set (used when no registry file is present)
// ---------------------------------------------------------------------------

const FALLBACK_CAPABILITIES: readonly CapabilityId[] = [
  'process.run-shell' as CapabilityId,
  'quality.coverage-floor' as CapabilityId,
  'testing.tdd-loop' as CapabilityId,
];

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function session_start(opts?: SessionOptions): Promise<SessionId> {
  const sessionId: SessionId = opts?.sessionId ?? (randomUUID() as SessionId);

  const state: SessionState = {
    sessionId,
    startedAt: Date.now(),
    metadata: opts?.metadata ?? {},
  };

  sessions.set(sessionId, state);
  return sessionId;
}

export async function session_end(sessionId: SessionId): Promise<void> {
  if (!sessions.has(sessionId)) {
    throw new UnknownSessionError(sessionId);
  }
  sessions.delete(sessionId);
}

export async function capabilities_supported(): Promise<CapabilityMap> {
  return { supported: FALLBACK_CAPABILITIES };
}
