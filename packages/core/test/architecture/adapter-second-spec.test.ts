/**
 * adapter-second-spec.test.ts
 *
 * Validates the structural correctness of the paper-only second-adapter spec
 * required by ADR-CRUX-003 (validated_by clause) and TASK-CRUX-010.
 *
 * The spec lives at:
 *   docs/sdlc/architecture/adapter-second-spec.md
 *
 * This file tests the DOCUMENT, not production code. The 17 function names
 * are read at test-time from ADAPTER_INTERFACE_MANIFEST — the single source
 * of truth per ADR-CRUX-003 — so any future manifest drift is caught here
 * automatically.
 *
 * Tests are intentionally RED until the coder writes adapter-second-spec.md.
 *
 * Sources:
 *   - TASK-CRUX-010 (touches_files: docs/sdlc/architecture/adapter-second-spec.md)
 *   - ADR-CRUX-003  (validated_by clause: feasibility matrix, needs-redesign gate)
 *   - REQ-CRUX-007  (provisional runtime-neutrality; revisit_when clause)
 *   - packages/core/src/adapter/interface.ts (ADAPTER_INTERFACE_MANIFEST)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADAPTER_INTERFACE_MANIFEST } from '../../src/adapter/interface.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Allowed paper-target names — exactly as they may appear in the heading. */
const ALLOWED_PAPER_TARGETS = ['Cursor', 'Aider', 'raw Anthropic SDK'] as const;

/** Allowed verdict tokens per ADR-CRUX-003. */
const ALLOWED_VERDICTS = ['feasible', 'needs-redesign', 'unknown'] as const;
type Verdict = (typeof ALLOWED_VERDICTS)[number];

/**
 * Repo root is four directories up from this test file:
 *   packages/core/test/architecture/adapter-second-spec.test.ts
 *   ^         ^    ^    ^
 *   packages  core test architecture  — 4 levels up to repo root
 */
const REPO_ROOT = resolve(import.meta.dirname ?? __dirname, '../../../../');
const SPEC_PATH = resolve(REPO_ROOT, 'docs/sdlc/architecture/adapter-second-spec.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all 17 function names from the manifest in a stable order. */
function allManifestFunctions(): string[] {
  return Object.values(ADAPTER_INTERFACE_MANIFEST).flatMap((arr) => [...arr]);
}

/**
 * Find the verdict token for a given function name within the document text.
 *
 * Strategy: locate the function name in the doc, then scan the next 200
 * characters for a verdict token. This is tolerant of various table styles
 * while being tight enough to reject verdicts that are far from the fn name.
 */
function findVerdictForFunction(docContent: string, fnName: string): Verdict | null {
  const fnIndex = docContent.indexOf(fnName);
  if (fnIndex === -1) return null;

  const window = docContent.slice(fnIndex, fnIndex + 200);

  // Check in priority order so we match the most specific token first.
  // 'needs-redesign' must be checked before 'unknown' and 'feasible' to avoid
  // a substring of it matching the shorter tokens.
  for (const verdict of ['needs-redesign', 'feasible', 'unknown'] as const) {
    if (window.includes(verdict)) return verdict;
  }

  return null;
}

/**
 * Check whether a section heading (## or ###) matching the given pattern
 * exists AND is followed by non-whitespace content before the next heading.
 */
function sectionExistsAndNonEmpty(docContent: string, headingPattern: RegExp): boolean {
  const headingMatch = headingPattern.exec(docContent);
  if (!headingMatch) return false;

  // Find where the next heading starts (## or #)
  const afterHeading = docContent.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingIdx = afterHeading.search(/^#{1,6}\s/m);
  const sectionBody = nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  return sectionBody.trim().length > 0;
}

// ---------------------------------------------------------------------------
// 1. File existence
// ---------------------------------------------------------------------------

describe('adapter-second-spec.md — file existence', () => {
  it('exists at docs/sdlc/architecture/adapter-second-spec.md', () => {
    // Arrange / Act
    const exists = existsSync(SPEC_PATH);

    // Assert
    expect(
      exists,
      `Expected the paper-only second-adapter spec to exist at:\n  ${SPEC_PATH}\nThe coder must create this file.`,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shared fixture — load the doc once; tests below depend on it existing.
// ---------------------------------------------------------------------------

function loadDoc(): string {
  if (!existsSync(SPEC_PATH)) {
    throw new Error(
      `adapter-second-spec.md not found at ${SPEC_PATH}. ` +
        `All tests in this suite expect the file to exist.`,
    );
  }
  return readFileSync(SPEC_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// 2. Top-level heading names an allowed paper target
// ---------------------------------------------------------------------------

describe('adapter-second-spec.md — top-level heading', () => {
  it('has a # heading that names one of the three allowed paper targets (Cursor, Aider, raw Anthropic SDK)', () => {
    // Arrange
    const doc = loadDoc();

    // Act — find the first top-level heading
    const h1Match = /^#\s+(.+)$/m.exec(doc);

    // Assert
    expect(h1Match, 'No top-level "# " heading found in the document').not.toBeNull();

    const headingText = h1Match![1];
    const mentionsATarget = ALLOWED_PAPER_TARGETS.some((target) => headingText.includes(target));

    expect(
      mentionsATarget,
      `Top-level heading "${headingText}" must name one of: ${ALLOWED_PAPER_TARGETS.join(', ')}`,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Feasibility matrix section — all 17 function names present
// ---------------------------------------------------------------------------

describe('adapter-second-spec.md — feasibility matrix section', () => {
  it('contains a "## Function feasibility matrix" section (or heading containing "feasibility")', () => {
    // Arrange
    const doc = loadDoc();

    // Act
    const hasFeasibilitySection = /^#{2,3}\s+.*feasib/im.test(doc);

    // Assert
    expect(
      hasFeasibilitySection,
      'Document must contain a "## Function feasibility matrix" (or equivalent) section heading containing the word "feasibility".',
    ).toBe(true);
  });

  it('feasibility matrix contains every function name from ADAPTER_INTERFACE_MANIFEST', () => {
    // Arrange
    const doc = loadDoc();
    const allFns = allManifestFunctions();

    // Act
    const missing = allFns.filter((fn) => !doc.includes(fn));

    // Assert
    expect(
      missing,
      `The following function names from ADAPTER_INTERFACE_MANIFEST are missing from the document:\n  ${missing.join('\n  ')}\n\nAll 17 functions must appear in the feasibility matrix.`,
    ).toHaveLength(0);
  });

  it('has exactly 17 function names from ADAPTER_INTERFACE_MANIFEST covered', () => {
    // Arrange
    const doc = loadDoc();
    const allFns = allManifestFunctions();

    // Act
    const present = allFns.filter((fn) => doc.includes(fn));

    // Assert
    expect(
      present,
      `Expected 17 function names in the document, found ${present.length}: ${present.join(', ')}`,
    ).toHaveLength(17);
  });
});

// ---------------------------------------------------------------------------
// 4. Each function has exactly one verdict token within 200 chars of its name
// ---------------------------------------------------------------------------

describe('adapter-second-spec.md — per-function verdict tokens', () => {
  it('every function name is followed by exactly one verdict token (feasible | needs-redesign | unknown) within 200 characters', () => {
    // Arrange
    const doc = loadDoc();
    const allFns = allManifestFunctions();

    // Act
    const missing: string[] = [];

    for (const fn of allFns) {
      const verdict = findVerdictForFunction(doc, fn);
      if (verdict === null) {
        missing.push(fn);
      }
    }

    // Assert
    expect(
      missing,
      `The following functions have no verdict token (feasible | needs-redesign | unknown) within 200 characters of their name:\n  ${missing.join('\n  ')}\n\nEach function row must carry exactly one of the three verdict tokens.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. References section — non-empty
// ---------------------------------------------------------------------------

describe('adapter-second-spec.md — References section', () => {
  it('contains a "## References" section (or heading containing "Reference") that is non-empty', () => {
    // Arrange
    const doc = loadDoc();

    // Act
    const hasNonEmptyReferences = sectionExistsAndNonEmpty(doc, /^#{2,3}\s+.*[Rr]eference/m);

    // Assert
    expect(
      hasNonEmptyReferences,
      'Document must contain a non-empty "## References" (or equivalent) section listing the paper target\'s SDK documentation, known limitations, or relevant sources.',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Conclusion section — counts and ADR reopen statement
// ---------------------------------------------------------------------------

describe('adapter-second-spec.md — Conclusion section', () => {
  it('contains a "## Conclusion" section (or heading containing "Conclusion") that is non-empty', () => {
    // Arrange
    const doc = loadDoc();

    // Act
    const hasConclusion = sectionExistsAndNonEmpty(doc, /^#{2,3}\s+.*[Cc]onclusion/m);

    // Assert
    expect(
      hasConclusion,
      'Document must contain a non-empty "## Conclusion" (or equivalent) section.',
    ).toBe(true);
  });

  it('Conclusion section explicitly mentions "feasible" count', () => {
    // Arrange
    const doc = loadDoc();
    const conclusionMatch = /^#{2,3}\s+.*[Cc]onclusion/m.exec(doc);
    expect(conclusionMatch, 'Conclusion section not found').not.toBeNull();

    const afterConclusion = doc.slice(conclusionMatch!.index + conclusionMatch![0].length);
    const nextHeadingIdx = afterConclusion.search(/^#{1,6}\s/m);
    const conclusionBody =
      nextHeadingIdx === -1 ? afterConclusion : afterConclusion.slice(0, nextHeadingIdx);

    // Act / Assert
    expect(
      conclusionBody.includes('feasible'),
      'Conclusion section must include the word "feasible" (as part of the verdict count summary).',
    ).toBe(true);
  });

  it('Conclusion section explicitly mentions "unknown" count', () => {
    // Arrange
    const doc = loadDoc();
    const conclusionMatch = /^#{2,3}\s+.*[Cc]onclusion/m.exec(doc);
    expect(conclusionMatch, 'Conclusion section not found').not.toBeNull();

    const afterConclusion = doc.slice(conclusionMatch!.index + conclusionMatch![0].length);
    const nextHeadingIdx = afterConclusion.search(/^#{1,6}\s/m);
    const conclusionBody =
      nextHeadingIdx === -1 ? afterConclusion : afterConclusion.slice(0, nextHeadingIdx);

    // Act / Assert
    expect(
      conclusionBody.includes('unknown'),
      'Conclusion section must include the word "unknown" (as part of the verdict count summary).',
    ).toBe(true);
  });

  it('Conclusion section explicitly states whether ADR-CRUX-003 must be reopened', () => {
    // Arrange
    const doc = loadDoc();
    const conclusionMatch = /^#{2,3}\s+.*[Cc]onclusion/m.exec(doc);
    expect(conclusionMatch, 'Conclusion section not found').not.toBeNull();

    const afterConclusion = doc.slice(conclusionMatch!.index + conclusionMatch![0].length);
    const nextHeadingIdx = afterConclusion.search(/^#{1,6}\s/m);
    const conclusionBody =
      nextHeadingIdx === -1 ? afterConclusion : afterConclusion.slice(0, nextHeadingIdx);

    // Act — check that the conclusion mentions the ADR reopen decision
    const mentionsAdr = conclusionBody.includes('ADR-CRUX-003');
    const mentionsReopen = /reopen|re-open|does not need to be reopened|no reopen/i.test(
      conclusionBody,
    );

    // Assert
    expect(
      mentionsAdr,
      'Conclusion section must reference "ADR-CRUX-003" to make the reopen decision traceable.',
    ).toBe(true);

    expect(
      mentionsReopen,
      'Conclusion section must explicitly state whether ADR-CRUX-003 must be reopened ' +
        '(use "reopen", "re-open", or "does not need to be reopened").',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Health invariant — needs-redesign causes loud failure
//
// Per ADR-CRUX-003 validated_by: any needs-redesign function reopens the ADR
// pre-v1.0 release. Since ADR reopening is out of v1.0 scope, this test acts
// as a gate: if the chosen paper target requires any function redesign, the
// pipeline must halt for human review rather than silently shipping the spec.
// ---------------------------------------------------------------------------

describe('adapter-second-spec.md — health invariant (needs-redesign gate)', () => {
  it('no function row carries the verdict "needs-redesign" — if any does, ADR-CRUX-003 must be reopened and this task cannot complete at v1.0', () => {
    // Arrange
    const doc = loadDoc();
    const allFns = allManifestFunctions();

    // Act
    const needsRedesignFns = allFns.filter((fn) => {
      const verdict = findVerdictForFunction(doc, fn);
      return verdict === 'needs-redesign';
    });

    // Assert — fail loudly, naming every offending function
    expect(
      needsRedesignFns,
      [
        'HEALTH INVARIANT VIOLATED: the following functions are marked "needs-redesign":',
        ...needsRedesignFns.map((fn) => `  - ${fn}`),
        '',
        'Per ADR-CRUX-003 validated_by: any needs-redesign function reopens ADR-CRUX-003',
        'before the v1.0 release. Reopening ADR-CRUX-003 is out of v1.0 scope.',
        '',
        'Action required:',
        '  1. Choose a paper target where all 17 functions are feasible or unknown, OR',
        '  2. Halt the pipeline and surface this finding for human review before proceeding.',
      ].join('\n'),
    ).toHaveLength(0);
  });
});
