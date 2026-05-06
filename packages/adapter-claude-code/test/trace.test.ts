import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Event, CapabilityId, SkillId } from '../../core/src/adapter/types.js';
import { ADAPTER_INTERFACE_MANIFEST } from '../../core/src/adapter/interface.js';

import { emit_event, resolve_capability, invoke_skill } from '../src/trace.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crux-test-trace-'));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function eventLogPath(rootDir: string): string {
  return path.join(rootDir, '.crux', 'trace', 'events.jsonl');
}

function installSkill(rootDir: string, skillName: string, body: string): void {
  const skillDir = path.join(rootDir, '.claude', 'skills', skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), body, 'utf8');
}

function installAmendment(rootDir: string, fileName: string, body: string): void {
  const amdDir = path.join(rootDir, 'docs', 'sdlc', 'amendments');
  fs.mkdirSync(amdDir, { recursive: true });
  fs.writeFileSync(path.join(amdDir, fileName), body, 'utf8');
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTempDir();
  fs.mkdirSync(path.join(tmpDir, 'capabilities'), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), 'capabilities', 'registry.v1.yaml'),
    path.join(tmpDir, 'capabilities', 'registry.v1.yaml'),
  );
});

afterEach(() => {
  removeTempDir(tmpDir);
});

describe('emit_event', () => {
  it('persists a durable event record to the adapter trace surface', async () => {
    const event: Event = {
      type: 'task.started',
      payload: { taskId: 'TASK-CRUX-009' },
      timestamp: 12345,
    };

    await emit_event(tmpDir, event);

    const content = fs.readFileSync(eventLogPath(tmpDir), 'utf8');
    const record = JSON.parse(content.trim()) as Record<string, unknown>;

    expect(record['type']).toBe('task.started');
    expect(record['timestamp']).toBe(12345);
  });

  it('appends multiple events as separate JSONL records', async () => {
    await emit_event(tmpDir, { type: 'one', payload: { n: 1 } });
    await emit_event(tmpDir, { type: 'two', payload: { n: 2 } });

    const lines = fs.readFileSync(eventLogPath(tmpDir), 'utf8').trim().split(/\r?\n/);
    expect(lines).toHaveLength(2);
  });
});

describe('resolve_capability', () => {
  it('returns true for a real capability from the registry', async () => {
    const result = await resolve_capability(tmpDir, 'testing.tdd-loop' as CapabilityId);

    expect(result).toBe(true);
  });

  it('returns false for a missing capability', async () => {
    const result = await resolve_capability(tmpDir, 'testing.missing' as CapabilityId);

    expect(result).toBe(false);
  });
});

describe('invoke_skill', () => {
  it('returns base skill content when no amendments apply', async () => {
    installSkill(tmpDir, 'tdd-workflow', '# Base skill body');

    const result = await invoke_skill(tmpDir, 'tdd-workflow' as SkillId, null);

    expect(result).toBe('# Base skill body');
  });

  it('includes matching amendments and preserves BLOCKING rendering for severity: high', async () => {
    installSkill(tmpDir, 'tdd-workflow', '# Base skill body');
    installAmendment(
      tmpDir,
      'AMD-001.yaml',
      [
        'id: AMD-001',
        'target_skill: tdd-workflow',
        'severity: high',
        'applies_when: always',
        'rule: |',
        '  run a tighter red-green loop',
      ].join('\n'),
    );

    const result = await invoke_skill(tmpDir, 'tdd-workflow' as SkillId, null);

    expect(typeof result).toBe('string');
    expect(result).toContain('## Active amendments');
    expect(result).toContain('**BLOCKING:**');
    expect(result).toContain('run a tighter red-green loop');
  });
});

describe('trace module manifest conformance', () => {
  it('exports all 3 TraceCapability functions declared in ADAPTER_INTERFACE_MANIFEST', async () => {
    const mod = await import('../src/trace.js');
    const exported = Object.keys(mod);

    for (const fn of ADAPTER_INTERFACE_MANIFEST['TraceCapability']) {
      expect(exported, `trace module must export "${fn}"`).toContain(fn);
    }
  });

  it('TraceEventWriteError is exported from the trace module', async () => {
    const mod = await import('../src/trace.js');

    expect(mod['TraceEventWriteError']).toBeDefined();
    expect(typeof mod['TraceEventWriteError']).toBe('function');
  });
});
