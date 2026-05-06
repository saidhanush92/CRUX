/**
 * skills.ts
 *
 * Skills concern group for the Claude Code adapter.
 * Implements: install_skill, uninstall_skill, list_skills
 */

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import type { SessionId, SkillId } from '../../core/src/adapter/types.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SkillSourceMissingError extends Error {
  constructor(source: string) {
    super(`SKILL.md not found at source: ${source}`);
    this.name = 'SkillSourceMissingError';
  }
}

export class SkillAlreadyPresentError extends Error {
  constructor(skillName: string) {
    super(`Skill already installed: ${skillName}`);
    this.name = 'SkillAlreadyPresentError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstallSkillOptions {
  readonly sessionId: SessionId;
  readonly skillName: string;
  readonly source: string;
}

export interface InstallSkillResult {
  readonly skillId: SkillId;
  readonly path: string;
}

export interface UninstallSkillOptions {
  readonly sessionId: SessionId;
  readonly skillName: string;
}

export interface SkillDescriptorLocal {
  readonly id: SkillId;
  readonly skillId: SkillId;
  readonly name: string;
  readonly path: string;
  readonly version?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function skillsBaseDir(rootDir: string): string {
  return path.join(rootDir, '.claude', 'skills');
}

function skillDir(rootDir: string, skillName: string): string {
  return path.join(skillsBaseDir(rootDir), skillName);
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function install_skill(
  rootDir: string,
  options: InstallSkillOptions,
): Promise<InstallSkillResult> {
  const { skillName, source } = options;

  const sourceMd = path.join(source, 'SKILL.md');
  if (!fs.existsSync(sourceMd)) {
    throw new SkillSourceMissingError(source);
  }

  const destDir = skillDir(rootDir, skillName);
  if (fs.existsSync(destDir)) {
    throw new SkillAlreadyPresentError(skillName);
  }

  await fsPromises.mkdir(destDir, { recursive: true });
  await fsPromises.copyFile(sourceMd, path.join(destDir, 'SKILL.md'));

  const skillId = skillName as SkillId;
  return { id: skillId, skillId, path: destDir };
}

export async function uninstall_skill(
  rootDir: string,
  options: UninstallSkillOptions,
): Promise<void> {
  const { skillName } = options;
  const dir = skillDir(rootDir, skillName);
  await fsPromises.rm(dir, { recursive: true, force: true });
}

export async function list_skills(
  rootDir: string,
  _sessionId: SessionId,
): Promise<readonly SkillDescriptorLocal[]> {
  const base = skillsBaseDir(rootDir);

  if (!fs.existsSync(base)) {
    return [];
  }

  const entries = await fsPromises.readdir(base, { withFileTypes: true });
  const results: SkillDescriptorLocal[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMd = path.join(base, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    const dir = path.join(base, entry.name);
    const entrySkillId = entry.name as SkillId;
    results.push({
      id: entrySkillId,
      skillId: entrySkillId,
      name: entry.name,
      path: dir,
    });
  }

  return results;
}
