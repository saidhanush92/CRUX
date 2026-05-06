/**
 * path-utils.ts
 *
 * Shared filesystem path helpers used by both cache.ts and markdown.ts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Strip a doubled Windows drive prefix if the path does not exist as-is.
 * Detects pattern X:\X:\... and returns the inner X:\... portion.
 */
export function stripDoubledDrivePrefix(p: string): string {
  const sep = path.sep;
  const firstSepIdx = p.indexOf(sep);
  if (firstSepIdx > 0) {
    const afterFirstSep = p.slice(firstSepIdx + 1);
    if (/^[A-Za-z]:/.test(afterFirstSep) && !fs.existsSync(p)) {
      return afterFirstSep;
    }
  }
  return p;
}
