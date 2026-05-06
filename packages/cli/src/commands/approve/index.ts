import fs from 'node:fs';
import path from 'node:path';
import { readArtifact, writeArtifact, type Artifact } from '../../../../core/src/trace/markdown.js';
import type { CommandHandler, CommandResult } from '../../types.js';

type ResolvedArtifact =
  | { kind: 'PRD'; id: string; path: string }
  | { kind: 'REQ' | 'ADR' | 'MOD'; id: string; path: string };

function ok(stdout: string): CommandResult {
  return { exitCode: 0, stdout, stderr: '' };
}

function fail(stderr: string): CommandResult {
  return { exitCode: 1, stdout: '', stderr };
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function approverName(): string {
  return (
    process.env.GIT_AUTHOR_NAME ??
    process.env.GIT_COMMITTER_NAME ??
    process.env.USERNAME ??
    process.env.USER ??
    'unknown'
  );
}

function appendApprovalLog(rootDir: string, line: string): string {
  const logPath = path.join(rootDir, 'docs', 'sdlc', 'approvals.log');
  ensureDir(path.dirname(logPath));
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(
      logPath,
      [
        '# Crux approvals log. Append-only. One line per approval event.',
        '# Format:  <ISO-8601-timestamp>  /crux-approve  <artifact-id>  approved-by=<user>  [extras...]',
        '',
      ].join('\n'),
      'utf8',
    );
  }

  fs.appendFileSync(logPath, `${line}\n`, 'utf8');
  return logPath;
}

function resolveArtifact(rootDir: string, input: string): ResolvedArtifact | null {
  if (input === 'PRD' || input === 'PRD.md' || input.startsWith('PRD-')) {
    return {
      kind: 'PRD',
      id: input === 'PRD.md' ? 'PRD' : input.replace(/\.md$/u, ''),
      path: path.join(rootDir, 'docs', 'sdlc', 'prd', 'PRD.md'),
    };
  }
  if (/^REQ-[A-Z0-9-]+$/u.test(input)) {
    return {
      kind: 'REQ',
      id: input,
      path: path.join(rootDir, 'docs', 'sdlc', 'prd', `${input}.yaml`),
    };
  }
  if (/^ADR-[A-Z0-9-]+$/u.test(input)) {
    return {
      kind: 'ADR',
      id: input,
      path: path.join(rootDir, 'docs', 'sdlc', 'adr', `${input}.yaml`),
    };
  }
  if (/^MOD-[A-Z0-9-]+$/u.test(input)) {
    return {
      kind: 'MOD',
      id: input,
      path: path.join(rootDir, 'docs', 'sdlc', 'modules', `${input}.yaml`),
    };
  }

  return null;
}

function prdAlreadyApproved(content: string): { approvedBy: string; approvedAt: string } | null {
  const approvedBy = /- Approved by:\s*(.+)$/mu.exec(content)?.[1]?.trim();
  const approvedAt = /- Approved at:\s*(.+)$/mu.exec(content)?.[1]?.trim();

  if (approvedBy && approvedAt && !approvedAt.startsWith('YYYY-')) {
    return { approvedBy, approvedAt };
  }

  return null;
}

function approvePrd(content: string, approvedBy: string, approvedAt: string): string {
  const statusUpdated = content.replace(/^\*\*Status:\*\*.*$/mu, '**Status:** approved');
  const approvalSectionPattern =
    /## Approval\s*[\r\n]+(?:- Approved by:.*[\r\n]+)?(?:- Approved at:.*[\r\n]+)?(?:- Approval log entry:.*[\r\n]*)?/u;
  const replacement = [
    '## Approval',
    '',
    `- Approved by: ${approvedBy}`,
    `- Approved at: ${approvedAt}`,
    '- Approval log entry: docs/sdlc/approvals.log',
    '',
  ].join('\n');

  if (approvalSectionPattern.test(statusUpdated)) {
    return statusUpdated.replace(approvalSectionPattern, replacement);
  }

  return `${statusUpdated.trimEnd()}\n\n${replacement}`;
}

function approveYamlArtifact(
  artifact: Artifact,
  approvedBy: string,
  approvedAt: string,
): { updated: Artifact; priorStatus: string | null; newStatus: string | null } | CommandResult {
  const alreadyApprovedAt = artifact.raw.approved_at;
  if (
    typeof alreadyApprovedAt === 'string' &&
    alreadyApprovedAt.trim() !== '' &&
    alreadyApprovedAt !== 'null'
  ) {
    return fail(
      `${artifact.id} is already approved by ${String(artifact.raw.approved_by ?? 'unknown')} at ${alreadyApprovedAt}. Open a CHG event if you need re-approval.`,
    );
  }

  const priorStatus = typeof artifact.raw.status === 'string' ? artifact.raw.status : null;
  if (artifact.kind === 'ADR' && priorStatus === 'superseded') {
    return fail('Superseded ADRs cannot be re-approved. Open a CHG event instead.');
  }

  artifact.raw.approved_by = approvedBy;
  artifact.raw.approved_at = approvedAt;
  if (artifact.kind === 'ADR' && priorStatus === 'proposed') {
    artifact.raw.status = 'accepted';
  }

  return {
    updated: artifact,
    priorStatus,
    newStatus: typeof artifact.raw.status === 'string' ? artifact.raw.status : null,
  };
}

export const approveCommand: CommandHandler = async (args, context) => {
  const input = args[0];
  if (!input) {
    return fail('Missing artifact id. Example: `/crux-approve ADR-001`.');
  }

  if (/^(TASK|CHG|INC|AMD)-/u.test(input)) {
    return fail(
      `${input} is not approvable via /crux-approve. Use the owning workflow for that artifact type.`,
    );
  }

  const resolved = resolveArtifact(context.rootDir, input);
  if (!resolved || !fs.existsSync(resolved.path)) {
    return fail(`Could not resolve approvable artifact: ${input}`);
  }

  const now = context.now?.() ?? new Date();
  const approvedAt = now.toISOString();
  const approvedBy = approverName();

  if (resolved.kind === 'PRD') {
    const original = fs.readFileSync(resolved.path, 'utf8');
    const existing = prdAlreadyApproved(original);
    if (existing) {
      return fail(
        `${resolved.id} is already approved by ${existing.approvedBy} at ${existing.approvedAt}. Open a CHG event if you need re-approval.`,
      );
    }

    fs.writeFileSync(resolved.path, approvePrd(original, approvedBy, approvedAt), 'utf8');
    const logPath = appendApprovalLog(
      context.rootDir,
      `${approvedAt}  /crux-approve  ${resolved.id}  approved-by=${approvedBy}`,
    );

    return ok(
      `artifact=${resolved.id}\ttype=PRD\tprior=draft\tnew=approved\tlog=${logPath.replaceAll('\\', '/')}`,
    );
  }

  const artifact = readArtifact(resolved.path);
  const approval = approveYamlArtifact(artifact, approvedBy, approvedAt);
  if ('exitCode' in approval) {
    return approval;
  }

  writeArtifact(resolved.path, approval.updated);
  const logPath = appendApprovalLog(
    context.rootDir,
    `${approvedAt}  /crux-approve  ${resolved.id}  approved-by=${approvedBy}`,
  );

  return ok(
    `artifact=${resolved.id}\ttype=${resolved.kind}\tprior=${approval.priorStatus ?? 'n/a'}\tnew=${approval.newStatus ?? 'approved'}\tlog=${logPath.replaceAll('\\', '/')}`,
  );
};

export const runApproveCommand = approveCommand;
