import * as path from 'node:path';
import { exists, listFilesRecursive, readTextIfExists, readYamlFile } from './fs.js';

export interface ArtifactLocation {
  readonly id: string;
  readonly filePath: string;
  readonly type: string;
}

const PREFIX_DIRS: Readonly<Record<string, string>> = {
  IDEA: path.join('docs', 'sdlc', 'input'),
  GRILL: path.join('docs', 'sdlc', 'grill'),
  REQ: path.join('docs', 'sdlc', 'prd'),
  MOD: path.join('docs', 'sdlc', 'modules'),
  ADR: path.join('docs', 'sdlc', 'adr'),
  TASK: path.join('docs', 'sdlc', 'tasks'),
  CHG: path.join('docs', 'sdlc', 'chg'),
  INC: path.join('docs', 'sdlc', 'incidents'),
  AMD: path.join('docs', 'sdlc', 'amendments'),
};

export function artifactPrefixToDir(prefix: string): string | null {
  return PREFIX_DIRS[prefix] ?? null;
}

export async function locateArtifact(
  rootDir: string,
  id: string,
): Promise<ArtifactLocation | null> {
  const prefix = id.split('-')[0] ?? '';
  if (id === 'PRD') {
    const filePath = path.join(rootDir, 'docs', 'sdlc', 'prd', 'PRD.md');
    return exists(filePath) ? { id, filePath, type: 'PRD' } : null;
  }

  const relativeDir = artifactPrefixToDir(prefix);
  if (!relativeDir) {
    return null;
  }

  const dirPath = path.join(rootDir, relativeDir);
  const files = await listFilesRecursive(dirPath);
  const match = files.find((filePath) => path.basename(filePath).startsWith(`${id}.`));
  return match ? { id, filePath: match, type: prefix } : null;
}

export async function readArtifactSummary(filePath: string): Promise<string> {
  if (filePath.endsWith('.md')) {
    const raw = (await readTextIfExists(filePath)) ?? '';
    const firstHeading = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('#'));
    return firstHeading ?? path.basename(filePath);
  }

  const data = await readYamlFile(filePath);
  const fields = ['title', 'text', 'responsibility', 'decision', 'question', 'trigger_event'];
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim().split(/\r?\n/)[0] ?? path.basename(filePath);
    }
  }
  return path.basename(filePath);
}
