/**
 * indexer.ts
 *
 * Debounced, serialized indexer that scans SDLC artifacts and populates the
 * TraceCache.  Implements ADR-CRUX-002 invalidation semantics.
 */

import { scanArtifacts, readArtifact, extractEdges, computeArtifactHash } from './markdown.js';
import type { TraceCache } from './cache.js';
import { CacheClosedError } from './cache.js';
import type { Artifact } from './types.js';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface IndexerOptions {
  readonly rootDir: string;
  readonly cache: TraceCache;
  readonly debounceMs?: number;
  readonly onPassStart?: () => void | Promise<void>;
  readonly onPassComplete?: () => void | Promise<void>;
  readonly onPassError?: (err: unknown) => void;
  /** @internal determinism hook for tests — not part of the public API */
  readonly onAfterScan?: () => void | Promise<void>;
}

export interface Indexer {
  enqueuePass(): Promise<void>;
  readArtifact(id: string): Promise<Artifact>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * A work item in the serialized queue.
 * `run` executes the pass; `resolve` notifies callers when the pass settles.
 */
interface WorkItem {
  run: () => Promise<void>;
  resolve: () => void;
}

class IndexerImpl implements Indexer {
  private readonly rootDir: string;
  private readonly cache: TraceCache;
  private readonly debounceMs: number;
  private readonly onPassStart: (() => void | Promise<void>) | undefined;
  private readonly onPassComplete: (() => void | Promise<void>) | undefined;
  private readonly onPassError: ((err: unknown) => void) | undefined;
  private readonly onAfterScan: (() => void | Promise<void>) | undefined;

  // Explicit FIFO work queue — avoids promise-chain circularity.
  // At most 2 slots: [0] = in-flight, [1] = queued follow-up.
  private readonly queue: WorkItem[] = [];
  private isProcessing = false;

  // Tracks whether the in-flight pass has already completed its scan phase.
  // A follow-up is only enqueued for calls that arrive after the scan phase,
  // because writes arriving before the scan are captured by the current pass
  // naturally (onPassStart fires before scanArtifacts). Calls from onPassStart
  // therefore do not trigger a follow-up — they would have been included in
  // the current pass's scan anyway.
  private isPostScan = false;

  // Debounce state
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingResolvers: Array<() => void> = [];

  constructor(opts: IndexerOptions) {
    this.rootDir = opts.rootDir;
    this.cache = opts.cache;
    this.debounceMs = opts.debounceMs ?? 100;
    this.onPassStart = opts.onPassStart;
    this.onPassComplete = opts.onPassComplete;
    this.onPassError = opts.onPassError;
    this.onAfterScan = opts.onAfterScan;
  }

  enqueuePass(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.debounceMs === 0) {
        this.scheduleItem(resolve);
        return;
      }

      // Debounce: accumulate resolvers, reset timer on each call.
      this.pendingResolvers.push(resolve);

      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        const resolvers = this.pendingResolvers.splice(0);
        this.scheduleItem(() => {
          for (const r of resolvers) r();
        });
      }, this.debounceMs);
    });
  }

  /**
   * Add a work item to the FIFO queue.
   *
   * ADR-CRUX-002 follow-up pass contract:
   *   - If no item is in-flight, enqueue a new item and start processing.
   *   - If an item is in-flight and we are in the post-scan phase (meaning any
   *     writes arriving now WILL be missed by the current scan), enqueue or
   *     attach to a follow-up item. Multiple enqueues during one in-flight
   *     pass coalesce into a single follow-up.
   *   - If an item is in-flight but we are still in the pre-scan phase
   *     (onPassStart has not returned yet), writes will be picked up by the
   *     current scan — attach resolver to the in-flight item without queuing
   *     a separate follow-up pass.
   *   - Bounded depth: at most 1 in-flight + 1 queued follow-up at any time.
   */
  private scheduleItem(notifyDone: () => void): void {
    if (!this.isProcessing) {
      // Nothing running — enqueue and start immediately.
      const item: WorkItem = {
        run: () => this.executePass(),
        resolve: notifyDone,
      };
      this.queue.push(item);
      this.processQueue();
      return;
    }

    // An item is in-flight.
    if (!this.isPostScan) {
      // We are still in the pre-scan phase (onPassStart is executing).
      // The current scan has not started yet, so any write done before this
      // point will be captured by the upcoming scanArtifacts() call.
      // Attach the resolver to the in-flight item so it resolves when the
      // current pass commits.
      const inflight = this.queue[0]!;
      const prevResolve = inflight.resolve;
      inflight.resolve = () => {
        prevResolve();
        notifyDone();
      };
      return;
    }

    // Post-scan: writes that arrived here may have been missed by the scan.
    // Enqueue or piggyback on a follow-up.
    if (this.queue.length >= 2) {
      // A follow-up is already queued — attach resolver to it.
      const followUp = this.queue[1]!;
      const prevResolve = followUp.resolve;
      followUp.resolve = () => {
        prevResolve();
        notifyDone();
      };
      return;
    }

    // No follow-up yet — enqueue one. It will run after the in-flight pass
    // commits, picking up any writes that landed during the prior scan.
    const followUp: WorkItem = {
      run: () => this.executePass(),
      resolve: notifyDone,
    };
    this.queue.push(followUp);
  }

  /**
   * Drain the queue: run items one at a time.  If a new item is added during
   * processing (e.g. from onAfterScan), it will be picked up in the next
   * iteration.
   */
  private processQueue(): void {
    if (this.isProcessing) return;

    const next = this.queue[0];
    if (next === undefined) return;

    this.isProcessing = true;
    this.isPostScan = false;
    next
      .run()
      .catch((err: unknown) => {
        if (this.onPassError !== undefined) {
          this.onPassError(err);
        } else {
          console.error('[indexer] pass error:', err);
        }
      })
      .then(() => {
        // Remove the completed item.
        this.queue.shift();
        const resolveNotify = next.resolve;
        this.isProcessing = false;
        this.isPostScan = false;
        resolveNotify();
        // Process the next item, if any.
        this.processQueue();
      });
  }

  private async executePass(): Promise<void> {
    if (this.onPassStart) {
      await this.onPassStart();
    }

    // Mark that we have entered the scan phase. Any enqueuePass() calls
    // from this point forward will create a follow-up (they may miss this scan).
    this.isPostScan = true;

    const scanned = scanArtifacts(this.rootDir);
    const scannedIds = new Set<string>(scanned.map((a) => a.id));

    // Upsert changed artifacts
    for (const artifact of scanned) {
      const filePath = artifact.path;
      if (!filePath) continue;

      let cached: { sha256: string; mtime: number } | null;
      try {
        cached = this.cache.getHash(filePath);
      } catch {
        return; // cache closed — abort pass
      }

      let hashResult: { sha256: string; mtime: number };
      try {
        hashResult = computeArtifactHash(filePath);
      } catch {
        continue; // file disappeared mid-scan — skip
      }

      const changed =
        cached === null || cached.sha256 !== hashResult.sha256 || cached.mtime !== hashResult.mtime;

      if (changed) {
        try {
          this.cache.upsertArtifact(artifact, hashResult.sha256, hashResult.mtime);
          const edges = extractEdges(artifact);
          this.cache.upsertEdges(artifact.id, edges);
        } catch {
          return; // cache closed
        }
      }
    }

    // Allow tests to hook after the scan but before flush/delete cleanup.
    if (this.onAfterScan) {
      await this.onAfterScan();
    }

    // Remove artifacts that are no longer on disk
    let cachedArtifacts: Artifact[];
    try {
      cachedArtifacts = this.cache.listArtifacts();
    } catch {
      return; // cache closed
    }

    for (const cached of cachedArtifacts) {
      if (!scannedIds.has(cached.id)) {
        try {
          this.cache.delete(cached.id);
        } catch {
          return; // cache closed
        }
      }
    }

    try {
      await this.cache.flush();
    } catch (flushErr: unknown) {
      if (flushErr instanceof CacheClosedError) {
        // Expected when cache is closed concurrently — suppress silently.
        return;
      }
      // I/O error (disk full, permissions, etc.) — surface it.
      if (this.onPassError !== undefined) {
        this.onPassError(flushErr);
      } else {
        console.error('[indexer] flush error:', flushErr);
      }
    }

    if (this.onPassComplete) {
      await this.onPassComplete();
    }
  }

  async readArtifact(id: string): Promise<Artifact> {
    const cached = this.cache.getArtifact(id);
    if (cached === null) {
      throw new Error(`Artifact not found in cache: "${id}"`);
    }

    const filePath = cached.path;
    if (!filePath) {
      return cached;
    }

    // Compute current hash and compare to cached
    let currentHash: { sha256: string; mtime: number };
    try {
      currentHash = computeArtifactHash(filePath);
    } catch {
      // File gone — return cached value
      return cached;
    }

    const storedHash = this.cache.getHash(filePath);
    if (
      storedHash !== null &&
      storedHash.sha256 === currentHash.sha256 &&
      storedHash.mtime === currentHash.mtime
    ) {
      // Fast path: hash matches
      return cached;
    }

    // Hash mismatch — re-read from disk (markdown wins)
    const fresh = readArtifact(filePath);
    this.cache.upsertArtifact(fresh, currentHash.sha256, currentHash.mtime);
    const edges = extractEdges(fresh);
    this.cache.upsertEdges(fresh.id, edges);
    // Persist the correction immediately so it survives process restart.
    await this.cache.flush();
    return fresh;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createIndexer(opts: IndexerOptions): Indexer {
  return new IndexerImpl(opts);
}
