import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { parseYaml } from '../../../core/src/trace/markdown.js';

export function resolveRootPath(rootDir: string, ...parts: string[]): string {
  return path.join(rootDir, ...parts);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fsp.mkdir(dirPath, { recursive: true });
}

export async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, content, 'utf8');
}

export async function appendText(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fsp.appendFile(filePath, content, 'utf8');
}

export async function readYamlFile(filePath: string): Promise<Record<string, unknown>> {
  const raw = await fsp.readFile(filePath, 'utf8');
  return parseYaml(raw);
}

export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => path.join(dirPath, entry.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function listFilesRecursive(dirPath: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(next);
      } else if (entry.isFile()) {
        out.push(next);
      }
    }
  }

  await walk(dirPath);
  return out;
}
