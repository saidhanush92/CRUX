/**
 * index.ts
 *
 * Barrel re-export of all concern groups for the Claude Code adapter,
 * plus the createClaudeCodeAdapter factory that proves the 10 implemented
 * functions satisfy the RuntimeAdapter interface shape at compile time.
 */

export * from './lifecycle.js';
export * from './subagents.js';
export * from './skills.js';
export * from './hooks.js';
export * from './commands.js';
export * from './fs-shell.js';
export * from './trace.js';

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
} from '../../core/src/adapter/types.js';
import type { RuntimeAdapter } from '../../core/src/adapter/interface.js';

import { session_start, session_end, capabilities_supported } from './lifecycle.js';
import { spawn_subagent, await_subagent } from './subagents.js';
import { install_skill, uninstall_skill, list_skills } from './skills.js';
import { install_hook, list_hooks } from './hooks.js';
import { run_command } from './commands.js';
import { read_file, write_file, run_shell } from './fs-shell.js';
import { emit_event, resolve_capability, invoke_skill } from './trace.js';

/**
 * Creates a Claude Code RuntimeAdapter bound to the given rootDir.
 *
 * The `satisfies RuntimeAdapter` assertion on the returned object literal is the
 * compile-time guard: TypeScript verifies that every one of the 17 AdapterFunctionName
 * keys is present and that each function's parameter and return types match the
 * AdapterSignatures declared in packages/core/src/adapter/interface.ts. If any
 * signature diverges, tsc reports an error at this call site — not silently at runtime.
 *
 * The 10 functions covered by TASK-CRUX-008 (Lifecycle + Subagents + Skills + Hooks)
 * delegate directly to the corresponding concern-group helpers, threading `rootDir`
 * into the helpers' extended signatures. The remaining 7 functions (SlashCommands,
 * FilesystemShell, TraceCapability) are out of scope for v1.0 and throw a typed
 * "not implemented" error so callers receive actionable feedback rather than a
 * silent no-op.
 */
export function createClaudeCodeAdapter(rootDir: string): RuntimeAdapter {
  const skillSourceDir = (id: SkillId): string =>
    `${rootDir}/.claude/.skill-sources/${id as string}/`;

  return {
    // -------------------------------------------------------------------------
    // Lifecycle (3)
    // -------------------------------------------------------------------------
    session_start: (opts?: SessionOptions): Promise<SessionId> => session_start(opts),

    session_end: (id: SessionId): Promise<void> => session_end(id),

    capabilities_supported: (): Promise<CapabilityMap> => capabilities_supported(),

    // -------------------------------------------------------------------------
    // Subagents (2)
    // -------------------------------------------------------------------------
    spawn_subagent: (opts?: SpawnOptions): Promise<SubagentHandle> => {
      const metadata = opts?.metadata ?? {};
      return spawn_subagent(rootDir, {
        sessionId: (metadata['sessionId'] as SessionId | undefined) ?? ('' as SessionId),
        agentName: (metadata['agentName'] as string | undefined) ?? 'default',
        prompt: (metadata['prompt'] as string | undefined) ?? '',
        isolated: true,
      });
    },

    await_subagent: (handle: SubagentHandle): Promise<void> =>
      await_subagent(rootDir, handle, { timeoutMs: 30_000 }),

    // -------------------------------------------------------------------------
    // Skills (3)
    // -------------------------------------------------------------------------
    install_skill: (id: SkillId): Promise<void> =>
      install_skill(rootDir, {
        sessionId: '' as SessionId,
        skillName: id as string,
        source: skillSourceDir(id),
      }).then(() => undefined),

    uninstall_skill: (id: SkillId): Promise<void> =>
      uninstall_skill(rootDir, {
        sessionId: '' as SessionId,
        skillName: id as string,
      }),

    list_skills: (): Promise<readonly SkillDescriptor[]> =>
      list_skills(rootDir, '' as SessionId).then((items) =>
        items.map((item) => ({
          id: item.id,
          name: item.name,
          version: item.version,
        })),
      ),

    // -------------------------------------------------------------------------
    // Hooks (2)
    // -------------------------------------------------------------------------
    install_hook: (spec: HookSpec): Promise<void> =>
      install_hook(rootDir, {
        sessionId: '' as SessionId,
        hook: spec,
      }),

    list_hooks: (): Promise<readonly HookDescriptor[]> =>
      list_hooks(rootDir, '' as SessionId).then((items) =>
        items.map((item) => ({ event: item.event, handler: item.handler })),
      ),

    // -------------------------------------------------------------------------
    // SlashCommands (1) — not implemented in v1.0
    // -------------------------------------------------------------------------
    run_command: (command: string, args?: readonly string[]): Promise<string> =>
      run_command(command, args),

    // -------------------------------------------------------------------------
    // FilesystemShell (3) — not implemented in v1.0
    // -------------------------------------------------------------------------
    read_file: (filePath: string): Promise<string> => read_file(rootDir, filePath),

    write_file: (filePath: string, content: string): Promise<void> =>
      write_file(rootDir, filePath, content),

    run_shell: (command: string): Promise<ShellResult> => run_shell(rootDir, command),

    // -------------------------------------------------------------------------
    // TraceCapability (3) — not implemented in v1.0
    // -------------------------------------------------------------------------
    emit_event: (event: Event): Promise<void> => emit_event(rootDir, event),

    resolve_capability: (id: CapabilityId): Promise<boolean> => resolve_capability(rootDir, id),

    invoke_skill: (id: SkillId, input: unknown): Promise<unknown> =>
      invoke_skill(rootDir, id, input),
  } satisfies RuntimeAdapter;
}
