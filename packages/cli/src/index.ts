import * as path from 'node:path';
import { dispatchCommand } from './dispatch.js';

export async function main(argv: readonly string[], cwd = process.cwd()): Promise<number> {
  const result = await dispatchCommand(argv, {
    rootDir: path.resolve(cwd),
    now: () => new Date(),
  });

  if (result.stdout) {
    process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`);
  }

  return result.exitCode;
}
