/**
 * stubs.test.ts
 *
 * Locks the deferred-package stub contract described in TASK-CRUX-019.
 *
 * REQ-CRUX-019 acceptance criteria:
 *   AC#1 — The four v1.0 audit surfaces are the only consumption path.
 *   AC#2 — packages/audit-site/README.md exists and explains the v1.1 deferral.
 *   AC#3 — packages/audit-site contains no Astro/Storybook/Chromatic config or build scripts.
 *   AC#4 — No audit-site-deploy.yml CI workflow exists at v1.0.
 *   (by analogy) packages/extension-vscode/README.md is a stub with deferral language.
 *
 * These tests are intentionally RED until the coder creates:
 *   packages/audit-site/README.md
 *   packages/extension-vscode/README.md
 *
 * The test file lives in packages/core/test/deferred-packages/ because the
 * deferred packages have no test runner of their own at v1.0.
 *
 * Sources:
 *   - TASK-CRUX-019 (touches_files: packages/audit-site/README.md, packages/extension-vscode/README.md)
 *   - REQ-CRUX-019 (audit consumption surfaces; stub-README; no Astro/Storybook/Chromatic)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// packages/core/test/deferred-packages/stubs.test.ts → up 5 levels to repo root
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

const AUDIT_SITE_DIR = path.join(REPO_ROOT, 'packages', 'audit-site');
const AUDIT_SITE_README = path.join(AUDIT_SITE_DIR, 'README.md');

const EXTENSION_VSCODE_DIR = path.join(REPO_ROOT, 'packages', 'extension-vscode');
const EXTENSION_VSCODE_README = path.join(EXTENSION_VSCODE_DIR, 'README.md');

const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');

// ---------------------------------------------------------------------------
// Helper: read file content or return null if missing (used in content tests
// to give a better failure message than ENOENT)
// ---------------------------------------------------------------------------
function readIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

// ===========================================================================
// SECTION 1 — README existence (REQ-019 AC#2)
// ===========================================================================

describe('packages/audit-site/README.md existence', () => {
  it('audit-site README.md exists at v1.0', () => {
    // Arrange — path is derived from repo root
    // Act — check filesystem
    const exists = fs.existsSync(AUDIT_SITE_README);
    // Assert
    expect(exists).toBe(true);
  });
});

describe('packages/extension-vscode/README.md existence', () => {
  it('extension-vscode README.md exists at v1.0', () => {
    const exists = fs.existsSync(EXTENSION_VSCODE_README);
    expect(exists).toBe(true);
  });
});

// ===========================================================================
// SECTION 2 — Deferral language in READMEs (REQ-019 AC#2)
// ===========================================================================

describe('packages/audit-site/README.md deferral language', () => {
  it('contains the word "deferred" or "v1.1" (case-insensitive)', () => {
    // Arrange
    const content = readIfExists(AUDIT_SITE_README);
    // Assert — fail clearly even if file is missing
    expect(content).not.toBeNull();
    const lower = (content ?? '').toLowerCase();
    const hasDeferralKeyword = lower.includes('deferred') || lower.includes('v1.1');
    expect(hasDeferralKeyword).toBe(true);
  });

  it('contains a rationale paragraph of at least 80 characters', () => {
    // Arrange
    const content = readIfExists(AUDIT_SITE_README) ?? '';
    // Act — find any line of prose >= 80 chars (rationale paragraph)
    const lines = content.split('\n');
    const hasLongProse = lines.some((line) => {
      const trimmed = line.trim();
      // Exclude markdown headings (start with #) and empty lines
      return trimmed.length >= 80 && !trimmed.startsWith('#');
    });
    // Assert
    expect(hasLongProse).toBe(true);
  });
});

describe('packages/extension-vscode/README.md deferral language', () => {
  it('contains the word "deferred" or "v1.1" (case-insensitive)', () => {
    const content = readIfExists(EXTENSION_VSCODE_README);
    expect(content).not.toBeNull();
    const lower = (content ?? '').toLowerCase();
    const hasDeferralKeyword = lower.includes('deferred') || lower.includes('v1.1');
    expect(hasDeferralKeyword).toBe(true);
  });

  it('contains a rationale paragraph of at least 80 characters', () => {
    const content = readIfExists(EXTENSION_VSCODE_README) ?? '';
    const lines = content.split('\n');
    const hasLongProse = lines.some((line) => {
      const trimmed = line.trim();
      return trimmed.length >= 80 && !trimmed.startsWith('#');
    });
    expect(hasLongProse).toBe(true);
  });
});

// ===========================================================================
// SECTION 3 — v1.0 audit consumption surfaces referenced in audit-site README
//             (REQ-019 AC#1 — four surfaces named in REQ text)
// ===========================================================================

describe('packages/audit-site/README.md references all four v1.0 audit surfaces', () => {
  it('references the docs/sdlc markdown/YAML surface', () => {
    // Arrange
    const content = readIfExists(AUDIT_SITE_README) ?? '';
    // "docs/sdlc" covers browsable markdown/YAML files under that path
    const mentions = content.toLowerCase().includes('docs/sdlc');
    expect(mentions).toBe(true);
  });

  it('references the /crux-trace surface', () => {
    const content = readIfExists(AUDIT_SITE_README) ?? '';
    const mentions = content.toLowerCase().includes('/crux-trace') || content.toLowerCase().includes('crux-trace');
    expect(mentions).toBe(true);
  });

  it('references the /crux-status surface', () => {
    const content = readIfExists(AUDIT_SITE_README) ?? '';
    const mentions = content.toLowerCase().includes('/crux-status') || content.toLowerCase().includes('crux-status');
    expect(mentions).toBe(true);
  });

  it('references the scripts/render-graph.sh surface', () => {
    const content = readIfExists(AUDIT_SITE_README) ?? '';
    const mentions =
      content.toLowerCase().includes('render-graph.sh') || content.toLowerCase().includes('render-graph');
    expect(mentions).toBe(true);
  });
});

// ===========================================================================
// SECTION 4 — No Astro/Storybook/Chromatic artifacts in audit-site (REQ-019 AC#3)
// ===========================================================================

describe('packages/audit-site contains no Astro/Storybook/Chromatic config files', () => {
  it('does not contain astro.config.ts', () => {
    const forbidden = path.join(AUDIT_SITE_DIR, 'astro.config.ts');
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it('does not contain astro.config.mjs', () => {
    const forbidden = path.join(AUDIT_SITE_DIR, 'astro.config.mjs');
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it('does not contain astro.config.js', () => {
    const forbidden = path.join(AUDIT_SITE_DIR, 'astro.config.js');
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it('does not contain any .astro source files at the top level', () => {
    // Scan direct children of audit-site dir for .astro files
    let astroFiles: string[] = [];
    if (fs.existsSync(AUDIT_SITE_DIR)) {
      astroFiles = fs
        .readdirSync(AUDIT_SITE_DIR)
        .filter((name) => name.endsWith('.astro'));
    }
    expect(astroFiles).toHaveLength(0);
  });

  it('does not contain a .storybook directory', () => {
    const forbidden = path.join(AUDIT_SITE_DIR, '.storybook');
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it('does not contain chromatic.config.ts', () => {
    const forbidden = path.join(AUDIT_SITE_DIR, 'chromatic.config.ts');
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it('does not contain chromatic.config.js', () => {
    const forbidden = path.join(AUDIT_SITE_DIR, 'chromatic.config.js');
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it('does not contain a package.json (no installable build scripts at v1.0)', () => {
    const forbidden = path.join(AUDIT_SITE_DIR, 'package.json');
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it('does not contain a tsconfig.json', () => {
    const forbidden = path.join(AUDIT_SITE_DIR, 'tsconfig.json');
    expect(fs.existsSync(forbidden)).toBe(false);
  });
});

// ===========================================================================
// SECTION 5 — No package.json in extension-vscode at v1.0
// ===========================================================================

describe('packages/extension-vscode contains no package.json at v1.0', () => {
  it('does not contain a package.json', () => {
    const forbidden = path.join(EXTENSION_VSCODE_DIR, 'package.json');
    expect(fs.existsSync(forbidden)).toBe(false);
  });
});

// ===========================================================================
// SECTION 6 — No audit-site-deploy.yml CI workflow (REQ-019 AC#4)
// ===========================================================================

describe('.github/workflows does not contain audit-site-deploy.yml', () => {
  it('audit-site-deploy.yml does not exist at v1.0', () => {
    // Arrange
    const forbidden = path.join(WORKFLOWS_DIR, 'audit-site-deploy.yml');
    // Act + Assert
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it('audit-site-deploy.yaml does not exist at v1.0 (alternate extension)', () => {
    const forbidden = path.join(WORKFLOWS_DIR, 'audit-site-deploy.yaml');
    expect(fs.existsSync(forbidden)).toBe(false);
  });
});
