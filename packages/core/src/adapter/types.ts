/**
 * types.ts
 *
 * Supporting types for the RuntimeAdapter interface.
 * All types are plain structural shapes; no external dependencies.
 */

/** Branded ID types — string at runtime, distinct at the type level. */
export type SessionId = string & { readonly __brand: 'SessionId' };
export type SubagentHandle = string & { readonly __brand: 'SubagentHandle' };
export type SkillId = string & { readonly __brand: 'SkillId' };
export type CapabilityId = string & { readonly __brand: 'CapabilityId' };

/** Describes a hook to install: a lifecycle event name and the handler source. */
export interface HookSpec {
  readonly event: string;
  readonly handler: string;
}

/** A discrete trace event emitted during a session. */
export interface Event {
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp?: number;
}

/** The result of a shell command execution. */
export interface ShellResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Options passed when starting a new session. */
export interface SessionOptions {
  readonly sessionId?: SessionId;
  readonly metadata?: Record<string, unknown>;
}

/** Options for spawning a subagent. */
export interface SpawnOptions {
  readonly skillIds?: readonly SkillId[];
  readonly metadata?: Record<string, unknown>;
}

/** Descriptor for an installed skill. */
export interface SkillDescriptor {
  readonly id: SkillId;
  readonly name: string;
  readonly version?: string;
}

/** Descriptor for an installed hook. */
export interface HookDescriptor {
  readonly event: string;
  readonly handler: string;
}

/** Result returned by capabilities_supported. */
export interface CapabilityMap {
  readonly supported: readonly CapabilityId[];
}
