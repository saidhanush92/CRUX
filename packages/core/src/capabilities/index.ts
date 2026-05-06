export {
  loadRegistry,
  hasCapability,
  validateSkillCapabilities,
  listGoverningGate,
  RegistryNotFoundError,
  MalformedRegistryError,
  DuplicateCapabilityError,
} from './registry.js';
export type { Registry, CapabilityEntry, ValidationResult } from './registry.js';
