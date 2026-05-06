import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ADAPTER_INTERFACE_MANIFEST } from '../../core/src/adapter/interface.js';

import {
  read_file,
  write_file,
  run_shell,
  PathOutsideRootError,
} from '../src/fs-shell.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-test-fs-shell-'));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTempDir();
});

afterEach(() => {
  removeTempDir(tmpDir);
});

describe('read_file', () => {
  it('reads UTF-8 content from a file under rootDir', async () => {
    const filePath = path.join(tmpDir, 'notes.txt');
    fs.writeFileSync(filePath, 'hello trace', 'utf8');

    const result = await read_file(tmpDir, 'notes.txt');

    expect(result).toBe('hello trace');
  });

  it('rejects a path traversal outside rootDir', async () => {
    await expect(read_file(tmpDir, '../escape.txt')).rejects.toThrow(PathOutsideRootError);
  });
});

describe('write_file', () => {
  it('creates missing parent directories and writes exact content', async () => {
    await write_file(tmpDir, 'nested/deeper/output.txt', 'artifact body');

    const written = fs.readFileSync(path.join(tmpDir, 'nested', 'deeper', 'output.txt'), 'utf8');
    expect(written).toBe('artifact body');
  });

  it('rejects a path traversal outside rootDir', async () => {
    await expect(write_file(tmpDir, '../escape.txt', 'nope')).rejects.toThrow(
      PathOutsideRootError,
    );
  });
});

describe('run_shell', () => {
  it('returns stdout and exitCode for a successful command', async () => {
    const result = await run_shell(tmpDir, `node -e "process.stdout.write('shell-ok')"`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('shell-ok');
    expect(result.stderr).toBe('');
  });

  it('returns stderr and a non-zero exitCode for a failing command', async () => {
    const result = await run_shell(
      tmpDir,
      `node -e "process.stderr.write('shell-fail'); process.exit(7)"`,
    );

    expect(result.exitCode).toBe(7);
    expect(result.stderr).toContain('shell-fail');
  });
});

describe('fs-shell module manifest conformance', () => {
  it('exports all 3 FilesystemShell functions declared in ADAPTER_INTERFACE_MANIFEST', async () => {
    const mod = await import('../src/fs-shell.js');
    const exported = Object.keys(mod);

    for (const fn of ADAPTER_INTERFACE_MANIFEST['FilesystemShell']) {
      expect(exported, `fs-shell module must export "${fn}"`).toContain(fn);
    }
  });

  it('PathOutsideRootError is exported from the fs-shell module', async () => {
    const mod = await import('../src/fs-shell.js');

    expect(mod['PathOutsideRootError']).toBeDefined();
    expect(typeof mod['PathOutsideRootError']).toBe('function');
  });
});
