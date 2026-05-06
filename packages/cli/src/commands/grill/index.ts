import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { nextMonotonicId } from '../../lib/ids.js';
import { ensureDir, readTextIfExists, writeText } from '../../lib/fs.js';
import { isoNow } from '../../lib/time.js';

function questionBudget(text: string): {
  count: number;
  warning: string | null;
  confidence: string;
} {
  const body = text.includes('\n---\n')
    ? text
        .split(/\n---\n/u)
        .slice(1)
        .join('\n---\n')
    : text;
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 50) return { count: 6, warning: 'input too thin', confidence: 'low' };
  if (wordCount <= 300) return { count: 10, warning: null, confidence: 'medium' };
  if (wordCount <= 2000) return { count: 17, warning: null, confidence: 'high' };
  return { count: 24, warning: null, confidence: 'high' };
}

export async function runGrillCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  const [ideaId] = args;
  if (!ideaId) {
    return { exitCode: 1, stdout: '', stderr: 'Pass an IDEA id to /crux-grill.' };
  }

  const ideaPath = path.join(context.rootDir, 'docs', 'sdlc', 'input', `${ideaId}.md`);
  const raw = await readTextIfExists(ideaPath);
  if (raw === null) {
    return { exitCode: 1, stdout: '', stderr: `Missing IDEA file for ${ideaId}` };
  }

  if (!raw.includes('design_gate_enabled:')) {
    const updated = raw.replace(
      /(depth:\s*[^\n]+\n)/u,
      (_match, prefix: string) => `${prefix}design_gate_enabled: false\n`,
    );
    await writeText(ideaPath, updated);
  }

  const { count, warning, confidence } = questionBudget(raw);
  const grillDir = path.join(context.rootDir, 'docs', 'sdlc', 'grill');
  await ensureDir(grillDir);

  const written: string[] = [];
  for (let index = 0; index < count; index++) {
    const grillId = await nextMonotonicId(grillDir, 'GRILL', '.yaml');
    const filePath = path.join(grillDir, `${grillId}.yaml`);
    const gate = (index % 8) + 1;
    await writeText(
      filePath,
      [
        `id: ${grillId}`,
        `idea: ${ideaId}`,
        `gate: ${gate}`,
        'question: |',
        `  What assumption at gate ${gate} should be clarified for ${ideaId}?`,
        'answer: null',
        `confidence: ${confidence}`,
        'source: inferred',
        'asked_by: grill-interviewer',
        `answered_at: ${isoNow(context.now)}`,
        'state: pending',
        'supersedes: null',
        '',
      ].join('\n'),
    );
    written.push(grillId);
  }

  return {
    exitCode: 0,
    stdout:
      `${warning ? `${warning}\n` : ''}` +
      `Generated ${written.length} grill questions for ${ideaId}.\n` +
      'Questions were written as pending GRILL artifacts for later human answers.\n' +
      'design_gate_enabled: false\n',
    stderr: '',
  };
}

export const grillCommand = runGrillCommand;
