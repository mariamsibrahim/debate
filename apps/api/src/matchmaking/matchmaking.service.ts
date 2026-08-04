import { Injectable } from "@nestjs/common";
import { MatchmakingRequest } from "@debate/shared";

export interface QueueEntry extends MatchmakingRequest {
  socketId: string;
}

export interface MatchmakingOptions {
  /** Starting acceptable Elo delta, widening every WINDOW_STEP_MS of wait. */
  baseWindow?: number;
  windowStepSize?: number;
  windowStepMs?: number;
  maxWindow?: number;
  /** How long two users are kept from being re-matched after playing. */
  rematchCooldownMs?: number;
  /** Civility score below this floor is contained to a review-matched pool. */
  civilityFloor?: number;
}

export interface MatchedPair {
  a: QueueEntry;
  b: QueueEntry;
}

const DEFAULTS: Required<MatchmakingOptions> = {
  baseWindow: 75,
  windowStepSize: 25,
  windowStepMs: 5000,
  maxWindow: 400,
  rematchCooldownMs: 24 * 60 * 60 * 1000,
  civilityFloor: 40,
};

/**
 * Pure matchmaking logic (blueprint §6): a queue-based matcher with an
 * expanding search window, hard-filtered on category/format/language/mode,
 * scored by Elo distance + civility gap, avoiding recent-opponent repeats
 * and containing low-civility users to their own pool. No I/O here — the
 * gateway owns sockets and debate creation, this class only decides pairs,
 * which keeps it trivially unit-testable.
 */
@Injectable()
export class MatchmakingService {
  private queue: QueueEntry[] = [];
  private lastMatchedAt = new Map<string, number>(); // "userA|userB" (sorted) -> timestamp
  private opts: Required<MatchmakingOptions> = { ...DEFAULTS };

  /**
   * Nest instantiates this with no constructor args (a plain interface
   * param would confuse its DI reflection), so tests that need a tighter
   * cooldown or window use this instead of a constructor argument.
   */
  setOptions(options: MatchmakingOptions) {
    this.opts = { ...this.opts, ...options };
    return this;
  }

  join(entry: QueueEntry) {
    this.queue = this.queue.filter((e) => e.userId !== entry.userId);
    this.queue.push(entry);
  }

  leave(userId: string) {
    this.queue = this.queue.filter((e) => e.userId !== userId);
  }

  queueLength() {
    return this.queue.length;
  }

  isQueued(userId: string) {
    return this.queue.some((e) => e.userId === userId);
  }

  recordMatch(userIdA: string, userIdB: string, now = Date.now()) {
    this.lastMatchedAt.set(this.pairKey(userIdA, userIdB), now);
  }

  private pairKey(a: string, b: string) {
    return [a, b].sort().join("|");
  }

  private isOnCooldown(a: QueueEntry, b: QueueEntry, now: number): boolean {
    const last = this.lastMatchedAt.get(this.pairKey(a.userId, b.userId));
    return last !== undefined && now - last < this.opts.rematchCooldownMs;
  }

  private windowFor(entry: QueueEntry, now: number): number {
    const waitedMs = now - entry.queuedAt;
    const steps = Math.floor(waitedMs / this.opts.windowStepMs);
    return Math.min(this.opts.maxWindow, this.opts.baseWindow + steps * this.opts.windowStepSize);
  }

  private eligible(a: QueueEntry, b: QueueEntry, now: number): boolean {
    if (a.userId === b.userId) return false;
    if (a.category !== b.category || a.format !== b.format || a.language !== b.language || a.mode !== b.mode) return false;
    if (this.isOnCooldown(a, b, now)) return false;

    const aBelowFloor = a.civility < this.opts.civilityFloor;
    const bBelowFloor = b.civility < this.opts.civilityFloor;
    if (aBelowFloor !== bBelowFloor) return false; // one contained, one not — no cross-matching

    const window = Math.max(this.windowFor(a, now), this.windowFor(b, now));
    return Math.abs(a.elo - b.elo) <= window;
  }

  /** Lower is better: weighted Elo distance + civility gap (blueprint §6). */
  private score(a: QueueEntry, b: QueueEntry): number {
    return 0.6 * Math.abs(a.elo - b.elo) + 0.4 * Math.abs(a.civility - b.civility) * 4;
  }

  /**
   * Runs one matching pass. Greedily pairs the longest-waiting entries
   * first (so nobody is repeatedly skipped over) with their best-scoring
   * eligible partner, removing matched pairs from the queue.
   */
  tick(now = Date.now()): MatchedPair[] {
    const matches: MatchedPair[] = [];
    const byOldest = [...this.queue].sort((x, y) => x.queuedAt - y.queuedAt);
    const matched = new Set<string>();

    for (const entry of byOldest) {
      if (matched.has(entry.userId)) continue;
      let best: QueueEntry | null = null;
      let bestScore = Infinity;
      for (const candidate of byOldest) {
        if (matched.has(candidate.userId)) continue;
        if (!this.eligible(entry, candidate, now)) continue;
        const s = this.score(entry, candidate);
        if (s < bestScore) {
          bestScore = s;
          best = candidate;
        }
      }
      if (best) {
        matched.add(entry.userId);
        matched.add(best.userId);
        matches.push({ a: entry, b: best });
      }
    }

    for (const { a, b } of matches) {
      this.queue = this.queue.filter((e) => e.userId !== a.userId && e.userId !== b.userId);
    }
    return matches;
  }
}
