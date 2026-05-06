/**
 * fs-shell.ts
 *
 * FilesystemShell concern group for the Claude Code adapter.
 * Implements: read_file, write_file, run_shell
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import type { ShellResult } from '../../core/src/adapter/types.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PathOutsideRootError extends Error {
  constructor(targetPath: string) {
    super(`Path resolves outside adapter rootDir: ${targetPath}`);
    this.name = 'PathOutsideRootError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveWithinRoot(rootDir: string, targetPath: string): string {
  const absoluteRoot = path.resolve(rootDir);
  const resolved = path.resolve(absoluteRoot, targetPath);
  const relative = path.relative(absoluteRoot, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathOutsideRootError(targetPath);
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function read_file(rootDir: string, filePath: string): Promise<string> {
  const resolved = resolveWithinRoot(rootDir, filePath);
  return fs.readFile(resolved, 'utf8');
}

export async function write_file(
  rootDir: string,
  filePath: string,
  content: string,
): Promise<void> {
  const resolved = resolveWithinRoot(rootDir, filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, 'utf8');
}

export async function run_shell(rootDir: string, command: string): Promise<ShellResult> {
  return new Promise<ShellResult>((resolve) => {
    exec(command, { cwd: rootDir }, (error, stdout, stderr) => {
      const exitCode = typeof error?.code === 'number' ? error.code : error ? 1 : 0;

      resolve({
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}
