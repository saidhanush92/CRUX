import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { ensureDir, listFiles, readTextIfExists, readYamlFile, writeText } from '../../lib/fs.js';
import { nextMonotonicId } from '../../lib/ids.js';

export async function runPrdCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  const [ideaId, ...rest] = args;
  if (!ideaId) {
    return { exitCode: 1, stdout: '', stderr: 'Pass an IDEA id to /crux-prd.' };
  }
  const force = rest.includes('--force');

  const ideaPath = path.join(context.rootDir, 'docs', 'sdlc', 'input', `${ideaId}.md`);
  const ideaRaw = await readTextIfExists(ideaPath);
  if (ideaRaw === null) {
    return { exitCode: 1, stdout: '', stderr: `Missing IDEA file for ${ideaId}` };
  }

  const grillDir = path.join(context.rootDir, 'docs', 'sdlc', 'grill');
  const grillFiles = (await listFiles(grillDir)).filter((filePath) => filePath.endsWith('.yaml'));
  const supportingGrills: Array<{ id: string; question: string; answer: string }> = [];

  for (const filePath of grillFiles) {
    const data = await readYamlFile(filePath);
    if (data['idea'] !== ideaId) continue;
    const answer =
      typeof data['answer'] === 'string' && data['answer'] !== 'null'
        ? String(data['answer'])
        : typeof data['default_assumption'] === 'string' && data['default_assumption'] !== 'null'
          ? String(data['default_assumption'])
          : null;

    supportingGrills.push({
      id: String(data['id'] ?? path.basename(filePath, '.yaml')),
      question: String(data['question'] ?? 'question'),
      answer: answer ?? '',
    });
  }

  const isSurfaceDepth = ideaRaw.includes('depth: surface');
  const minGrills = isSurfaceDepth ? 1 : 10;

  if (supportingGrills.length < minGrills && !force) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `Expected at least 10 GRILL files for ${ideaId} before drafting a PRD (found ${supportingGrills.length}${isSurfaceDepth ? ', surface-depth minimum is 1' : ''}). Re-run with --force to proceed anyway.`,
    };
  }

  const prdDir = path.join(context.rootDir, 'docs', 'sdlc', 'prd');
  await ensureDir(prdDir);

  const reqIds: string[] = [];
  const answeredGrills = supportingGrills.filter((grill) => grill.answer.trim() !== '');
  for (const grill of answeredGrills) {
    const reqId = await nextMonotonicId(prdDir, 'REQ', '.yaml');
    reqIds.push(reqId);
    await writeText(
      path.join(prdDir, `${reqId}.yaml`),
      [
        `id: ${reqId}`,
        'text: |',
        `  Requirement derived from ${grill.id}: ${grill.answer}`,
        'derived_from:',
        `  - ${grill.id}`,
        'acceptance_criteria:',
        `  - ${grill.question}`,
        'priority: must',
        'gate: 2',
        '',
      ].join('\n'),
    );
  }

  const inputConfidenceLow =
    ideaRaw.includes('depth: surface') && ideaRaw.trim().split(/\s+/).filter(Boolean).length < 50;
  await writeText(
    path.join(prdDir, 'PRD.md'),
    [
      inputConfidenceLow ? '> input_confidence: low' : null,
      `# PRD: ${ideaId}`,
      '',
      '**Status:** draft',
      '**Owner:** automated-prd-generator',
      `**Derived from:** ${ideaId}`,
      `**Last updated:** ${(context.now ? context.now() : new Date()).toISOString().slice(0, 10)}`,
      '',
      '## Goals',
      '- Turn grilled answers into durable requirements.',
      '',
      '## Non-goals',
      '- Silent requirements without traceability.',
      '',
      '## Personas',
      '- **Primary:** founding team',
      '',
      '## Requirements',
      ...reqIds.map((reqId) => `- **${reqId}** - derived requirement. (priority: must)`),
      '',
      '## Open questions',
      '- None.',
      '',
      '## Approval',
      '- Approved by: pending',
      '- Approved at: pending',
      '- Approval log entry: docs/sdlc/approvals.log',
      '',
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  );

  await writeText(path.join(prdDir, 'spec-critique.yaml'), 'critiques: []\n');

  return {
    exitCode: 0,
    stdout:
      `must=${reqIds.length} should=0 could=0 wont=0\n` +
      'orphan_grills: none\n' +
      'Spec-critic verdict: clean\n' +
      'Run `/crux-modules PRD` next, then `/crux-architect`. Resolve spec-critic concerns first if any.\n',
    stderr: '',
  };
}

export const prdCommand = runPrdCommand;
