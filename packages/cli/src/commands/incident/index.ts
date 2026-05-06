import * as path from 'node:path';
import type { CliContext, CommandResult } from '../../types.js';
import { nextMonotonicId } from '../../lib/ids.js';
import { ensureDir, writeText } from '../../lib/fs.js';

function parseArgs(args: readonly string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] ?? '';
      if (value && !value.startsWith('--')) {
        parsed[key] = value;
        i++;
      }
    }
  }
  return parsed;
}

export function createIncidentCommand() {
  return async function incidentCommand(
    args: readonly string[],
    context: CliContext,
  ): Promise<CommandResult> {
    const [subcommand, ...rest] = args;
    if (subcommand !== 'report') {
      return { exitCode: 1, stdout: '', stderr: 'Usage: /crux-incident report' };
    }

    const parsed = parseArgs(rest);
    const title = parsed['title'] ?? 'Generated incident report';
    const violated = parsed['violated'] ?? 'REQ-CRUX-001';
    const skill = parsed['skill'] ?? 'verification-loop';

    const incidentDir = path.join(context.rootDir, 'docs', 'sdlc', 'incidents');
    const chgDir = path.join(context.rootDir, 'docs', 'sdlc', 'chg');
    const amdDir = path.join(context.rootDir, 'docs', 'sdlc', 'amendments');
    await ensureDir(incidentDir);
    await ensureDir(chgDir);
    await ensureDir(amdDir);

    const incId = await nextMonotonicId(incidentDir, 'INC', '.yaml');
    const chgId = await nextMonotonicId(chgDir, 'CHG', '.yaml');
    const amdId = await nextMonotonicId(amdDir, 'AMD', '.yaml');

    const taskId = await nextMonotonicId(
      path.join(context.rootDir, 'docs', 'sdlc', 'tasks'),
      'TASK',
      '',
    ).catch(() => 'TASK-001');
    const taskDir = path.join(context.rootDir, 'docs', 'sdlc', 'tasks', taskId);
    await ensureDir(taskDir);

    await writeText(
      path.join(incidentDir, `${incId}.yaml`),
      [
        `id: ${incId}`,
        `title: ${title}`,
        'violated:',
        `  - ${violated}`,
        'root_cause: |',
        '  # TODO: complete after investigation',
        'chg_events_opened:',
        `  - ${chgId}`,
        'prevention_tasks:',
        `  - ${taskId}`,
        'amendment_ids:',
        `  - ${amdId}`,
        '',
      ].join('\n'),
    );

    await writeText(
      path.join(chgDir, `${chgId}.yaml`),
      [
        `id: ${chgId}`,
        `trigger_event: "${incId}: ${title}"`,
        'classification: bug',
        'superseded_artifacts: []',
        'new_artifacts: []',
        'affected_artifacts:',
        `  - ${violated}`,
        'source: incident',
        '',
      ].join('\n'),
    );

    await writeText(
      path.join(amdDir, `${amdId}.yaml`),
      [
        `id: ${amdId}`,
        'triggered_by: incident',
        `target_skill: ${skill}`,
        'rule: |',
        '  Prevent this incident class in future verification cycles.',
        'applies_when: |',
        '  An incident report is opened for a build failure.',
        'severity: medium',
        '',
      ].join('\n'),
    );

    await writeText(
      path.join(taskDir, 'TASK.yaml'),
      [
        `id: ${taskId}`,
        `title: Prevent recurrence of ${incId}`,
        `derived_from: ${incId}`,
        'satisfies: []',
        '',
      ].join('\n'),
    );

    return {
      exitCode: 0,
      stdout:
        `${incId} created\n` +
        `${chgId} created\n` +
        `${amdId} created\n` +
        `${taskId} created\n` +
        `Investigate root_cause in ${incId}\n`,
      stderr: '',
    };
  };
}

export async function runIncidentCommand(
  args: readonly string[],
  context: CliContext,
): Promise<CommandResult> {
  return createIncidentCommand()(args, context);
}
