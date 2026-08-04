import { MatchmakingService, QueueEntry } from "./matchmaking.service";

function entry(overrides: Partial<QueueEntry>): QueueEntry {
  return {
    userId: "u1",
    username: "user1",
    category: "TECHNOLOGY",
    format: "BLITZ",
    language: "en",
    mode: "RANKED",
    elo: 1000,
    civility: 80,
    queuedAt: Date.now(),
    socketId: "socket1",
    ...overrides,
  };
}

describe("MatchmakingService", () => {
  let service: MatchmakingService;

  beforeEach(() => {
    service = new MatchmakingService();
  });

  it("matches two close-rated users in the same category/format/language", () => {
    service.join(entry({ userId: "a", elo: 1000 }));
    service.join(entry({ userId: "b", elo: 1030 }));
    const matches = service.tick();
    expect(matches).toHaveLength(1);
    expect(new Set([matches[0].a.userId, matches[0].b.userId])).toEqual(new Set(["a", "b"]));
    expect(service.queueLength()).toBe(0);
  });

  it("does not match users in different categories", () => {
    service.join(entry({ userId: "a", category: "TECHNOLOGY" }));
    service.join(entry({ userId: "b", category: "POLITICS" }));
    expect(service.tick()).toHaveLength(0);
  });

  it("does not match users on different formats or languages", () => {
    service.join(entry({ userId: "a", format: "BLITZ" }));
    service.join(entry({ userId: "b", format: "STANDARD" }));
    expect(service.tick()).toHaveLength(0);
  });

  it("rejects a large Elo gap immediately but accepts it once the window has widened", () => {
    const now = Date.now();
    service.join(entry({ userId: "a", elo: 1000, queuedAt: now }));
    service.join(entry({ userId: "b", elo: 1300, queuedAt: now }));
    expect(service.tick(now)).toHaveLength(0);

    // 60s of waiting at +25/5s = +300 widening -> window covers a 300 gap
    expect(service.tick(now + 60_000)).toHaveLength(1);
  });

  it("keeps low-civility users contained to their own pool", () => {
    service.join(entry({ userId: "a", civility: 20, elo: 1000 }));
    service.join(entry({ userId: "b", civility: 90, elo: 1000 }));
    expect(service.tick()).toHaveLength(0);

    service.join(entry({ userId: "c", civility: 25, elo: 1000 }));
    const matches = service.tick();
    expect(matches).toHaveLength(1);
    expect(new Set([matches[0].a.userId, matches[0].b.userId])).toEqual(new Set(["a", "c"]));
  });

  it("prevents two users from being immediately re-matched", () => {
    service.setOptions({ rematchCooldownMs: 60_000 });
    const now = Date.now();
    service.recordMatch("a", "b", now);
    service.join(entry({ userId: "a", queuedAt: now }));
    service.join(entry({ userId: "b", queuedAt: now }));
    expect(service.tick(now + 1000)).toHaveLength(0);
    expect(service.tick(now + 61_000)).toHaveLength(1);
  });

  it("prefers the closest Elo match when multiple candidates are eligible", () => {
    const now = Date.now();
    service.join(entry({ userId: "a", elo: 1000, queuedAt: now }));
    service.join(entry({ userId: "b", elo: 1010, queuedAt: now }));
    service.join(entry({ userId: "c", elo: 1070, queuedAt: now }));
    const matches = service.tick(now);
    expect(matches).toHaveLength(1);
    expect(new Set([matches[0].a.userId, matches[0].b.userId])).toEqual(new Set(["a", "b"]));
  });
});
