import * as path from 'node:path';
import { listFiles } from './fs.js';

export async function nextMonotonicId(
  dirPath: string,
  prefix: string,
  extension: string,
): Promise<string> {
  const files = await listFiles(dirPath);
  const regex = new RegExp(`^${prefix}-(\\d+)\\${extension}$`);

  let maxSeen = 0;
  for (const filePath of files) {
    const name = path.basename(filePath);
    const match = regex.exec(name);
    if (!match) continue;
    const value = Number.parseInt(match[1] ?? '0', 10);
    if (value > maxSeen) {
      maxSeen = value;
    }
  }

  return `${prefix}-${String(maxSeen + 1).padStart(3, '0')}`;
}
