import { tierForElo } from "@debate/shared";

export function RatingBadge({ elo, category }: { elo: number; category?: string }) {
  const tier = tierForElo(elo);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface px-3 py-1 font-mono text-xs">
      <span className="text-brass">{tier.name}</span>
      <span className="font-variant-tabular text-ink-muted">{elo}</span>
      {category && <span className="text-ink-muted">· {category}</span>}
    </span>
  );
}
