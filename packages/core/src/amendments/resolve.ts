/**
 * resolve.ts
 *
 * Resolves the effective skill content by merging active AMD YAML amendments
 * into the SKILL.md body.  Never writes to SKILL.md.
 *
 * REQ-CRUX-018 / ADR-CRUX-005
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SkillNotFoundError extends Error {
  constructor(skillName: string) {
    super(`SkillNotFoundError: skill "${skillName}" not found`);
    this.name = 'SkillNotFoundError';
    // Ensure proper prototype chain for instanceof checks in ES5 targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Internal: minimal flat-key YAML parser for AMD files
// ---------------------------------------------------------------------------
// AMD files are flat documents with optional block scalars (| syntax).
// Keys we care about: target_skill, rule, severity, applies_when, id.

function parseFlatYaml(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Skip blank lines and comments
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }

    // Only process top-level keys (indent 0)
    if (line[0] === ' ' || line[0] === '\t') {
      i++;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trimStart();

    if (rest === '|') {
      // Block scalar — collect indented continuation lines
      i++;
      const blockLines: string[] = [];
      while (i < lines.length) {
        const bline = lines[i] ?? '';
        if (bline.trim() === '' || bline[0] === ' ' || bline[0] === '\t') {
          blockLines.push(bline.trimStart());
          i++;
        } else {
          break;
        }
      }
      result[key] = blockLines.join('\n').trimEnd();
    } else {
      result[key] = rest.trim();
      i++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// resolveAmendmentsForSkill
// ---------------------------------------------------------------------------

interface ParsedAmendment {
  id: string;
  rule: string;
  severity: string;
  applies_when: string;
}

/**
 * Read SKILL.md for the given skill, scan AMD YAML files, and return the
 * combined text.  Never writes to SKILL.md.
 *
 * @throws {SkillNotFoundError} when the SKILL.md file does not exist.
 */
export function resolveAmendmentsForSkill(skillName: string, rootDir: string): string {
  // 1. Read SKILL.md (throws SkillNotFoundError if absent)
  const skillPath = path.join(rootDir, '.claude', 'skills', skillName, 'SKILL.md');
  let skillBody: string;
  try {
    skillBody = fs.readFileSync(skillPath, 'utf8');
  } catch {
    throw new SkillNotFoundError(skillName);
  }

  // 2. Locate amendments directory — return body unchanged if missing
  const amdDir = path.join(rootDir, 'docs', 'sdlc', 'amendments');
  if (!fs.existsSync(amdDir)) {
    return skillBody;
  }

  // 3. Scan AMD-*.yaml files
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(amdDir, { withFileTypes: true });
  } catch {
    return skillBody;
  }

  const amdFiles = entries
    .filter((e) => e.isFile() && e.name.startsWith('AMD-') && e.name.endsWith('.yaml'))
    .map((e) => e.name)
    .sort(); // lexicographic order by filename → same as id order

  const matched: ParsedAmendment[] = [];

  for (const filename of amdFiles) {
    const filePath = path.join(amdDir, filename);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      console.error(`skipping malformed amendment ${filename}: cannot read file`);
      continue;
    }

    const parsed = parseFlatYaml(content);

    // Validate required fields: target_skill, rule, severity
    if (!parsed['target_skill'] || !parsed['rule'] || !parsed['severity']) {
      console.error(`skipping malformed amendment ${filename}: missing required fields`);
      continue;
    }

    // Filter by target_skill
    if (parsed['target_skill'] !== skillName) {
      continue;
    }

    const stem = filename.endsWith('.yaml') ? filename.slice(0, -5) : filename;
    matched.push({
      id: stem,
      rule: parsed['rule'],
      severity: parsed['severity'],
      applies_when: parsed['applies_when'] ?? '',
    });
  }

  // 4. No matching amendments — return body unchanged
  if (matched.length === 0) {
    return skillBody;
  }

  // 5. Build amendment section (entries already sorted by filename/id)
  const lines = matched.map((amd) => {
    const appliesWhen = amd.applies_when.replace(/\n/g, ' ').trim();
    const rule = amd.rule.replace(/\n/g, ' ').trim();
    const line = `- **${amd.id}** [severity: ${amd.severity}] applies_when=${appliesWhen}: ${rule}`;
    return amd.severity === 'high' ? `**BLOCKING:** ${line}` : line;
  });

  return `${skillBody}\n\n## Active amendments\n\n${lines.join('\n')}`;
}
