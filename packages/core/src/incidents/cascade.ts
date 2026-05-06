/**
 * cascade.ts
 *
 * INC / CHG / AMD cascade plumbing for CRUX.
 * Emits incident, change, and amendment YAML artifacts under docs/sdlc/.
 *
 * Critical constraint (ADR-CRUX-005): emitAmendment MUST NOT touch any
 * SKILL.md bytes under .claude/skills/. Amendments live only in docs/sdlc/amendments/.
 *
 * REQ-CRUX-010 / ADR-CRUX-005
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

export interface EmitIncidentInput {
  title: string;
  violated: string[];
  root_cause: string;
}

export interface EmitChangeInput {
  trigger_event: string;
  classification: string;
  affected_artifacts: string[];
  triggered_by_incident?: string;
}

export interface EmitAmendmentInput {
  triggered_by: string;
  target_skill: string;
  rule: string;
  applies_when: string;
  severity: string;
  triggered_by_incident?: string;
}

export interface CascadeInput {
  title: string;
  violated: string[];
  root_cause: string;
  description: string;
  target_skills: string[];
}

export interface EmitResult {
  id: string;
  path: string;
}

export interface CascadeResult {
  incidentId: string;
  changeIds: string[];
  amendmentIds: string[];
}

// ---------------------------------------------------------------------------
// Internal: sequence allocation
// ---------------------------------------------------------------------------

/**
 * Scan an existing artifacts directory for files matching `<PREFIX>-NNN.yaml`
 * and return the next zero-padded sequence number.
 * Concurrency: v1.0 is single-caller only (no locking). Documented below.
 */
function nextSequence(dir: string, prefix: string): string {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    entries = [];
  }

  const pattern = new RegExp(`^${prefix}-(\\d+)\\.yaml$`);
  let maxSeq = 0;

  for (const entry of entries) {
    const match = pattern.exec(entry);
    if (match) {
      const num = parseInt(match[1]!, 10);
      if (num > maxSeq) maxSeq = num;
    }
  }

  const next = maxSeq + 1;
  // Zero-pad to 3 digits
  return String(next).padStart(3, '0');
}

// ---------------------------------------------------------------------------
// Internal: atomic YAML write
// ---------------------------------------------------------------------------

function writeYamlAtomic(filePath: string, content: string): void {
  const rand = crypto.randomBytes(6).toString('hex');
  const tmpPath = `${filePath}.tmp.${rand}`;

  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, content, 0, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  try {
    fs.renameSync(tmpPath, filePath);
  } catch (renameErr: unknown) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore secondary failure
    }
    throw renameErr;
  }
}

// ---------------------------------------------------------------------------
// Internal: YAML serialisation helpers
// ---------------------------------------------------------------------------

function yamlScalar(value: string): string {
  if (
    value.includes('\n') ||
    value.includes(': ') ||
    value.startsWith('"') ||
    value.startsWith("'") ||
    value.startsWith('{') ||
    value.startsWith('[') ||
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    /^[0-9]/.test(value)
  ) {
    // Use block scalar for multi-line or problematic values
    if (value.includes('\n')) {
      const trimmed = value.trimEnd();
      const lines = trimmed.split('\n');
      return '|\n' + lines.map((l) => `  ${l}`).join('\n') + '\n';
    }
    return `'${value.replace(/'/g, "''")}'`;
  }
  return value;
}

function yamlList(items: string[]): string {
  if (items.length === 0) return '[]\n';
  return '\n' + items.map((i) => `  - ${yamlScalar(i)}`).join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// emitIncident
// ---------------------------------------------------------------------------

export function emitIncident(rootDir: string, input: EmitIncidentInput): EmitResult {
  const incDir = path.join(rootDir, 'docs', 'sdlc', 'incidents');
  fs.mkdirSync(incDir, { recursive: true });

  const seq = nextSequence(incDir, 'INC');
  const id = `INC-${seq}`;
  const filePath = path.join(incDir, `${id}.yaml`);

  const violatedStr =
    input.violated.length > 0
      ? '\n' + input.violated.map((v) => `  - ${v}`).join('\n') + '\n'
      : '[]\n';

  const lines: string[] = [
    `id: ${id}`,
    `title: ${yamlScalar(input.title)}`,
    `violated:${violatedStr}root_cause: ${yamlScalar(input.root_cause)}`,
  ];

  writeYamlAtomic(filePath, lines.join('\n') + '\n');
  return { id, path: filePath };
}

// ---------------------------------------------------------------------------
// emitChange
// ---------------------------------------------------------------------------

export function emitChange(rootDir: string, input: EmitChangeInput): EmitResult {
  const chgDir = path.join(rootDir, 'docs', 'sdlc', 'chg');
  fs.mkdirSync(chgDir, { recursive: true });

  const seq = nextSequence(chgDir, 'CHG');
  const id = `CHG-${seq}`;
  const filePath = path.join(chgDir, `${id}.yaml`);

  const affectedStr = yamlList(input.affected_artifacts);

  const parts: string[] = [
    `id: ${id}`,
    `trigger_event: ${yamlScalar(input.trigger_event)}`,
    `classification: ${yamlScalar(input.classification)}`,
    `affected_artifacts:${affectedStr}`,
  ];

  if (input.triggered_by_incident) {
    parts.push(`triggered_by_incident: ${yamlScalar(input.triggered_by_incident)}`);
  }

  writeYamlAtomic(filePath, parts.join('\n') + '\n');
  return { id, path: filePath };
}

// ---------------------------------------------------------------------------
// emitAmendment
// CRITICAL: this function MUST NOT touch any .claude/skills/*/SKILL.md byte.
// ---------------------------------------------------------------------------

export function emitAmendment(rootDir: string, input: EmitAmendmentInput): EmitResult {
  const amdDir = path.join(rootDir, 'docs', 'sdlc', 'amendments');
  fs.mkdirSync(amdDir, { recursive: true });

  const seq = nextSequence(amdDir, 'AMD');
  const id = `AMD-${seq}`;
  const filePath = path.join(amdDir, `${id}.yaml`);

  const parts: string[] = [
    `id: ${id}`,
    `triggered_by: ${yamlScalar(input.triggered_by)}`,
    `target_skill: ${yamlScalar(input.target_skill)}`,
    `rule: ${yamlScalar(input.rule)}`,
    `applies_when: ${yamlScalar(input.applies_when)}`,
    `severity: ${yamlScalar(input.severity)}`,
  ];

  if (input.triggered_by_incident) {
    parts.push(`triggered_by_incident: ${yamlScalar(input.triggered_by_incident)}`);
  }

  writeYamlAtomic(filePath, parts.join('\n') + '\n');
  return { id, path: filePath };
}

// ---------------------------------------------------------------------------
// runCascade
// ---------------------------------------------------------------------------

/**
 * Orchestrates the INC -> CHG -> AMD cascade synchronously.
 * - Emits one INC.
 * - Emits one CHG per violated artifact (violated_req entries).
 * - Emits one AMD per target_skill.
 * Returns all allocated ids.
 *
 * Concurrency note (v1.0): sequence allocation is performed by scanning the
 * directory at call time and incrementing. This is safe for single-caller
 * usage. Concurrent callers could collide on the same sequence number. A
 * file-lock or atomic counter would be needed for concurrent emitters, but
 * that is explicitly out of scope for v1.0.
 */
export function runCascade(rootDir: string, input: CascadeInput): CascadeResult {
  // 1. Emit the incident
  const incident = emitIncident(rootDir, {
    title: input.title,
    violated: input.violated,
    root_cause: input.root_cause,
  });

  // 2. Emit one CHG per violated artifact
  const changeIds: string[] = [];
  for (const violated of input.violated) {
    const chg = emitChange(rootDir, {
      trigger_event: `${incident.id}: ${input.description}`,
      classification: 'reqs_misaligned',
      affected_artifacts: [violated],
      triggered_by_incident: incident.id,
    });
    changeIds.push(chg.id);
  }

  // 3. Emit one AMD per target_skill
  const amendmentIds: string[] = [];
  for (const skillName of input.target_skills) {
    const amd = emitAmendment(rootDir, {
      triggered_by: 'incident',
      target_skill: skillName,
      rule: `Incident ${incident.id} triggered this amendment. Review and tighten the skill rules for: ${input.description}`,
      applies_when: `When conditions matching "${input.title}" arise.`,
      severity: 'high',
      triggered_by_incident: incident.id,
    });
    amendmentIds.push(amd.id);
  }

  return { incidentId: incident.id, changeIds, amendmentIds };
}
