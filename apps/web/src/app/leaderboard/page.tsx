"use client";

import { useEffect, useState } from "react";
import { TOPIC_CATEGORIES, TopicCategory } from "@debate/shared";
import { apiFetch } from "@/lib/api";
import { RatingBadge } from "@/components/RatingBadge";

interface Row {
  username: string;
  elo: number;
  tier: string;
  gamesPlayed: number;
}

export default function LeaderboardPage() {
  const [category, setCategory] = useState<TopicCategory | "GLOBAL">("GLOBAL");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const qs = category === "GLOBAL" ? "" : `?category=${category}`;
    apiFetch<Row[]>(`/leaderboard${qs}`).then(setRows).catch(() => setRows([]));
  }, [category]);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Leaderboard</h1>
      <div className="flex flex-wrap gap-2">
        {(["GLOBAL", ...TOPIC_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${
              category === c ? "border-brass bg-brass-soft text-brass" : "border-rule text-ink-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-rule">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Debater</th>
              <th className="px-4 py-2 text-left">Rating</th>
              <th className="px-4 py-2 text-left">Games</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.username} className="border-t border-rule">
                <td className="px-4 py-2 font-mono text-ink-muted">{i + 1}</td>
                <td className="px-4 py-2">{row.username}</td>
                <td className="px-4 py-2">
                  <RatingBadge elo={row.elo} />
                </td>
                <td className="px-4 py-2 font-mono font-variant-tabular">{row.gamesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-ink-muted">No debates recorded yet.</p>}
      </div>
    </div>
  );
}
