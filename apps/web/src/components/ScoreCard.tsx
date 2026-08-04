import { JUDGE_CATEGORIES, JudgeScorecard } from "@debate/shared";

export function ScoreCard({ scorecard, username, highlight }: { scorecard: JudgeScorecard; username: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-5 ${highlight ? "border-brass bg-brass-soft" : "border-rule bg-surface"}`}>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-lg font-semibold">{username}</h3>
        <span className="font-mono text-2xl font-variant-tabular text-brass">{scorecard.overall}</span>
      </div>
      <div className="space-y-2">
        {JUDGE_CATEGORIES.map((category) => (
          <div key={category} className="flex items-center gap-3">
            <span className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-wide text-ink-muted">{category}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-teal" style={{ width: `${scorecard[category]}%` }} />
            </div>
            <span className="w-8 text-right font-mono text-xs font-variant-tabular">{scorecard[category]}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">{scorecard.feedback}</p>
    </div>
  );
}
