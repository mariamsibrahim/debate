"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { TopicCard } from "@/components/TopicCard";
import { RatingBadge } from "@/components/RatingBadge";

interface Topic {
  id: string;
  title: string;
  category: string;
  subcategory?: string | null;
  popularity: number;
  controversy: number;
}

interface LeaderboardRow {
  username: string;
  elo: number;
  tier: string;
}

const ACTIONS = [
  { href: "/queue?mode=CASUAL", title: "Quick Debate", desc: "Jump into a fast, unranked match on any topic." },
  { href: "/queue?mode=RANKED", title: "Ranked Debate", desc: "Play for Elo in your strongest category." },
  { href: "/queue?mode=CASUAL&format=CASUAL", title: "Casual Discussion", desc: "Untimed, no scoring pressure, moderator still present." },
  { href: "/leaderboard", title: "Watch Live", desc: "Spectator mode is on the near-term roadmap.", disabled: true },
];

export default function HomePage() {
  const [trending, setTrending] = useState<Topic[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    apiFetch<Topic[]>("/topics/trending").then(setTrending).catch(() => setTrending([]));
    apiFetch<LeaderboardRow[]>("/leaderboard").then(setLeaders).catch(() => setLeaders([]));
  }, []);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="mb-1 font-serif text-4xl font-semibold">Debate</h1>
        <p className="mb-6 max-w-xl font-serif text-lg italic text-ink-muted">
          Make intelligent disagreement the default. Leave every debate smarter than you arrived.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ACTIONS.map((action) =>
            action.disabled ? (
              <div key={action.title} className="cursor-not-allowed rounded-md border border-rule bg-surface-2 p-5 opacity-60">
                <h2 className="font-serif text-xl">{action.title}</h2>
                <p className="mt-1 text-sm text-ink-muted">{action.desc}</p>
              </div>
            ) : (
              <Link key={action.title} href={action.href} className="rounded-md border border-rule bg-surface p-5 transition-colors hover:border-brass">
                <h2 className="font-serif text-xl">{action.title}</h2>
                <p className="mt-1 text-sm text-ink-muted">{action.desc}</p>
              </Link>
            ),
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-muted">Trending Topics</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trending.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-muted">Top Debaters</h2>
        <div className="space-y-2">
          {leaders.slice(0, 5).map((row, i) => (
            <div key={row.username} className="flex items-center justify-between rounded-md border border-rule bg-surface px-4 py-2.5">
              <span className="font-mono text-sm">
                <span className="mr-3 text-ink-muted">#{i + 1}</span>
                {row.username}
              </span>
              <RatingBadge elo={row.elo} />
            </div>
          ))}
          {leaders.length === 0 && <p className="text-sm text-ink-muted">No ranked debates yet — be the first.</p>}
        </div>
      </section>
    </div>
  );
}
