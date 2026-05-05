/**
 * state-machine.ts
 *
 * In-memory gate state machine for Crux's 8-gate progression model.
 * Enforces ordered sequencing: each gate (2–8) requires its direct
 * predecessor to be in 'closed' or 'skipped' status before it may open.
 *
 * Sources:
 *   - TASK-CRUX-001
 *   - REQ-CRUX-008 (gate-mode + artifact invariance)
 *   - ADR-CRUX-001 (TypeScript monorepo conventions)
 */

export type GateId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type GateStatus = 'open' | 'closed' | 'blocked' | 'skipped';

export interface GateState {
  gate: GateId;
  status: GateStatus;
  opened_at?: string;
  closed_at?: string;
  blocker?: string;
}

export interface GateSnapshot {
  gates: GateState[];
}

export interface GateMachine {
  open(gate: GateId): void;
  close(gate: GateId): void;
  block(gate: GateId, reason: string): void;
  skip(gate: GateId): void;
  current(): GateState[];
  all(): GateState[];
  serialize(): GateSnapshot;
  deserialize(snapshot: unknown): void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneState(state: GateState): GateState {
  return { ...state };
}

const VALID_GATE_IDS: readonly GateId[] = [1, 2, 3, 4, 5, 6, 7, 8];
const VALID_GATE_STATUSES: readonly GateStatus[] = ['open', 'closed', 'blocked', 'skipped'];

function isValidSnapshot(value: unknown): value is GateSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj['gates']);
}

/**
 * Validates a single gate entry from a deserialized snapshot.
 * Throws a descriptive error if the entry does not conform to GateState:
 *   - gate must be a known GateId (1–8)
 *   - status must be a known GateStatus
 *   - opened_at / closed_at must be strings when present
 *   - blocker must be a string when present
 */
function validateGateState(entry: unknown): GateState {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`deserialize: entry is not an object — got ${JSON.stringify(entry)}`);
  }
  const obj = entry as Record<string, unknown>;

  const gate = obj['gate'];
  if (!(VALID_GATE_IDS as unknown[]).includes(gate)) {
    throw new Error(
      `deserialize: entry has invalid gate id '${String(gate)}'. Expected one of: ${VALID_GATE_IDS.join(', ')}.`,
    );
  }

  const status = obj['status'];
  if (!(VALID_GATE_STATUSES as unknown[]).includes(status)) {
    throw new Error(
      `deserialize: entry for gate ${String(gate)} has invalid status '${String(status)}'. Expected one of: ${VALID_GATE_STATUSES.join(', ')}.`,
    );
  }

  if (obj['opened_at'] !== undefined && typeof obj['opened_at'] !== 'string') {
    throw new Error(
      `deserialize: entry for gate ${String(gate)} has non-string 'opened_at': ${JSON.stringify(obj['opened_at'])}.`,
    );
  }

  if (obj['closed_at'] !== undefined && typeof obj['closed_at'] !== 'string') {
    throw new Error(
      `deserialize: entry for gate ${String(gate)} has non-string 'closed_at': ${JSON.stringify(obj['closed_at'])}.`,
    );
  }

  if (obj['blocker'] !== undefined && typeof obj['blocker'] !== 'string') {
    throw new Error(
      `deserialize: entry for gate ${String(gate)} has non-string 'blocker': ${JSON.stringify(obj['blocker'])}.`,
    );
  }

  return obj as unknown as GateState;
}

export function createGateMachine(): GateMachine {
  const states = new Map<GateId, GateState>();

  function getState(gate: GateId): GateState | undefined {
    return states.get(gate);
  }

  function predecessorSatisfied(gate: GateId): boolean {
    if (gate === 1) return true;
    const predId = (gate - 1) as GateId;
    const pred = states.get(predId);
    if (pred === undefined) return false;
    return pred.status === 'closed' || pred.status === 'skipped';
  }

  function open(gate: GateId): void {
    if (!predecessorSatisfied(gate)) {
      const predId = (gate - 1) as GateId;
      throw new Error(`Cannot open gate ${gate}: gate ${predId} must be closed or skipped first.`);
    }
    const existing = getState(gate);
    if (existing !== undefined) {
      throw new Error(`Cannot open gate ${gate}: already in status '${existing.status}'.`);
    }
    states.set(gate, { gate, status: 'open', opened_at: nowIso() });
  }

  function close(gate: GateId): void {
    const existing = getState(gate);
    if (existing === undefined || existing.status !== 'open') {
      const statusStr = existing ? `'${existing.status}'` : 'not yet opened';
      throw new Error(
        `Cannot close gate ${gate}: current status is ${statusStr}. Gate must be open to close.`,
      );
    }
    states.set(gate, { ...existing, status: 'closed', closed_at: nowIso() });
  }

  function block(gate: GateId, reason: string): void {
    const existing = getState(gate);
    if (existing === undefined || existing.status !== 'open') {
      const statusStr = existing ? `'${existing.status}'` : 'not yet opened';
      throw new Error(
        `Cannot block gate ${gate}: current status is ${statusStr}. Gate must be open to block.`,
      );
    }
    states.set(gate, { ...existing, status: 'blocked', blocker: reason });
  }

  function skip(gate: GateId): void {
    if (!predecessorSatisfied(gate)) {
      const predId = (gate - 1) as GateId;
      throw new Error(`Cannot skip gate ${gate}: gate ${predId} must be closed or skipped first.`);
    }
    const existing = getState(gate);
    if (existing !== undefined) {
      throw new Error(`Cannot skip gate ${gate}: already in status '${existing.status}'.`);
    }
    states.set(gate, { gate, status: 'skipped' });
  }

  function current(): GateState[] {
    return Array.from(states.values())
      .filter((s) => s.status === 'open')
      .map(cloneState);
  }

  function all(): GateState[] {
    return Array.from(states.values()).map(cloneState);
  }

  function serialize(): GateSnapshot {
    return { gates: Array.from(states.values()).map(cloneState) };
  }

  function deserialize(snapshot: unknown): void {
    if (!isValidSnapshot(snapshot)) {
      throw new Error('deserialize: invalid snapshot format — expected { gates: GateState[] }');
    }

    // Validate all entries atomically before mutating internal state.
    // If any entry is invalid, we throw without clearing the existing state.
    const validated: GateState[] = snapshot.gates.map(validateGateState);

    states.clear();
    for (const entry of validated) {
      states.set(entry.gate, cloneState(entry));
    }
  }

  return { open, close, block, skip, current, all, serialize, deserialize };
}
