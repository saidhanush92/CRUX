/**
 * interface.ts
 *
 * Declares the RuntimeAdapter interface and its companion manifest constants,
 * as specified by ADR-CRUX-003 (17 functions, 7 concern groups).
 *
 * ADAPTER_INTERFACE_MANIFEST is the single source of truth for the function
 * list. AdapterFunctionName is derived from the manifest at the type level,
 * and RuntimeAdapter is a mapped type over AdapterFunctionName — so any
 * desync between the manifest and the interface is a compile-time error.
 */

import type {
  SessionId,
  SubagentHandle,
  SkillId,
  CapabilityId,
  HookSpec,
  Event,
  ShellResult,
  SessionOptions,
  SpawnOptions,
  SkillDescriptor,
  HookDescriptor,
  CapabilityMap,
} from './types.js';

// ---------------------------------------------------------------------------
// Single source of truth: concern groups → function names (deeply readonly)
// ---------------------------------------------------------------------------

export const ADAPTER_INTERFACE_MANIFEST = {
  Lifecycle: ['session_start', 'session_end', 'capabilities_supported'],
  Subagents: ['spawn_subagent', 'await_subagent'],
  Skills: ['install_skill', 'uninstall_skill', 'list_skills'],
  Hooks: ['install_hook', 'list_hooks'],
  SlashCommands: ['run_command'],
  FilesystemShell: ['read_file', 'write_file', 'run_shell'],
  TraceCapability: ['emit_event', 'resolve_capability', 'invoke_skill'],
} as const satisfies Record<string, readonly string[]>;

// ---------------------------------------------------------------------------
// Derived type: the union of every function name in the manifest
// ---------------------------------------------------------------------------

export type AdapterFunctionName =
  (typeof ADAPTER_INTERFACE_MANIFEST)[keyof typeof ADAPTER_INTERFACE_MANIFEST][number];

// ---------------------------------------------------------------------------
// Derived constant: ordered tuple of the 7 concern-group names
// ---------------------------------------------------------------------------

export const ADAPTER_CONCERN_GROUPS = [
  'Lifecycle',
  'Subagents',
  'Skills',
  'Hooks',
  'SlashCommands',
  'FilesystemShell',
  'TraceCapability',
] as const satisfies readonly (keyof typeof ADAPTER_INTERFACE_MANIFEST)[];

export type AdapterConcernGroup = (typeof ADAPTER_CONCERN_GROUPS)[number];

// ---------------------------------------------------------------------------
// Per-function signature map — one entry per AdapterFunctionName.
// Adding a name to the manifest without a matching entry here is a typecheck
// error; removing a name from the manifest silently narrows RuntimeAdapter.
// ---------------------------------------------------------------------------

interface AdapterSignatures {
  session_start(options?: SessionOptions): Promise<SessionId>;
  session_end(sessionId: SessionId): Promise<void>;
  capabilities_supported(): Promise<CapabilityMap>;

  spawn_subagent(options?: SpawnOptions): Promise<SubagentHandle>;
  await_subagent(handle: SubagentHandle): Promise<void>;

  install_skill(id: SkillId): Promise<void>;
  uninstall_skill(id: SkillId): Promise<void>;
  list_skills(): Promise<readonly SkillDescriptor[]>;

  install_hook(spec: HookSpec): Promise<void>;
  list_hooks(): Promise<readonly HookDescriptor[]>;

  run_command(command: string, args?: readonly string[]): Promise<string>;

  read_file(path: string): Promise<string>;
  write_file(path: string, content: string): Promise<void>;
  run_shell(command: string): Promise<ShellResult>;

  emit_event(event: Event): Promise<void>;
  resolve_capability(id: CapabilityId): Promise<boolean>;
  invoke_skill(id: SkillId, input: unknown): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// RuntimeAdapter — keys are exactly AdapterFunctionName (derived from the
// manifest), signatures come from AdapterSignatures. If a name exists in
// AdapterSignatures but not in the manifest it is simply unused. If a name
// exists in the manifest but not in AdapterSignatures, TypeScript infers the
// property type as `never`, breaking any concrete implementation immediately.
// ---------------------------------------------------------------------------

/** The canonical runtime adapter interface for Crux v1.0. */
export type RuntimeAdapter = {
  [K in AdapterFunctionName]: AdapterSignatures[K];
};
