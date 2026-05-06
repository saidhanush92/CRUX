import * as path from 'node:path';
import { appendText, exists, writeText } from './fs.js';

export async function appendApprovalsLog(rootDir: string, line: string): Promise<void> {
  const logPath = path.join(rootDir, 'docs', 'sdlc', 'approvals.log');
  if (!exists(logPath)) {
    await writeText(
      logPath,
      '# Crux approvals log. Append-only. One line per approval event.\n' +
        '# Format:  <ISO-8601-timestamp>  /crux-approve  <artifact-id>  approved-by=<user>  [extras...]\n',
    );
  }
  await appendText(logPath, `${line}\n`);
}
