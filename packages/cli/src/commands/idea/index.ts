import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { nextMonotonicId } from '../../lib/ids.js';
import { ensureDir, readTextIfExists, writeText } from '../../lib/fs.js';
import { isoNow } from '../../lib/time.js';

function classifyIdea(text: string): { classification: string; depth: string } {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const classification =
    wordCount < 200 ? 'brief' : wordCount > 2000 ? 'concept_note' : 'research_note';
  const depth = wordCount <= 300 ? 'surface' : wordCount <= 2000 ? 'medium' : 'deep';
  return { classification, depth };
}

function collectAnnotations(text: string): {
  claims: string[];
  unknowns: string[];
  decisions: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const claims = lines
    .filter((line) => /\b(must|will|reduce|increase|improve|guarantee)\b/i.test(line))
    .slice(0, 5);
  const unknowns = lines
    .filter((line) => /\b(TBD|\?|unknown|we don't know)\b/i.test(line))
    .slice(0, 5);
  const decisions = lines
    .filter((line) => /\b(use|choose|prefer|defer|picked|selected|decided)\b/i.test(line))
    .slice(0, 5);
  return { claims, unknowns, decisions };
}

export async function runIdeaCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  const [inputPathArg] = args;
  if (!inputPathArg) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'Please pass a path to an input file before running /crux-idea.',
    };
  }

  const sourcePath = path.resolve(context.rootDir, inputPathArg);
  const raw = await readTextIfExists(sourcePath);
  if (raw === null) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `Input file not found: ${inputPathArg}`,
    };
  }

  const inputDir = path.join(context.rootDir, 'docs', 'sdlc', 'input');
  await ensureDir(inputDir);
  const ideaId = await nextMonotonicId(inputDir, 'IDEA', '.md');
  const { classification, depth } = classifyIdea(raw);
  const annotations = collectAnnotations(raw);
  const outputPath = path.join(inputDir, `${ideaId}.md`);

  const body = [
    '---',
    `id: ${ideaId}`,
    `ingested_at: ${isoNow(context.now)}`,
    `source_path: ${inputPathArg}`,
    `classification: ${classification}`,
    `depth: ${depth}`,
    'design_gate_enabled: false',
    '---',
    '',
    raw.trimEnd(),
    '',
    '## Crux annotations',
    '',
    '## Claims (unverified)',
    ...(annotations.claims.length > 0
      ? annotations.claims.map((item) => `- ${item}`)
      : ['- None detected.']),
    '',
    '## Unknowns',
    ...(annotations.unknowns.length > 0
      ? annotations.unknowns.map((item) => `- ${item}`)
      : ['- None detected.']),
    '',
    '## Implicit decisions',
    ...(annotations.decisions.length > 0
      ? annotations.decisions.map((item) => `- ${item}`)
      : ['- None detected.']),
    '',
  ].join('\n');

  await writeText(outputPath, body);

  return {
    exitCode: 0,
    stdout:
      `path: docs/sdlc/input/${ideaId}.md\n` +
      `classification: ${classification}\n` +
      `depth: ${depth}\n` +
      `claims=${annotations.claims.length} unknowns=${annotations.unknowns.length} implicit_decisions=${annotations.decisions.length}\n` +
      `Run \`/crux-grill ${ideaId}\` next to interrogate this idea.\n`,
    stderr: '',
  };
}

export const ideaCommand = runIdeaCommand;
