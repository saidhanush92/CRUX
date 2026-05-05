/**
 * crux-mode.ts
 *
 * Reads and validates the crux_mode field from a stack.yaml file.
 * No third-party YAML parser is used — a regex extractor is sufficient
 * for the single scalar field we need (ADR-CRUX-006 requirement).
 *
 * Sources:
 *   - TASK-CRUX-001
 *   - REQ-CRUX-008 (crux_mode is read by every command; invalid value halts)
 *   - ADR-CRUX-006 (greenfield=compressed, brownfield=standard)
 */

import { readFileSync, existsSync } from 'node:fs';

export type CruxMode = 'compressed' | 'standard' | 'strict' | 'solo' | 'observation';

export type ProjectKind = 'greenfield' | 'brownfield';

const VALID_MODES: readonly CruxMode[] = [
  'compressed',
  'standard',
  'strict',
  'solo',
  'observation',
] as const;

const VALID_MODES_LIST = VALID_MODES.join(', ');

/**
 * Matches a top-level `crux_mode: <value>` line, ignoring inline comments.
 *
 * Capture group intentionally includes uppercase letters ([a-zA-Z_]+) so that
 * a value like `crux_mode: COMPRESSED` is captured and then routed to
 * CruxModeInvalidValueError (with the valid-options list) rather than falling
 * through to CruxModeMissingError.  We do NOT auto-lowercase the captured
 * value: silent normalization would mask config typos (e.g. `STANDARD` vs
 * `standard`) and obscure operator errors.
 */
const CRUX_MODE_PATTERN = /^crux_mode:\s*([a-zA-Z_]+)\s*(?:#.*)?$/m;

/** Thrown when the file at the given path does not exist. */
export class CruxModeFileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`crux_mode: file not found at path: ${filePath}`);
    this.name = 'CruxModeFileNotFoundError';
  }
}

/** Thrown when the file exists but contains no crux_mode field. */
export class CruxModeMissingError extends Error {
  constructor(filePath: string) {
    super(
      `crux_mode: field 'crux_mode' not found in ${filePath}. ` +
        `Add 'crux_mode: <mode>' where <mode> is one of: ${VALID_MODES_LIST}.`,
    );
    this.name = 'CruxModeMissingError';
  }
}

/** Thrown when crux_mode is present but its value is not a recognised mode. */
export class CruxModeInvalidValueError extends Error {
  constructor(value: string) {
    super(`crux_mode: invalid value '${value}'. ` + `Valid modes are: ${VALID_MODES_LIST}.`);
    this.name = 'CruxModeInvalidValueError';
  }
}

/**
 * Reads the crux_mode field from a stack.yaml file synchronously.
 * Throws a distinct, descriptive error for each failure mode:
 *   - file not found   → CruxModeFileNotFoundError
 *   - no crux_mode key → CruxModeMissingError
 *   - invalid value    → CruxModeInvalidValueError
 */
export function readCruxMode(filePath: string): CruxMode {
  if (!existsSync(filePath)) {
    throw new CruxModeFileNotFoundError(filePath);
  }

  const content = readFileSync(filePath, 'utf-8');

  const match = CRUX_MODE_PATTERN.exec(content);
  if (match === null) {
    throw new CruxModeMissingError(filePath);
  }

  const rawValue = match[1];
  if (rawValue === undefined) {
    throw new CruxModeMissingError(filePath);
  }

  assertValidCruxMode(rawValue);
  return rawValue;
}

/**
 * Asserts that an unknown value is a valid CruxMode.
 * Acts as a type guard: after a successful call the caller can treat
 * the value as CruxMode without a cast in application code.
 * Throws CruxModeInvalidValueError for any non-matching input.
 */
export function assertValidCruxMode(value: unknown): asserts value is CruxMode {
  if (typeof value !== 'string') {
    throw new CruxModeInvalidValueError(String(value));
  }
  if (!(VALID_MODES as readonly string[]).includes(value)) {
    throw new CruxModeInvalidValueError(value);
  }
}

/**
 * Returns the default CruxMode for a given project kind.
 * ADR-CRUX-006: greenfield → compressed, brownfield → standard.
 */
export function defaultModeFor(kind: ProjectKind): CruxMode {
  if (kind === 'greenfield') return 'compressed';
  return 'standard';
}

/**
 * Returns true only for 'compressed', the sole auto-approve mode.
 * ADR-CRUX-006: auto-approvals in compressed mode are recorded in
 * approvals.log with source: mode-compressed — never silently.
 */
export function isAutoApproveMode(mode: CruxMode): boolean {
  return mode === 'compressed';
}
