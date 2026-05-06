/**
 * hooks.ts
 *
 * Hooks concern group for the Claude Code adapter.
 * Implements: install_hook, list_hooks
 */

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import type { SessionId, HookSpec } from '../../core/src/adapter/types.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MalformedSettingsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MalformedSettingsError';
  }
}

export class HookCollisionError extends Error {
  constructor(event: string, handler: string) {
    super(`Hook collision on event "${event}": handler "${handler}" is already registered`);
    this.name = 'HookCollisionError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstallHookOptions {
  readonly sessionId: SessionId;
  readonly hook: HookSpec;
}

interface SettingsFile {
  hooks?: Record<string, HookSpec[]>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function settingsPath(rootDir: string): string {
  return path.join(rootDir, '.claude', 'settings.json');
}

async function readSettings(rootDir: string): Promise<SettingsFile> {
  const filePath = settingsPath(rootDir);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = await fsPromises.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw) as SettingsFile;
  } catch (e) {
    throw new MalformedSettingsError(`malformed settings.json at ${filePath}`, { cause: e });
  }
}

async function writeSettingsAtomic(rootDir: string, settings: SettingsFile): Promise<void> {
  const filePath = settingsPath(rootDir);
  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });

  const tmpPath = path.join(dir, `crux-settings-${Date.now()}-${Math.random()}.tmp`);
  await fsPromises.writeFile(tmpPath, JSON.stringify(settings, null, 2), 'utf8');
  await fsPromises.rename(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function install_hook(rootDir: string, options: InstallHookOptions): Promise<void> {
  const { hook } = options;
  const settings = await readSettings(rootDir);

  const hooks = settings['hooks'] ?? {};
  const eventHooks: HookSpec[] = hooks[hook.event] ?? [];

  const isDuplicate = eventHooks.some(
    (existing) => existing.event === hook.event && existing.handler === hook.handler,
  );

  if (isDuplicate) {
    throw new HookCollisionError(hook.event, hook.handler);
  }

  const updatedEventHooks = [...eventHooks, { event: hook.event, handler: hook.handler }];
  const updatedHooks = { ...hooks, [hook.event]: updatedEventHooks };
  const updatedSettings: SettingsFile = { ...settings, hooks: updatedHooks };

  await writeSettingsAtomic(rootDir, updatedSettings);
}

export async function list_hooks(
  rootDir: string,
  _sessionId: SessionId,
): Promise<readonly HookSpec[]> {
  const settings = await readSettings(rootDir);
  const hooks = settings['hooks'];

  if (!hooks) {
    return [];
  }

  const result: HookSpec[] = [];
  for (const eventHooks of Object.values(hooks)) {
    for (const spec of eventHooks) {
      result.push({ event: spec.event, handler: spec.handler });
    }
  }

  return result;
}
