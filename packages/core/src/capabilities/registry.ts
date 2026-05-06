/**
 * registry.ts
 *
 * Capability registry consumer for CRUX.
 * Reads capabilities/registry.v1.yaml (required) and capabilities/local.yaml (optional).
 *
 * REQ-CRUX-010 / ADR-CRUX-005
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseYaml } from '../trace/markdown.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CapabilityEntry {
  description: string;
  governs_gate?: number;
}

export interface Registry {
  version: string;
  namespaces: Record<string, Record<string, CapabilityEntry>>;
}

export interface ValidationResult {
  valid: boolean;
  missing: string[];
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class RegistryNotFoundError extends Error {
  constructor(filePath: string) {
    super(`Registry file not found: ${filePath}`);
    this.name = 'RegistryNotFoundError';
  }
}

export class MalformedRegistryError extends Error {
  constructor(filePath: string, detail: string) {
    super(`Malformed registry at ${filePath}: ${detail}`);
    this.name = 'MalformedRegistryError';
  }
}

export class DuplicateCapabilityError extends Error {
  constructor(id: string, filePath: string) {
    super(`Duplicate capability id "${id}" in ${filePath}`);
    this.name = 'DuplicateCapabilityError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawCapabilityItem {
  id: string;
  description: string;
  governs_gate?: number;
}

function parseCapabilityItems(raw: Record<string, unknown>, filePath: string): RawCapabilityItem[] {
  const capabilitiesRaw = raw['capabilities'];
  if (!Array.isArray(capabilitiesRaw)) {
    throw new MalformedRegistryError(filePath, 'missing or invalid "capabilities" list');
  }

  return capabilitiesRaw.map((item: unknown, idx: number) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new MalformedRegistryError(filePath, `capabilities[${idx}] is not a mapping`);
    }
    const entry = item as Record<string, unknown>;
    const id = entry['id'];
    const description = entry['description'];
    if (typeof id !== 'string' || id.trim() === '') {
      throw new MalformedRegistryError(filePath, `capabilities[${idx}] missing "id" field`);
    }
    if (typeof description !== 'string') {
      throw new MalformedRegistryError(filePath, `capability "${id}" missing "description" field`);
    }
    const result: RawCapabilityItem = { id: id.trim(), description };
    if (entry['governs_gate'] !== undefined) {
      const gate = entry['governs_gate'];
      if (typeof gate !== 'number') {
        throw new MalformedRegistryError(
          filePath,
          `capability "${id}" has non-numeric governs_gate`,
        );
      }
      result.governs_gate = gate;
    }
    return result;
  });
}

function buildNamespacesFromItems(
  items: RawCapabilityItem[],
  filePath: string,
  forceNamespace?: string,
): Record<string, Record<string, CapabilityEntry>> {
  const namespaces: Record<string, Record<string, CapabilityEntry>> = {};
  const seenIds = new Set<string>();

  for (const item of items) {
    const dotIdx = item.id.indexOf('.');
    if (dotIdx <= 0) {
      throw new MalformedRegistryError(
        filePath,
        `capability id "${item.id}" must be in "namespace.name" format`,
      );
    }

    const ns = forceNamespace ?? item.id.slice(0, dotIdx);
    const capName = item.id.slice(dotIdx + 1);
    const fullId = `${ns}.${capName}`;

    if (seenIds.has(fullId)) {
      throw new DuplicateCapabilityError(fullId, filePath);
    }
    seenIds.add(fullId);

    if (!namespaces[ns]) {
      namespaces[ns] = {};
    }

    const entry: CapabilityEntry = { description: item.description };
    if (item.governs_gate !== undefined) {
      entry.governs_gate = item.governs_gate;
    }
    namespaces[ns][capName] = entry;
  }

  return namespaces;
}

// ---------------------------------------------------------------------------
// loadRegistry
// ---------------------------------------------------------------------------

/**
 * Load the capability registry from disk.
 * - `<rootDir>/capabilities/registry.v1.yaml` is required.
 * - `<rootDir>/capabilities/local.yaml` is optional; capabilities there live
 *   under the `local` namespace.
 */
export function loadRegistry(rootDir: string): Registry {
  const registryPath = path.join(rootDir, 'capabilities', 'registry.v1.yaml');

  if (!fs.existsSync(registryPath)) {
    throw new RegistryNotFoundError(registryPath);
  }

  let raw: Record<string, unknown>;
  try {
    const content = fs.readFileSync(registryPath, 'utf8');
    raw = parseYaml(content);
  } catch (err: unknown) {
    if (err instanceof RegistryNotFoundError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new MalformedRegistryError(registryPath, msg);
  }

  const version = raw['version'];
  if (typeof version !== 'string' && typeof version !== 'number') {
    throw new MalformedRegistryError(registryPath, 'missing or invalid "version" field');
  }
  const versionStr = String(version);

  const items = parseCapabilityItems(raw, registryPath);
  const namespaces = buildNamespacesFromItems(items, registryPath);

  // Load optional local.yaml
  const localPath = path.join(rootDir, 'capabilities', 'local.yaml');
  if (fs.existsSync(localPath)) {
    let localRaw: Record<string, unknown>;
    try {
      const localContent = fs.readFileSync(localPath, 'utf8');
      localRaw = parseYaml(localContent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MalformedRegistryError(localPath, msg);
    }

    const localCapabilities = localRaw['capabilities'];
    if (Array.isArray(localCapabilities) && localCapabilities.length > 0) {
      const localItems = parseCapabilityItems(localRaw, localPath);
      const localNamespaces = buildNamespacesFromItems(localItems, localPath, 'local');
      // Merge local namespace entries
      for (const [ns, caps] of Object.entries(localNamespaces)) {
        if (!namespaces[ns]) {
          namespaces[ns] = {};
        }
        for (const [capName, entry] of Object.entries(caps)) {
          namespaces[ns][capName] = entry;
        }
      }
    }
  }

  return { version: versionStr, namespaces };
}

// ---------------------------------------------------------------------------
// hasCapability
// ---------------------------------------------------------------------------

/**
 * Returns true if the registry contains the given capability id.
 * Id format: `<namespace>.<capabilityName>`
 */
export function hasCapability(registry: Registry, id: string): boolean {
  const dotIdx = id.indexOf('.');
  if (dotIdx <= 0) return false;

  const ns = id.slice(0, dotIdx);
  const capName = id.slice(dotIdx + 1);

  return registry.namespaces[ns]?.[capName] !== undefined;
}

// ---------------------------------------------------------------------------
// validateSkillCapabilities
// ---------------------------------------------------------------------------

/**
 * Validate a skill's declared capabilities against the registry.
 * Returns { valid: true, missing: [] } if all declared capabilities exist.
 */
export function validateSkillCapabilities(
  skillFrontmatter: { provides_capabilities?: string[] },
  registry: Registry,
): ValidationResult {
  const declared = skillFrontmatter.provides_capabilities ?? [];
  const missing = declared.filter((id) => !hasCapability(registry, id));
  return { valid: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// listGoverningGate
// ---------------------------------------------------------------------------

/**
 * Return all capability ids (in `namespace.name` format) that govern the given
 * gate number, sorted lexicographically.
 */
export function listGoverningGate(registry: Registry, gate: number): string[] {
  const result: string[] = [];

  for (const [ns, caps] of Object.entries(registry.namespaces)) {
    for (const [capName, entry] of Object.entries(caps)) {
      if (entry.governs_gate === gate) {
        result.push(`${ns}.${capName}`);
      }
    }
  }

  return result.sort();
}
